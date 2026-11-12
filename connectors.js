// Data connections: Google (Search Console + Analytics 4, read-only OAuth) and DataForSEO.
// Every tool here only reads. Paid DataForSEO lookups are cached, counted and capped.
import crypto from 'node:crypto';
import * as P from './providers.js';

let db;
const DAY = 86400000;
const PAID_PER_RUN = 10;
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly', 'https://www.googleapis.com/auth/analytics.readonly'];

export function init(database, defaults = {}) {
  db = database;
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS spend (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, tool TEXT NOT NULL, cost REAL NOT NULL, at INTEGER NOT NULL);
  `);
  db.prepare('DELETE FROM cache WHERE at < ?').run(Date.now() - DAY);
  P.init({ get, set, del, cached, remember, db }, defaults);
}
const get = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value ?? null;
const set = (k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, String(v));
const del = (k) => db.prepare('DELETE FROM settings WHERE key = ?').run(k);
const cached = (key) => { const r = db.prepare('SELECT value FROM cache WHERE key = ? AND at > ?').get(key, Date.now() - DAY); return r ? JSON.parse(r.value) : null; };
const remember = (key, value) => db.prepare('INSERT INTO cache (key, value, at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, at = excluded.at').run(key, JSON.stringify(value), Date.now());
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/* ---------- status ---------- */
const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const serviceAccount = () => { const v = get('google_service'); return v ? JSON.parse(v) : null; };
// Credentials entered in the app win over .env.
const dfsCreds = () => {
  const login = get('dfs_login'), password = get('dfs_password');
  if (login && password) return { login, password, source: 'app' };
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) return { login: process.env.DATAFORSEO_LOGIN, password: process.env.DATAFORSEO_PASSWORD, source: 'env' };
  return null;
};
const dfsConfigured = () => Boolean(dfsCreds());
export const anthropicKey = () => get('anthropic_key');
const monthStart = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
const dfsSpent = () => db.prepare(`SELECT COALESCE(SUM(cost), 0) AS s FROM spend WHERE source = 'dfs' AND at >= ?`).get(monthStart()).s;
const dfsCap = () => Number(get('dfs_cap') ?? 5);

export function status() {
  const sa = serviceAccount();
  const oauth = googleConfigured() && Boolean(get('google_refresh'));
  const connected = Boolean(sa) || oauth;
  return {
    claude: { source: get('anthropic_key') ? 'app' : process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? 'env' : null },
    google: { oauthConfigured: googleConfigured(), connected, mode: sa ? 'service' : oauth ? 'oauth' : null, serviceEmail: sa?.client_email || null, gscSite: get('gsc_site'), ga4Property: get('ga4_property') },
    dfs: { configured: dfsConfigured(), source: dfsCreds()?.source || null, cap: dfsCap(), spent: Math.round(dfsSpent() * 10000) / 10000, location: Number(get('dfs_location') ?? 2840), language: get('dfs_language') ?? 'en' },
    gsc: connected && Boolean(get('gsc_site')),
    ga4: connected && Boolean(get('ga4_property')),
    dfsReady: dfsConfigured(),
    serp: P.serpReady(),
    serpInfo: P.serpInfo(),
    llm: P.llmStatus(),
    gbp: false,
  };
}

/* ---------- Google ---------- */
let access = null; // { token, exp }
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// Service account: sign a short-lived JWT with the key and exchange it for an access token.
async function serviceToken(sa) {
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = b64url({ alg: 'RS256', typ: 'JWT' }) + '.' + b64url({ iss: sa.client_email, scope: GOOGLE_SCOPES.join(' '), aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 });
  let signature;
  try { signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url'); } catch { throw new Error('The private key in that file could not be read.'); }
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + signature }), signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google rejected the service account key: ' + (j.error_description || j.error || r.status));
  return { token: j.access_token, exp: Date.now() + (j.expires_in || 3000) * 1000 };
}
async function googleToken() {
  if (access && access.exp > Date.now() + 60000) return access.token;
  const sa = serviceAccount();
  if (sa) { access = await serviceToken(sa); return access.token; }
  const refresh = get('google_refresh');
  if (!googleConfigured() || !refresh) throw new Error('Google is not connected.');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' }), signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (j.error === 'invalid_grant') { del('google_refresh'); access = null; throw new Error('Google access was revoked or expired. Connect Google again on the Connections page.'); }
    throw new Error('Google sign-in failed: ' + (j.error_description || j.error || r.status));
  }
  access = { token: j.access_token, exp: Date.now() + (j.expires_in || 3000) * 1000 };
  return access.token;
}
async function gfetch(url, body) {
  const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + (await googleToken()), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google API ${r.status}: ${j.error?.message || 'request failed'}`);
  return j;
}
const gscQuery = (body) => {
  const site = get('gsc_site');
  if (!site) throw new Error('No Search Console property is selected on the Connections page.');
  return gfetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, body);
};
// Search Console data lags about three days.
const defaultRange = (days = 28) => { const end = Date.now() - 3 * DAY; return { start: ymd(end - (days - 1) * DAY), end: ymd(end) }; };

/* ---------- DataForSEO ---------- */
async function dfsCall(path, task, tool) {
  if (!dfsConfigured()) throw new Error('DataForSEO is not configured.');
  const key = 'dfs:' + path + ':' + JSON.stringify(task);
  const hit = cached(key);
  if (hit) return { result: hit, cost: 0, cached: true };
  if (dfsSpent() >= dfsCap()) throw new Error(`The monthly DataForSEO cap of $${dfsCap()} is reached. Raise it on the Connections page to continue.`);
  const creds = dfsCreds();
  const auth = Buffer.from(`${creds.login}:${creds.password}`).toString('base64');
  const r = await fetch('https://api.dataforseo.com/v3/' + path, { method: task ? 'POST' : 'GET', headers: { authorization: 'Basic ' + auth, 'content-type': 'application/json' }, body: task ? JSON.stringify([task]) : undefined, signal: AbortSignal.timeout(60000) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error('DataForSEO rejected that login and password.');
  const t = j.tasks?.[0];
  if (!r.ok || !t || t.status_code >= 40000) throw new Error('DataForSEO: ' + (t?.status_message || j.status_message || 'request failed (' + r.status + ')'));
  const cost = Number(t.cost ?? j.cost ?? 0);
  if (task) { db.prepare(`INSERT INTO spend (source, tool, cost, at) VALUES ('dfs', ?, ?, ?)`).run(tool, cost, Date.now()); remember(key, t.result ?? []); }
  return { result: t.result ?? [], cost, cached: false };
}
const geo = () => { const s = status().dfs; return { location_code: s.location, language_code: s.language }; };
// Response shapes are mapped defensively: if the expected fields are missing, pass the raw result through, truncated.
const shaped = (rows, raw) => (rows.length && rows.some((r) => Object.values(r).some((v) => v != null)) ? JSON.stringify(rows) : JSON.stringify(raw).slice(0, 8000));
const clampInt = (v, lo, hi, dflt) => (Number.isInteger(v) ? Math.max(lo, Math.min(hi, v)) : dflt);
const strList = (v, max) => (Array.isArray(v) && v.length && v.length <= max && v.every((s) => typeof s === 'string' && s.trim()) ? v.map((s) => s.trim().slice(0, 120)) : null);
const domain = (v) => (typeof v === 'string' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')) ? v.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase() : null);

/* ---------- tools the agents can call ---------- */
const obj = (properties, required) => ({ type: 'object', additionalProperties: false, properties, required });
const TOOLS = {
  gsc_search_analytics: {
    src: 'gsc', paid: false,
    def: { name: 'gsc_search_analytics', description: 'Read Search Console performance for the connected property: clicks, impressions, CTR and average position, grouped by one dimension. Dates are YYYY-MM-DD; data lags about 3 days. Omit dates for the last 28 days.', eager_input_streaming: true,
      input_schema: obj({ dimension: { type: 'string', enum: ['query', 'page', 'date', 'country', 'device'] }, start_date: { type: 'string' }, end_date: { type: 'string' }, row_limit: { type: 'integer', description: '1 to 250, default 100' }, page_contains: { type: 'string', description: 'Only rows whose page URL contains this text' }, query_contains: { type: 'string' } }, ['dimension']) },
    async run(i) {
      if (!['query', 'page', 'date', 'country', 'device'].includes(i.dimension)) throw new Error('dimension is invalid.');
      const d = defaultRange();
      const start = i.start_date ?? d.start, end = i.end_date ?? d.end;
      if (!isDate(start) || !isDate(end) || start > end) throw new Error('Dates must be YYYY-MM-DD with start before end.');
      const filters = [];
      if (typeof i.page_contains === 'string' && i.page_contains) filters.push({ dimension: 'page', operator: 'contains', expression: i.page_contains.slice(0, 200) });
      if (typeof i.query_contains === 'string' && i.query_contains) filters.push({ dimension: 'query', operator: 'contains', expression: i.query_contains.slice(0, 200) });
      const j = await gscQuery({ startDate: start, endDate: end, dimensions: [i.dimension], rowLimit: clampInt(i.row_limit, 1, 250, 100), ...(filters.length ? { dimensionFilterGroups: [{ filters }] } : {}) });
      const rows = (j.rows || []).map((r) => ({ [i.dimension]: r.keys?.[0], clicks: r.clicks, impressions: r.impressions, ctr: Math.round(r.ctr * 10000) / 100, position: Math.round(r.position * 10) / 10 }));
      return `Search Console, ${get('gsc_site')}, ${start} to ${end}, by ${i.dimension} (${rows.length} rows, ctr in %):\n${JSON.stringify(rows)}`;
    },
  },
  gsc_inspect_url: {
    src: 'gsc', paid: false,
    def: { name: 'gsc_inspect_url', description: 'Ask Search Console how Google sees one URL of the connected property: index status, coverage state, canonical chosen by Google, last crawl.', eager_input_streaming: true, input_schema: obj({ url: { type: 'string' } }, ['url']) },
    async run(i) {
      if (typeof i.url !== 'string' || !/^https?:\/\//i.test(i.url)) throw new Error('url must be an absolute http(s) URL.');
      const j = await gfetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { inspectionUrl: i.url, siteUrl: get('gsc_site') });
      return JSON.stringify(j.inspectionResult?.indexStatusResult ?? j).slice(0, 4000);
    },
  },
  ga4_organic_report: {
    src: 'ga4', paid: false,
    def: { name: 'ga4_organic_report', description: 'Read Google Analytics 4 for organic search traffic only: sessions, engaged sessions, key events and revenue, optionally grouped by date or landing page. Dates are YYYY-MM-DD; omit for the last 28 days.', eager_input_streaming: true,
      input_schema: obj({ group_by: { type: 'string', enum: ['none', 'date', 'landing_page'] }, start_date: { type: 'string' }, end_date: { type: 'string' } }, ['group_by']) },
    async run(i) {
      const dim = { none: null, date: 'date', landing_page: 'landingPagePlusQueryString' }[i.group_by];
      if (dim === undefined) throw new Error('group_by is invalid.');
      const d = defaultRange();
      const start = i.start_date ?? d.start, end = i.end_date ?? d.end;
      if (!isDate(start) || !isDate(end) || start > end) throw new Error('Dates must be YYYY-MM-DD with start before end.');
      const prop = get('ga4_property');
      const j = await gfetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(prop)}:runReport`, {
        dateRanges: [{ startDate: start, endDate: end }], dimensions: dim ? [{ name: dim }] : [], limit: 100,
        metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'keyEvents' }, { name: 'totalRevenue' }],
        dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' } } },
        ...(dim ? { orderBys: [dim === 'date' ? { dimension: { dimensionName: 'date' } } : { metric: { metricName: 'sessions' }, desc: true }] } : {}),
      });
      const rows = (j.rows || []).map((r) => ({ ...(dim ? { [i.group_by]: r.dimensionValues?.[0]?.value } : {}), sessions: +r.metricValues[0].value, engaged_sessions: +r.metricValues[1].value, key_events: +r.metricValues[2].value, revenue: +r.metricValues[3].value }));
      return `Analytics 4, property ${prop}, organic search only, ${start} to ${end} (${rows.length} rows):\n${JSON.stringify(rows)}`;
    },
  },
  serp_search: {
    src: 'serp', paid: true,
    def: { name: 'serp_search', description: 'Paid lookup. The live Google results for one keyword: top organic results with URL, title and snippet, which SERP features appear, and People Also Ask questions.', eager_input_streaming: true, input_schema: obj({ keyword: { type: 'string' } }, ['keyword']) },
    async run(i) {
      if (typeof i.keyword !== 'string' || !i.keyword.trim()) throw new Error('keyword must be a non-empty string.');
      return P.serpSearch(i.keyword.trim().slice(0, 200));
    },
  },
  dfs_keyword_ideas: {
    src: 'dfs', paid: true,
    def: { name: 'dfs_keyword_ideas', description: 'Paid lookup. Expand 1 to 5 seed keywords into related keywords with monthly search volume, difficulty and intent.', eager_input_streaming: true, input_schema: obj({ seeds: { type: 'array', items: { type: 'string' } }, limit: { type: 'integer', description: '1 to 100, default 50' } }, ['seeds']) },
    async run(i) {
      const seeds = strList(i.seeds, 5); if (!seeds) throw new Error('seeds must be 1 to 5 non-empty strings.');
      const { result, ...m } = await dfsCall('dataforseo_labs/google/keyword_ideas/live', { keywords: seeds, ...geo(), limit: clampInt(i.limit, 1, 100, 50) }, 'dfs_keyword_ideas');
      const rows = (result[0]?.items || []).map((k) => ({ keyword: k.keyword, volume: k.keyword_info?.search_volume, cpc: k.keyword_info?.cpc, competition: k.keyword_info?.competition_level, difficulty: k.keyword_properties?.keyword_difficulty, intent: k.search_intent_info?.main_intent }));
      return { text: shaped(rows, result), ...m };
    },
  },
  dfs_search_volume: {
    src: 'dfs', paid: true,
    def: { name: 'dfs_search_volume', description: 'Paid lookup. Monthly Google search volume, CPC and competition for up to 100 exact keywords.', eager_input_streaming: true, input_schema: obj({ keywords: { type: 'array', items: { type: 'string' } } }, ['keywords']) },
    async run(i) {
      const kws = strList(i.keywords, 100); if (!kws) throw new Error('keywords must be 1 to 100 non-empty strings.');
      const { result, ...m } = await dfsCall('keywords_data/google_ads/search_volume/live', { keywords: kws, ...geo() }, 'dfs_search_volume');
      const rows = (result || []).map((k) => ({ keyword: k.keyword, volume: k.search_volume, cpc: k.cpc, competition: k.competition }));
      return { text: shaped(rows, result), ...m };
    },
  },
  dfs_serp: {
    src: 'dfs', paid: true,
    def: { name: 'dfs_serp', description: 'Paid lookup. The live Google results for one keyword: top organic results with URL, title and snippet, plus which SERP features appear.', eager_input_streaming: true, input_schema: obj({ keyword: { type: 'string' } }, ['keyword']) },
    async run(i) {
      if (typeof i.keyword !== 'string' || !i.keyword.trim()) throw new Error('keyword must be a non-empty string.');
      const { result, ...m } = await dfsCall('serp/google/organic/live/regular', { keyword: i.keyword.trim().slice(0, 200), ...geo(), depth: 20 }, 'dfs_serp');
      const r0 = result[0] || {};
      const rows = (r0.items || []).filter((x) => x.type === 'organic').slice(0, 20).map((x) => ({ position: x.rank_absolute, url: x.url, title: x.title, snippet: x.description }));
      return { text: `SERP features present: ${(r0.item_types || []).join(', ') || 'unknown'}\n` + shaped(rows, result), ...m };
    },
  },
  dfs_ranked_keywords: {
    src: 'dfs', paid: true,
    def: { name: 'dfs_ranked_keywords', description: 'Paid lookup. Keywords a domain ranks for in Google, with position, URL and search volume. Works for the site under review and for competitors.', eager_input_streaming: true, input_schema: obj({ domain: { type: 'string', description: 'Bare domain, e.g. example.com' }, limit: { type: 'integer', description: '1 to 100, default 50' } }, ['domain']) },
    async run(i) {
      const target = domain(i.domain); if (!target) throw new Error('domain must be a bare domain such as example.com.');
      const { result, ...m } = await dfsCall('dataforseo_labs/google/ranked_keywords/live', { target, ...geo(), limit: clampInt(i.limit, 1, 100, 50), order_by: ['keyword_data.keyword_info.search_volume,desc'] }, 'dfs_ranked_keywords');
      const rows = (result[0]?.items || []).map((k) => ({ keyword: k.keyword_data?.keyword, volume: k.keyword_data?.keyword_info?.search_volume, position: k.ranked_serp_element?.serp_item?.rank_absolute, url: k.ranked_serp_element?.serp_item?.url }));
      return { text: shaped(rows, result), ...m };
    },
  },
  dfs_backlinks_summary: {
    src: 'dfs', paid: true,
    def: { name: 'dfs_backlinks_summary', description: 'Paid lookup. Backlink profile totals for a domain: backlinks, referring domains, broken links and related counts.', eager_input_streaming: true, input_schema: obj({ domain: { type: 'string' } }, ['domain']) },
    async run(i) {
      const target = domain(i.domain); if (!target) throw new Error('domain must be a bare domain such as example.com.');
      const { result, ...m } = await dfsCall('backlinks/summary/live', { target, include_subdomains: true }, 'dfs_backlinks_summary');
      return { text: JSON.stringify(result[0] ?? result).slice(0, 6000), ...m };
    },
  },
  dfs_referring_domains: {
    src: 'dfs', paid: true,
    def: { name: 'dfs_referring_domains', description: 'Paid lookup. The domains that link to a domain, strongest first, with backlink counts and first-seen dates.', eager_input_streaming: true, input_schema: obj({ domain: { type: 'string' }, limit: { type: 'integer', description: '1 to 100, default 50' } }, ['domain']) },
    async run(i) {
      const target = domain(i.domain); if (!target) throw new Error('domain must be a bare domain such as example.com.');
      const { result, ...m } = await dfsCall('backlinks/referring_domains/live', { target, limit: clampInt(i.limit, 1, 100, 50), order_by: ['rank,desc'] }, 'dfs_referring_domains');
      const rows = (result[0]?.items || []).map((d) => ({ domain: d.domain, rank: d.rank, backlinks: d.backlinks, first_seen: d.first_seen, lost_date: d.lost_date }));
      return { text: shaped(rows, result), ...m };
    },
  },
};

const ready = (src) => { const s = status(); return src === 'dfs' ? s.dfsReady : Boolean(s[src]); };
export const toolsFor = (agent) => Object.values(TOOLS).filter((t) => agent.src.includes(t.src) && ready(t.src)).map((t) => t.def);
export function rulesFor(agent) {
  const mine = Object.values(TOOLS).filter((t) => agent.src.includes(t.src) && ready(t.src));
  if (!mine.length) return '';
  return `\n- You also have read-only data tools: ${mine.map((t) => t.def.name).join(', ')}. Prefer data the user supplied; call a tool only for what is missing. Name the tool as the source of any figure it gave you.` +
    (mine.some((t) => t.paid) ? `\n- Tools whose description starts with "Paid lookup" cost money: at most ${PAID_PER_RUN} per run. Batch keywords into one call and never repeat a lookup.` : '');
}
// ctx: { paid: number } per run. Returns the tool-result text; throws on failure.
export async function callTool(agent, name, input, ctx, send) {
  const t = TOOLS[name];
  if (!t || !agent.src.includes(t.src) || !ready(t.src)) throw new Error('That tool is not available to this agent.');
  if (!input || typeof input !== 'object') throw new Error('INVALID_JSON: input must be an object.');
  if (t.paid) {
    if (ctx.paid >= PAID_PER_RUN) throw new Error(`Limit of ${PAID_PER_RUN} paid lookups per run reached. Finish with what you have.`);
    ctx.paid++;
  }
  send({ type: 'status', text: `${t.paid ? 'Paid lookup' : 'Reading'}: ${name.replace(/_/g, ' ')}` });
  const out = await t.run(input);
  if (typeof out === 'string') return out;
  if (out.cached) ctx.paid--; // served from the 24-hour cache: free
  return `${out.cached ? '(from cache, no charge)' : (out.cost != null ? `(cost $${out.cost})` : '(1 search used)')}\n${out.text}`;
}
export const isConnectorTool = (name) => Object.hasOwn(TOOLS, name);

/* ---------- reports ---------- */
async function gscReport(days) {
  const end = Date.now() - 3 * DAY;
  const cur = { start: ymd(end - (days - 1) * DAY), end: ymd(end) };
  const prev = { start: ymd(end - (2 * days - 1) * DAY), end: ymd(end - days * DAY) };
  const q = (r, dim, rowLimit) => gscQuery({ startDate: r.start, endDate: r.end, dimensions: [dim], rowLimit });
  const [dc, dp, pc, pp, qc] = await Promise.all([q(cur, 'date', days), q(prev, 'date', days), q(cur, 'page', 500), q(prev, 'page', 500), q(cur, 'query', 1000)]);
  const byDate = (j, r) => { const m = new Map((j.rows || []).map((x) => [x.keys[0], x])); return Array.from({ length: days }, (_, i) => m.get(ymd(Date.parse(r.start) + i * DAY)) || { clicks: 0, impressions: 0, position: 0 }); };
  const totals = (rows) => { const c = rows.reduce((s, x) => s + x.clicks, 0), im = rows.reduce((s, x) => s + x.impressions, 0); return { clicks: c, impressions: im, ctr: im ? c / im * 100 : 0, position: im ? rows.reduce((s, x) => s + x.position * x.impressions, 0) / im : 0 }; };
  const a = byDate(dc, cur), b = byDate(dp, prev);
  const buckets = [['1–3', 0, 3.5], ['4–10', 3.5, 10.5], ['11–20', 10.5, 20.5], ['21–50', 20.5, 50.5], ['51+', 50.5, Infinity]].map(([k, lo, hi]) => ({ k, v: (qc.rows || []).filter((x) => x.position >= lo && x.position < hi).length }));
  const before = new Map((pp.rows || []).map((x) => [x.keys[0], x.clicks]));
  const now = new Map((pc.rows || []).map((x) => [x.keys[0], x.clicks]));
  const path = (u) => { try { return new URL(u).pathname || '/'; } catch { return u; } };
  const moves = [...new Set([...before.keys(), ...now.keys()])].map((u) => ({ k: path(u), v: (now.get(u) || 0) - (before.get(u) || 0) })).filter((m) => m.v !== 0).sort((x, y) => y.v - x.v);
  return { site: get('gsc_site'), days, range: cur, previous: prev, unit: 'Day', cur: a.map((x) => x.clicks), prev: b.map((x) => x.clicks), totals: totals(a), totalsPrev: totals(b), positions: buckets, queryRows: (qc.rows || []).length, movers: [...moves.slice(0, 5), ...moves.slice(-5).filter((m) => m.v < 0 && !moves.slice(0, 5).includes(m))] };
}

/* ---------- routes ---------- */
export function routes(app, { port, state }) {
  const redirectUri = () => `${(process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/+$/, '')}/oauth/google/callback`;
  const pending = new Map(); // state -> expiry
  const fail = (res, e, code = 400) => res.status(code).json({ error: e.message || String(e) });
  P.routes(app, { state, fail });

  app.get('/oauth/google/start', (req, res) => {
    if (!googleConfigured()) return res.status(400).send('Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env and restart the server first.');
    const s = crypto.randomBytes(24).toString('hex');
    pending.set(s, Date.now() + 600000);
    res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(), response_type: 'code', scope: GOOGLE_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state: s }));
  });
  app.get('/oauth/google/callback', async (req, res) => {
    const s = String(req.query.state || '');
    const ok = pending.has(s) && pending.get(s) > Date.now();
    pending.delete(s);
    if (!ok) return res.status(400).send('This sign-in link expired or was not started here. Go back to Connections and try again.');
    if (req.query.error || !req.query.code) return res.redirect('/#connections');
    try {
      const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: String(req.query.code), client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(), grant_type: 'authorization_code' }), signal: AbortSignal.timeout(20000) });
      const j = await r.json();
      if (!r.ok || !j.refresh_token) throw new Error(j.error_description || j.error || 'Google did not return a refresh token.');
      set('google_refresh', j.refresh_token);
      access = { token: j.access_token, exp: Date.now() + (j.expires_in || 3000) * 1000 };
      res.redirect('/#connections');
    } catch (e) { res.status(502).send('Google sign-in failed: ' + e.message); }
  });
  app.post('/api/connections/google/disconnect', async (req, res) => {
    const refresh = get('google_refresh');
    if (refresh) fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refresh }), signal: AbortSignal.timeout(10000) }).catch(() => {});
    del('google_refresh'); del('google_service'); del('gsc_site'); del('ga4_property'); access = null;
    res.json(state());
  });
  app.get('/api/connections/google/options', async (req, res) => {
    const out = { sites: [], properties: [], errors: [] };
    await Promise.all([
      gfetch('https://www.googleapis.com/webmasters/v3/sites').then((j) => { out.sites = (j.siteEntry || []).filter((s) => s.permissionLevel !== 'siteUnverifiedUser').map((s) => s.siteUrl).sort(); }).catch((e) => out.errors.push('Search Console: ' + e.message)),
      gfetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200').then((j) => { out.properties = (j.accountSummaries || []).flatMap((a) => (a.propertySummaries || []).map((p) => ({ id: p.property.replace('properties/', ''), name: `${p.displayName} (${a.displayName})` }))); }).catch((e) => out.errors.push('Analytics: ' + e.message)),
    ]);
    res.json(out);
  });
  app.put('/api/connections/settings', (req, res) => {
    const b = req.body || {};
    if ('gscSite' in b) (b.gscSite ? set('gsc_site', String(b.gscSite).slice(0, 300)) : del('gsc_site'));
    if ('ga4Property' in b) {
      if (b.ga4Property && !/^\d{1,20}$/.test(String(b.ga4Property))) return res.status(400).json({ error: 'The Analytics property ID is a number.' });
      b.ga4Property ? set('ga4_property', String(b.ga4Property)) : del('ga4_property');
    }
    if ('dfsCap' in b) { const n = Number(b.dfsCap); if (!(n >= 0 && n <= 10000)) return res.status(400).json({ error: 'The monthly cap must be between 0 and 10000 dollars.' }); set('dfs_cap', n); }
    if ('dfsLocation' in b) { const n = Number(b.dfsLocation); if (!Number.isInteger(n) || n < 1) return res.status(400).json({ error: 'The location code must be a whole number, for example 2840 for the United States.' }); set('dfs_location', n); }
    if ('dfsLanguage' in b) { if (!/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(String(b.dfsLanguage))) return res.status(400).json({ error: 'The language code looks like en or pt-BR.' }); set('dfs_language', b.dfsLanguage); }
    res.json(state());
  });
  // Secrets entered in the app. They are written to the local database and never sent back to the browser.
  app.put('/api/connections/credentials', async (req, res) => {
    const b = req.body || {};
    const str = (v, max) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
    if ('anthropicKey' in b) {
      const k = str(b.anthropicKey, 400);
      if (!k || !/^sk-ant-[\w-]{20,}$/.test(k)) return res.status(400).json({ error: 'That does not look like an Anthropic API key. It starts with sk-ant-.' });
      set('anthropic_key', k);
    }
    if ('dfsLogin' in b || 'dfsPassword' in b) {
      const login = str(b.dfsLogin, 200), password = typeof b.dfsPassword === 'string' && b.dfsPassword && b.dfsPassword.length <= 200 ? b.dfsPassword : null;
      if (!login || !password) return res.status(400).json({ error: 'Enter both the API login and the API password.' });
      const before = [get('dfs_login'), get('dfs_password')];
      set('dfs_login', login); set('dfs_password', password);
      try { await dfsCall('appendix/user_data', null, 'test'); }
      catch (e) { before[0] && before[1] ? (set('dfs_login', before[0]), set('dfs_password', before[1])) : (del('dfs_login'), del('dfs_password')); return fail(res, e); }
    }
    res.json(state());
  });
  app.delete('/api/connections/credentials/:which', (req, res) => {
    if (req.params.which === 'claude') del('anthropic_key');
    else if (req.params.which === 'dfs') { del('dfs_login'); del('dfs_password'); }
    else if (P.removeCredential(req.params.which)) { /* removed */ }
    else return res.status(404).json({ error: 'Not found.' });
    res.json(state());
  });
  app.put('/api/connections/google/service', async (req, res) => {
    let key;
    try { key = JSON.parse(String(req.body?.json || '')); } catch { return res.status(400).json({ error: 'Paste the whole contents of the JSON key file. This text is not valid JSON.' }); }
    if (!key || key.type !== 'service_account' || typeof key.client_email !== 'string' || typeof key.private_key !== 'string') return res.status(400).json({ error: 'This is not a service account key file. It should contain "type": "service_account", a client_email and a private_key.' });
    const sa = { client_email: key.client_email.slice(0, 300), private_key: key.private_key.slice(0, 5000) };
    try { access = await serviceToken(sa); } catch (e) { access = null; return fail(res, e); }
    set('google_service', JSON.stringify(sa)); del('google_refresh');
    res.json(state());
  });
  app.post('/api/connections/dfs/test', async (req, res) => {
    try { const { result } = await dfsCall('appendix/user_data', null, 'test'); res.json({ ok: true, balance: result[0]?.money?.balance ?? null }); } catch (e) { fail(res, e); }
  });
  app.get('/api/reports/gsc', async (req, res) => {
    const days = [7, 28, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 28;
    if (!status().gsc) return res.status(400).json({ error: 'Search Console is not connected.' });
    try { const key = `report:${get('gsc_site')}:${days}:${ymd(Date.now())}`; let r = cached(key); if (!r) { r = await gscReport(days); remember(key, r); } res.json(r); } catch (e) { fail(res, e, 502); }
  });
}
