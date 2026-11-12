// Extra providers: other AI models (through their OpenAI-compatible endpoints) and search-result sources.
let H; // { get, set, del, cached, remember, db } from connectors.js
let DEFAULT_MODEL = 'claude-opus-5-5';
export function init(helpers, defaults = {}) { H = helpers; if (defaults.model) DEFAULT_MODEL = defaults.model; }

/* ---------- AI model providers ---------- */
export const LLM = {
  anthropic: { name: 'Claude (Anthropic)', hint: 'sk-ant-…' },
  openai: { name: 'ChatGPT (OpenAI)', base: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''), env: 'OPENAI_API_KEY', hint: 'sk-…' },
  gemini: { name: 'Gemini (Google)', base: 'https://generativelanguage.googleapis.com/v1beta/openai', env: 'GEMINI_API_KEY', hint: 'Google AI Studio key' },
  groq: { name: 'Groq', base: 'https://api.groq.com/openai/v1', env: 'GROQ_API_KEY', hint: 'gsk_…' },
  openrouter: { name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', env: 'OPENROUTER_API_KEY', hint: 'sk-or-…' },
};
const savedKey = (p) => H.get(p === 'anthropic' ? 'anthropic_key' : 'key_' + p);
const keyOf = (p) => savedKey(p) || (p === 'anthropic' ? process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN : process.env[LLM[p].env]) || null;
const modelOf = (p) => H.get('llm_model_' + p) || (p === 'anthropic' ? DEFAULT_MODEL : null);
export function llm() {
  const provider = LLM[H.get('llm_provider')] ? H.get('llm_provider') : 'anthropic';
  return { provider, name: LLM[provider].name, base: LLM[provider].base, key: keyOf(provider), model: modelOf(provider), savedKey: provider === 'anthropic' ? savedKey('anthropic') : null };
}
export const llmReady = () => { const l = llm(); return Boolean(l.key && l.model); };
export const llmStatus = () => {
  const l = llm();
  return { active: l.provider, name: l.name, model: l.model, providers: Object.fromEntries(Object.keys(LLM).map((p) => [p, { name: LLM[p].name, hint: LLM[p].hint, source: savedKey(p) ? 'app' : keyOf(p) ? 'env' : null, model: modelOf(p) }])) };
};
async function listModels(p, key) {
  const r = await fetch(LLM[p].base + '/models', { headers: { authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(20000) });
  if (r.status === 401 || r.status === 403) throw new Error(`${LLM[p].name} rejected that API key.`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${LLM[p].name} API ${r.status}: ${j.error?.message || 'could not list models'}`);
  return (j.data || []).map((m) => String(m.id || '').replace(/^models\//, '')).filter(Boolean).sort();
}

/* ---------- search results: SerpApi and Bright Data ---------- */
const serpapiKey = () => H.get('serpapi_key') || process.env.SERPAPI_API_KEY || null;
const bright = () => {
  const token = H.get('bright_token') || process.env.BRIGHTDATA_API_TOKEN || null;
  return token ? { token, serpZone: H.get('bright_serp_zone') || process.env.BRIGHTDATA_SERP_ZONE || null, unlockZone: H.get('bright_unlock_zone') || process.env.BRIGHTDATA_UNLOCKER_ZONE || null } : null;
};
const geo = () => ({ gl: H.get('serp_gl') || 'us', hl: H.get('serp_hl') || 'en' });
const monthStart = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
export const serpReady = () => Boolean(serpapiKey() || bright()?.serpZone);
export const canUnlock = () => Boolean(bright()?.unlockZone);
export function serpInfo() {
  const b = bright();
  const used = (src) => H.db.prepare('SELECT COUNT(*) AS n FROM spend WHERE source = ? AND at >= ?').get(src, monthStart()).n;
  return {
    ...geo(),
    serpapi: { configured: Boolean(serpapiKey()), source: H.get('serpapi_key') ? 'app' : serpapiKey() ? 'env' : null, used: used('serpapi') },
    bright: { configured: Boolean(b), source: H.get('bright_token') ? 'app' : b ? 'env' : null, serpZone: b?.serpZone || null, unlockZone: b?.unlockZone || null, used: used('bright') },
    active: serpapiKey() ? 'SerpApi' : b?.serpZone ? 'Bright Data' : null,
  };
}
async function brightRequest(zone, url) {
  const r = await fetch('https://api.brightdata.com/request', { method: 'POST', headers: { authorization: 'Bearer ' + bright().token, 'content-type': 'application/json' }, body: JSON.stringify({ zone, url, format: 'raw' }), signal: AbortSignal.timeout(60000) });
  const text = await r.text();
  if (r.status === 401 || r.status === 403) throw new Error('Bright Data rejected the API token or the zone name.');
  if (!r.ok) throw new Error(`Bright Data ${r.status}: ${text.slice(0, 200)}`);
  return text;
}
export const unlock = (url) => brightRequest(bright().unlockZone, url);

// Returns { text, cached }. One search per call; results are cached for 24 hours.
export async function serpSearch(keyword) {
  const { gl, hl } = geo();
  const via = serpapiKey() ? 'serpapi' : 'bright';
  const key = `serp:${via}:${gl}:${hl}:${keyword.toLowerCase()}`;
  const hit = H.cached(key);
  if (hit) return { text: hit, cached: true };
  let rows, features, questions = [];
  if (via === 'serpapi') {
    const r = await fetch('https://serpapi.com/search.json?' + new URLSearchParams({ engine: 'google', q: keyword, gl, hl, num: '20', api_key: serpapiKey() }), { signal: AbortSignal.timeout(60000) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error('SerpApi rejected the API key.');
    if (!r.ok || j.error) throw new Error('SerpApi: ' + (j.error || 'request failed (' + r.status + ')'));
    rows = (j.organic_results || []).map((x) => ({ position: x.position, url: x.link, title: x.title, snippet: x.snippet }));
    features = ['ai_overview', 'answer_box', 'knowledge_graph', 'related_questions', 'local_results', 'shopping_results', 'inline_videos', 'top_stories', 'inline_images', 'ads'].filter((k) => j[k]);
    questions = (j.related_questions || []).map((q) => q.question).filter(Boolean).slice(0, 8);
  } else {
    const text = await brightRequest(bright().serpZone, 'https://www.google.com/search?' + new URLSearchParams({ q: keyword, gl, hl, num: '20', brd_json: '1' }));
    let j; try { j = JSON.parse(text); } catch { throw new Error('Bright Data did not return parsed results. Check that the zone is a SERP API zone.'); }
    rows = (j.organic || []).map((x) => ({ position: x.rank ?? x.global_rank, url: x.link, title: x.title, snippet: x.description }));
    features = Object.keys(j).filter((k) => !['general', 'input', 'organic', 'pagination', 'navigation', 'related'].includes(k));
    questions = (j.people_also_ask || []).map((q) => q.question).filter(Boolean).slice(0, 8);
  }
  H.db.prepare('INSERT INTO spend (source, tool, cost, at) VALUES (?, ?, 0, ?)').run(via, 'serp_search', Date.now());
  const out = `Google results for "${keyword}" (country ${gl}, language ${hl}) via ${via === 'serpapi' ? 'SerpApi' : 'Bright Data'}\nSERP features present: ${features.join(', ') || 'none reported'}\n${questions.length ? 'People also ask: ' + questions.join(' | ') + '\n' : ''}Organic results: ${JSON.stringify(rows.slice(0, 20))}`;
  H.remember(key, out);
  return { text: out, cached: false };
}

/* ---------- removing stored credentials ---------- */
export function removeCredential(which) {
  if (LLM[which] && which !== 'anthropic') { H.del('key_' + which); return true; }
  if (which === 'serpapi') { H.del('serpapi_key'); return true; }
  if (which === 'bright') { H.del('bright_token'); H.del('bright_serp_zone'); H.del('bright_unlock_zone'); return true; }
  return false;
}

/* ---------- routes ---------- */
export function routes(app, { state, fail }) {
  const str = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);

  app.put('/api/connections/llm', async (req, res) => {
    const b = req.body || {}, p = b.provider;
    if (!LLM[p]) return res.status(400).json({ error: 'Unknown provider.' });
    const key = b.key == null || b.key === '' ? null : str(b.key, 400);
    if (b.key && !key) return res.status(400).json({ error: 'That API key is not valid text.' });
    const model = b.model == null || b.model === '' ? null : str(b.model, 120);
    if (model && !/^[\w.:\/@-]+$/.test(model)) return res.status(400).json({ error: 'A model ID has no spaces, for example the name shown in the provider’s model list.' });
    if (key) {
      if (p === 'anthropic') { if (!/^sk-ant-[\w-]{20,}$/.test(key)) return res.status(400).json({ error: 'That does not look like an Anthropic API key. It starts with sk-ant-.' }); }
      else { try { await listModels(p, key); } catch (e) { return fail(res, e); } }
      H.set(p === 'anthropic' ? 'anthropic_key' : 'key_' + p, key);
    }
    if (!keyOf(p)) return res.status(400).json({ error: `Enter an API key for ${LLM[p].name}.` });
    if (model) H.set('llm_model_' + p, model);
    else if (p === 'anthropic') H.del('llm_model_anthropic');
    if (!modelOf(p)) return res.status(400).json({ error: 'Choose a model. Press “Load model list”, or type the model ID.' });
    H.set('llm_provider', p);
    res.json(state());
  });
  app.get('/api/connections/llm/models', async (req, res) => {
    const p = String(req.query.provider || '');
    if (!LLM[p] || p === 'anthropic') return res.status(400).json({ error: 'Model lists are available for the other providers only.' });
    if (!keyOf(p)) return res.status(400).json({ error: 'Save an API key for this provider first.' });
    try { res.json({ models: await listModels(p, keyOf(p)) }); } catch (e) { fail(res, e, 502); }
  });

  app.put('/api/connections/serp', async (req, res) => {
    const b = req.body || {};
    for (const k of ['gl', 'hl']) if (k in b && !/^[a-z]{2}(-[a-z]{2})?$/i.test(String(b[k]))) return res.status(400).json({ error: 'Country and language are two-letter codes, for example us and en.' });
    if ('serpapiKey' in b) {
      const key = str(b.serpapiKey, 200);
      if (!key) return res.status(400).json({ error: 'Enter the SerpApi key.' });
      try {
        const r = await fetch('https://serpapi.com/account.json?' + new URLSearchParams({ api_key: key }), { signal: AbortSignal.timeout(20000) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.error) throw new Error('SerpApi rejected that key' + (j.error ? ': ' + j.error : '.'));
      } catch (e) { return fail(res, e); }
      H.set('serpapi_key', key);
    }
    if ('brightToken' in b || 'brightSerpZone' in b || 'brightUnlockZone' in b) {
      const token = str(b.brightToken, 400) || H.get('bright_token');
      const zone = (v) => (v == null || v === '' ? '' : /^[\w-]{1,80}$/.test(String(v).trim()) ? String(v).trim() : null);
      const sz = zone(b.brightSerpZone), uz = zone(b.brightUnlockZone);
      if (!token) return res.status(400).json({ error: 'Enter the Bright Data API token.' });
      if (sz === null || uz === null) return res.status(400).json({ error: 'A zone name uses letters, numbers, underscores and dashes only.' });
      if (!sz && !uz) return res.status(400).json({ error: 'Enter at least one zone name: a SERP API zone, a Web Unlocker zone, or both.' });
      try {
        const r = await fetch('https://api.brightdata.com/zone/get_active_zones', { headers: { authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(20000) });
        if (r.status === 401 || r.status === 403) throw new Error('Bright Data rejected that API token.');
        if (r.ok) {
          const names = ((await r.json().catch(() => [])) || []).map((z) => z.name);
          const missing = [sz, uz].filter((z) => z && names.length && !names.includes(z));
          if (missing.length) throw new Error(`Bright Data has no active zone named ${missing.join(' or ')}. Your active zones: ${names.join(', ')}.`);
        }
      } catch (e) { return fail(res, e); }
      H.set('bright_token', token);
      sz ? H.set('bright_serp_zone', sz) : H.del('bright_serp_zone');
      uz ? H.set('bright_unlock_zone', uz) : H.del('bright_unlock_zone');
    }
    if ('gl' in b) H.set('serp_gl', String(b.gl).toLowerCase());
    if ('hl' in b) H.set('serp_hl', String(b.hl).toLowerCase());
    res.json(state());
  });
}
