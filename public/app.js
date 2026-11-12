/* Nineteen front end. All data comes from the local server; nothing here is sample data. */
const SRC = { gsc: 'Search Console', ga4: 'Analytics', dfs: 'DataForSEO', serp: 'Google results', gbp: 'Business Profile' };
let llmSel = null; // provider being edited on the Connections page
const handoffFrom = (a) => (a.from !== undefined ? a.from : a.id > 1 && a.id <= 19 ? a.id - 1 : null);
const GROUPS = { plan: 'Plan', content: 'Content', audit: 'Audit', report: 'Report' };
const EV = { verified: ['Verified', 'good'], assumption: ['Assumption', 'warn'], needs_check: ['Needs check', 'crit'] };
const BK = { first: ['Fix first', '--s1'], then: ['Then', '--s2'], later: ['Later', '--s3'] };
const SITE_FIELDS = [['url', 'Site address', 'https://example.com/'], ['business', 'Business and what it sells', ''], ['audience', 'Audience', 'Who buys or reads'], ['goal', 'Business goal', 'e.g. more quote requests in 6 months'], ['country', 'Country and language', 'e.g. United States · English'], ['competitors', 'Competitors', 'Comma-separated domains'], ['hours', 'Team hours per month', '']];
const PREFILL = { 'Site URL': 'url', 'Business and what it sells': 'business', Audience: 'audience', 'Business goal': 'goal', Goal: 'goal', Competitors: 'competitors', 'Competitor domains': 'competitors', 'Country and language': 'country', 'Team hours per month': 'hours', Capacity: 'hours' };
const LONG = /export|data|list|report|brief|results|answers|facts|markup|navigation|profile|performance|state|completed|queries|avoid/i;

let S = null;
const live = {}; // agentId -> { ctrl, lines: [] } while a run is streaming
const agent = (id) => S.agents.find((a) => a.id === id);
const openCount = () => S.findings.filter((f) => f.status === 'open').length;

function toast(t) { $$('.toast').forEach((e) => e.remove()); const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2600); }
function countUp(root) { $$('[data-n]', root).forEach((el) => { const to = +el.dataset.n; if (reduce || !to) { el.textContent = fmt(to); return; } const t0 = performance.now(); (function f(t) { const k = Math.min(1, (t - t0) / 600), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(f); })(t0); }); }
const tblHtml = (cols, rows) => `<div class="tblwrap"><table><thead><tr>${cols.map((c, i) => `<th class="${i ? 'r' : ''}">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i ? 'r' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const chartCard = (id, title, sub, legend, table) => `<section class="card"><div class="chead"><div><h2>${title}</h2><p>${sub}</p></div><button class="btn sm" aria-pressed="false" data-tbl="${id}">Table</button></div>${legend ? `<div class="legend">${legend}</div>` : ''}<div class="chart" id="${id}"></div><div id="${id}-t" hidden>${table}</div></section>`;
const statusChip = (a) => ({ idle: `<span class="tag"><span class="dot"></span>${a.runs ? 'Idle' : 'Not run yet'}</span>`, run: `<span class="tag"><span class="dot run"></span>Running</span>`, review: `<span class="tag"><span class="dot good"></span>Needs review</span>` }[live[a.id] ? 'run' : a.status]);
const evTag = (e) => `<span class="tag"><span class="dot ${EV[e][1]}"></span>${EV[e][0]}</span>`;
const noSite = () => `<div class="note">Add your site first so the agents know what they are working on. <a href="#site" style="color:var(--accent)">Open the Site page</a></div>`;

/* ---------- views ---------- */
const V = {};

V.overview = () => {
  const ran = S.agents.filter((a) => a.runs).length, appr = S.findings.filter((f) => f.status === 'approved').length;
  const tiles = [['Agents run', ran, 'of ' + S.agents.length], ['Findings to review', openCount(), 'open'], ['Approved for the plan', appr, 'items'], ['Runs so far', S.runs.length, S.runs.length === 30 ? 'latest 30' : 'total']];
  return `<div class="head"><div><h1>Overview</h1><p>${S.site ? 'Where the work on ' + esc(new URL(S.site.url).hostname) + ' stands, and what is waiting for your decision.' : 'One job per agent. Start by adding your site.'}</p></div></div>
  ${S.site ? '' : noSite()}
  <div class="grid g5 stag">${tiles.map((t, i) => `<div class="card tile" style="--i:${i}"><span class="lbl">${t[0]}</span><div class="row"><span class="v" data-n="${t[1]}">${t[1]}</span><span class="muted">${t[2]}</span></div></div>`).join('')}</div>
  ${S.findings.length ? `<div class="grid g2">
    ${chartCard('c-byagent', 'Findings by agent', 'All findings that have not been dismissed', '', tblHtml(['Agent', 'Findings'], byAgent().map((r) => [r.k, r.v])))}
    <section class="card"><div class="chead"><div><h2>Waiting for your review</h2><p>${openCount()} open finding${openCount() === 1 ? '' : 's'}</p></div><a class="btn sm" href="#review">Open queue</a></div>
     ${S.findings.filter((f) => f.status === 'open').slice(0, 5).map((f) => `<div style="display:flex;gap:10px;justify-content:space-between;align-items:flex-start;border-top:1px solid var(--line);padding-top:9px"><div style="min-width:0"><div style="font-weight:500">${esc(f.title)}</div><div class="muted" style="font-size:12px">${agent(f.agent_id).role} · impact ${f.impact}, effort ${f.effort}</div></div>${evTag(f.evidence)}</div>`).join('') || '<span class="muted">Nothing is waiting.</span>'}</section></div>` : S.site ? `<div class="note">No findings yet. Open <a href="#agents" style="color:var(--accent)">Agents</a> and run the Strategist first, or press <span class="mono">/</span> and type an agent name.</div>` : ''}
  ${S.runs.length ? `<section class="card"><h2>Recent runs</h2><div class="tblwrap"><table><thead><tr><th>Agent</th><th>Result</th><th class="r">Pages read</th><th class="r">Tokens in</th><th class="r">Tokens out</th><th class="r">When</th></tr></thead><tbody>
    ${S.runs.slice(0, 8).map((r) => `<tr><td><a href="#run" data-run="${r.agent_id}" style="color:var(--accent);text-decoration:none">${pad(r.agent_id)} ${agent(r.agent_id).name}</a>${r.mock ? ' <span class="tag">Mock</span>' : ''}</td><td>${runTag(r)}</td><td class="r">${r.fetches}</td><td class="r">${fmt(r.in_tokens)}</td><td class="r">${fmt(r.out_tokens)}</td><td class="r">${rel(r.created_at)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
};
const runTag = (r) => `<span class="tag" ${r.error ? `data-tip="${esc(r.error)}" tabindex="0"` : ''}><span class="dot ${{ done: 'good', failed: 'crit', stopped: 'warn', running: 'run' }[r.status] || ''}"></span>${{ done: 'Finished', failed: 'Failed', stopped: 'Stopped', running: 'Running' }[r.status] || r.status}</span>`;
const byAgent = () => { const m = {}; S.findings.filter((f) => f.status !== 'dismissed').forEach((f) => m[f.agent_id] = (m[f.agent_id] || 0) + 1); return Object.entries(m).map(([id, v]) => ({ k: agent(+id).role, v })).sort((a, b) => b.v - a.v).slice(0, 10); };
V.overview.after = () => mount('c-byagent', (el, w) => hbar(el, w, byAgent(), { unit: 'findings', label: 'Findings by agent' }));

V.site = () => { const s = S.site || {};
  return `<div class="head"><div><h1>Site</h1><p>The profile every agent starts from. Agents prefill their inputs from it, and you can still change them per run.</p></div></div>
  <form class="card" id="siteform" style="max-width:720px">${SITE_FIELDS.map(([k, l, ph]) => `<div class="field"><label class="lbl" for="site-${k}">${l}</label>${k === 'business' || k === 'audience' ? `<textarea id="site-${k}" name="${k}" rows="2" placeholder="${esc(ph)}">${esc(s[k])}</textarea>` : `<input id="site-${k}" name="${k}" value="${esc(s[k])}" placeholder="${esc(ph)}">`}</div>`).join('')}
   <div id="siteerr" class="note bad" hidden></div><div><button class="btn pri" type="submit">Save site</button></div></form>`; };

let agFilter = 'all';
let agQuery = '';
const agMatches = (a) => (agFilter === 'all' || a.group === agFilter) && agQuery.toLowerCase().split(/\s+/).filter(Boolean).map((w) => (w.length > 3 ? w.replace(/s$/, '') : w)).every((w) => [pad(a.id), String(a.id), a.name, a.role, a.job, GROUPS[a.group], ...a.inputs].join(' ').toLowerCase().includes(w));
const agCards = () => { const list = S.agents.filter(agMatches); return list.length ? list.map((a, i) => `<button class="card agent" style="--i:${i}" data-run="${a.id}">
    <div class="chead"><div><span class="n">${pad(a.id)} · ${GROUPS[a.group]}</span><h3>${a.name}</h3></div>${statusChip(a)}</div>
    <div class="job">${esc(a.job)}</div>
    <div class="foot"><span class="chips">${a.src.length ? a.src.map((s) => `<span class="src" data-tip="${connected(s) ? 'Connected: this agent can read it.' : 'Not connected. The agent works from page fetches and what you paste in.'}">${connected(s) ? '● ' : ''}${SRC[s]}</span>`).join('') : '<span class="src">Page fetch only</span>'}</span><span class="muted" style="font-size:12px">${rel(a.last)}</span></div></button>`).join('') : `<p class="muted" style="grid-column:1/-1">No agent matches "${esc(agQuery)}". Try a job (for example "redirects"), a role, or a number.</p>`; };
V.agents = () => `<div class="head"><div><h1>Agents</h1><p>${S.agents.length} agents, one job each. Open one to give it inputs and run it in its own conversation.</p></div>
  <div class="chips" role="group" aria-label="Filter by group">${[['all', 'All ' + S.agents.length], ...Object.entries(GROUPS)].map(([k, l]) => `<button class="btn sm" aria-pressed="${k === agFilter}" data-agf="${k}">${l}</button>`).join('')}</div></div>
  <div class="agsearch"><label class="lbl" for="agq">Search agents</label><input id="agq" type="search" autocomplete="off" placeholder="Name, job, input or number, for example: redirects, 27, reviews" value="${esc(agQuery)}"><span class="muted" id="agcnt" aria-live="polite">${S.agents.filter(agMatches).length} shown</span></div>
  <div class="grid g4 stag" id="aggrid">${agCards()}</div>`;
document.addEventListener('input', (e) => { if (e.target.id !== 'agq') return; agQuery = e.target.value; const g = $('#aggrid'); if (!g) return; g.classList.add('nostag'); g.innerHTML = agCards(); const c = $('#agcnt'); if (c) c.textContent = S.agents.filter(agMatches).length + ' shown'; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && e.target.id === 'agq' && agQuery) { e.target.value = ''; e.target.dispatchEvent(new Event('input', { bubbles: true })); } });

let runId = 1;
V.run = () => { const a = agent(runId), s = S.site || {}, next = a.id < 19 ? agent(a.id + 1) : null, busy = Boolean(live[a.id]);
  return `<div class="head"><div><span class="mono muted">/seo ${a.name.toLowerCase()} · agent ${pad(a.id)}</span><h1>${a.role}</h1><p>${esc(a.job)}. One job only; it hands its output to the next agent.</p></div>
    <div class="chips"><a class="btn" href="#agents">All agents</a><button class="btn" id="stopbtn" ${busy ? '' : 'hidden'}>Stop</button><button class="btn pri" id="runbtn" ${busy ? 'disabled' : ''}>Run agent</button></div></div>
  ${S.site ? '' : noSite()}${S.mock ? '<div class="note">Mock mode: runs return placeholder output and call no model.</div>' : S.hasKey ? '' : '<div class="note bad">No AI model is ready. Add an API key and choose a model on the <a href="#connections" style="color:var(--accent)">Connections</a> page.</div>'}
  <div class="grid g2">
   <form class="card" id="runform"><h2>Inputs</h2>${a.inputs.map((f, i) => { const v = s[PREFILL[f]] || ''; return `<div class="field"><label class="lbl" for="in-${a.id}-${i}">${f}</label>${LONG.test(f) ? `<textarea id="in-${a.id}-${i}" data-in="${esc(f)}" rows="3" placeholder="Paste it here, or leave empty">${esc(v)}</textarea>` : `<input id="in-${a.id}-${i}" data-in="${esc(f)}" value="${esc(v)}" placeholder="Leave empty if unknown">`}</div>`; }).join('')}
     ${a.id === 19 ? `<p class="ink2" style="font-size:13px">The Planner also receives every finding that has not been dismissed (${S.findings.filter((f) => f.status !== 'dismissed').length} now).</p>` : handoffFrom(a) ? `<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="handoff" checked> Include the latest output of the ${agent(handoffFrom(a)).role}, if there is one</label>` : ''}
     <div><span class="lbl">Data it can read</span><div class="chips" style="margin-top:6px"><span class="tag"><span class="dot good"></span>Public pages (up to 8 per run)</span>${a.src.map((x) => `<span class="tag"><span class="dot ${connected(x) ? 'good' : ''}"></span>${SRC[x]}${connected(x) ? '' : ' · not connected'}</span>`).join('')}</div></div></form>
   <section class="card"><div class="chead"><div><h2>Run</h2><p id="runmeta">${busy ? 'Running now' : rel(a.last)}</p></div><span id="runstat">${statusChip(a)}</span></div>
     <div class="bar ${busy ? 'live' : ''}" id="runbar"><i style="width:${busy ? 100 : 0}%"></i></div>
     <div class="stream" id="stream" aria-live="polite">${busy ? live[a.id].lines.join('') : '<span class="muted">Loading the last run…</span>'}</div>
     <div class="chips" id="runfoot" hidden><a class="btn sm" href="#review">Review findings</a>${next ? `<button class="btn sm" type="button" data-run="${next.id}">Send to ${next.role}</button>` : ''}</div></section>
  </div>`; };
V.run.after = async () => { const id = runId; if (live[id]) return;
  let run = null; try { run = (await api('GET', `/api/agents/${id}/last`)).run; } catch (e) { toast(e.message); }
  const st = $('#stream'); if (!st || runId !== id || live[id]) return;
  showRun(run); };
function showRun(run) { const st = $('#stream'); if (!st) return;
  if (!run) { st.innerHTML = '<span class="muted">Run the agent to see its progress and structured output here.</span>'; return; }
  $('#runbar').firstElementChild.style.width = run.status === 'done' ? '100%' : '0%';
  $('#runmeta').textContent = `${rel(run.created_at)} · ${run.mock ? 'mock run' : run.model}${run.status === 'done' ? ` · ${run.fetches} page${run.fetches === 1 ? '' : 's'} read · ${fmt(run.in_tokens)} tokens in, ${fmt(run.out_tokens)} out` : ''}`;
  if (run.status !== 'done') { st.innerHTML = `<div class="note bad">${run.status === 'stopped' ? 'This run was stopped.' : 'This run failed.'} ${esc(run.error || '')}</div>`; return; }
  const o = run.output, fs = S.findings.filter((f) => f.run_id === run.id);
  st.innerHTML = `<div class="ln h">Summary</div><div class="prose" style="font-family:var(--body)">${esc(o.summary)}</div>` +
    o.sections.map((s) => `<div class="ln h">${esc(s.title)}</div><div class="prose">${esc(s.body)}</div>`).join('') +
    `<div class="ln h">Findings (${o.findings.length})</div>` + (o.findings.length ? o.findings.map((f) => `<div style="display:flex;gap:8px;justify-content:space-between;align-items:flex-start;font-family:var(--body);font-size:13px;border-top:1px solid var(--line);padding-top:6px"><span><b style="font-weight:500">${esc(f.title)}</b><br><span class="muted">${esc(f.detail)}${f.source ? ' · Source: ' + esc(f.source) : ''}</span></span>${evTag(f.evidence)}</div>`).join('') : '<span class="muted">None.</span>') +
    `<div class="ln h">Inputs needed</div>` + (o.inputs_needed.length ? `<div class="prose">${o.inputs_needed.map((x) => '• ' + esc(x)).join('\n')}</div>` : '<span class="muted">None.</span>') +
    (o.handoff ? `<div class="ln h">Hand-off</div><div class="prose">${esc(o.handoff)}</div>` : '');
  $('#runfoot').hidden = false; if (fs.length) $('#runfoot a').textContent = `Review ${fs.length} finding${fs.length === 1 ? '' : 's'}`; }

async function startRun() { const a = agent(runId), id = a.id; if (live[id]) return;
  const inputs = {}; $$('[data-in]').forEach((el) => inputs[el.dataset.in] = el.value);
  const ctrl = new AbortController(), L = live[id] = { ctrl, lines: [] }; let cur = null, failed = null;
  const here = () => runId === id && location.hash === '#run' && $('#stream');
  const push = (html) => { L.lines.push(html); const st = here(); if (st) { $$('.caret', st).forEach((e) => e.classList.remove('caret')); st.insertAdjacentHTML('beforeend', html); st.lastElementChild.scrollIntoView({ block: 'nearest' }); return st.lastElementChild; } return null; };
  render();
  $('#stream').innerHTML = '';
  try {
    const r = await fetch(`/api/agents/${id}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ inputs, handoff: $('#handoff') ? $('#handoff').checked : true }), signal: ctrl.signal });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Request failed (' + r.status + ')');
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf('\n\n')) >= 0) { const chunk = buf.slice(0, i); buf = buf.slice(i + 2); if (!chunk.startsWith('data: ')) continue; const ev = JSON.parse(chunk.slice(6));
        if (ev.type === 'status') { cur = null; push(`<div class="ln caret">${esc(ev.text)}</div>`); }
        else if (ev.type === 'text') { if (!cur || !cur.el?.isConnected && here()) { cur = { text: '', i: L.lines.length, el: null }; cur.el = push(`<div class="ln t caret"></div>`); } cur.text += ev.delta; L.lines[cur.i] = `<div class="ln t">${esc(cur.text)}</div>`; if (cur.el?.isConnected) cur.el.textContent = cur.text; }
        else if (ev.type === 'textend') cur = null;
        else if (ev.type === 'error') failed = ev.message; } }
  } catch (e) { failed = ctrl.signal.aborted ? 'Stopped before it finished.' : e.message; }
  delete live[id];
  try { S = await api('GET', '/api/state'); } catch { /* keep the old state */ }
  if (location.hash === '#run' && runId === id) render(); else renderNav();
  toast(failed ? `${a.role}: ${failed}` : `${a.role} finished. Ready for review.`); }

V.pipeline = () => { const done = (id) => S.runs.some((r) => r.agent_id === id && r.status === 'done') || agent(id).runs && S.findings.some((f) => f.agent_id === id); const ids = [1, 2, 3, 4, 5, 6, 7]; const at = ids.findIndex((id) => !done(id)); const n = at < 0 ? 7 : at;
  return `<div class="head"><div><h1>Pipeline</h1><p>Agents 01 to 07 in order for one topic. Each stage waits for you: read its output, then run the next one, which receives the hand-off automatically.</p></div>
   <div class="chips">${at < 0 ? '<span class="pill"><span class="dot good"></span>All seven stages have run</span>' : `<button class="btn pri" data-run="${ids[at]}">Open next stage: ${agent(ids[at]).name}</button>`}</div></div>
  <div class="bar"><i style="width:${n / 7 * 100}%"></i></div>
  <div class="pipe stag">${ids.map((id, i) => { const a = agent(id), st = live[id] ? ['run', 'Running'] : done(id) ? ['good', 'Has run'] : i === at ? ['warn', 'Next'] : ['', 'Not run']; return `<div class="stage ${i === at ? 'active' : ''} ${live[id] ? 'flow' : ''}" style="--i:${i}"><div class="box"><span class="mono muted">${pad(id)}</span><h3>${a.name}</h3><span class="tag" style="align-self:flex-start"><span class="dot ${st[0]}"></span>${st[1]}</span><span class="muted" style="font-size:12px">${rel(a.last)}</span><button class="btn sm" style="align-self:flex-start" data-run="${id}">Open</button></div></div>`; }).join('')}</div>
  <section class="card"><h2>What each stage hands on</h2>${tblHtml(['From', 'To', 'Payload'], [['Strategist', 'Keyword Researcher', 'Objective, bets, lead topic'], ['Keyword Researcher', 'SERP Analyst', 'Primary query per group'], ['SERP Analyst', 'Brief Writer', 'Intent, table stakes, gaps'], ['Brief Writer', 'SEO Writer', 'Outline, evidence checklist'], ['SEO Writer', 'On-Page Reviewer', 'Draft with title and headings'], ['On-Page Reviewer', 'Internal Linker', 'Final page and target query']])}</section>`; };

let fFilter = 'open';
V.review = () => { const rows = S.findings.filter((f) => fFilter === 'all' || f.status === fFilter), live_ = S.findings.filter((f) => f.status !== 'dismissed');
  return `<div class="head"><div><h1>Review</h1><p>Every recommendation from every agent. Nothing reaches the plan until you approve it.</p></div>
   <div class="chips" role="group" aria-label="Filter by status">${[['open', 'Open'], ['approved', 'Approved'], ['dismissed', 'Dismissed'], ['all', 'All']].map(([k, l]) => `<button class="btn sm" aria-pressed="${k === fFilter}" data-ff="${k}">${l} <span class="num muted">${k === 'all' ? S.findings.length : S.findings.filter((f) => f.status === k).length}</span></button>`).join('')}</div></div>
  ${live_.length ? `<div class="grid g2">
   ${chartCard('c-scatter', 'Impact against effort', 'Each dot is a finding. Top left is the quick-win corner.', Object.values(BK).map((b) => `<span><i style="background:var(${b[1]});border-radius:50%"></i>${b[0]}</span>`).join(''), tblHtml(['Finding', 'Impact', 'Effort', 'Plan'], live_.map((f) => [f.title, f.impact, f.effort, BK[f.bucket][0]])))}
   <section class="card"><h2>Evidence behind the findings</h2><p class="muted" style="font-size:12px">Assumptions and unchecked items need your confirmation before work starts.</p><div class="chart" id="c-ev"></div></section></div>` : ''}
  <section class="card"><div class="tblwrap"><table><thead><tr><th>Finding</th><th>Agent</th><th>Evidence</th><th class="r">Impact</th><th class="r">Effort</th><th>Decision</th></tr></thead><tbody>
   ${rows.length ? rows.map((f) => `<tr data-f="${f.id}"><td style="min-width:240px"><div style="font-weight:500">${esc(f.title)}</div><div class="muted" style="font-size:12px">${esc(f.detail)}${f.urls.length ? '<br><span class="mono">' + f.urls.slice(0, 3).map(esc).join('<br>') + '</span>' : ''}</div></td><td style="white-space:nowrap">${agent(f.agent_id).role}</td><td>${evTag(f.evidence)}</td><td class="r">${f.impact}</td><td class="r">${f.effort}</td>
     <td style="white-space:nowrap">${f.status === 'open' ? `<button class="btn sm pri" data-dec="approved">Approve</button> <button class="btn sm" data-dec="dismissed">Dismiss</button>` : `<span class="tag"><span class="dot ${f.status === 'dismissed' ? '' : 'good'}"></span>${{ approved: 'Approved', dismissed: 'Dismissed', done: 'Done' }[f.status]}</span> <button class="btn sm" data-dec="open">Undo</button>`}</td></tr>`).join('') : `<tr><td colspan="6" class="muted">${S.findings.length ? 'Nothing with this status.' : 'No findings yet. Run an agent to add some.'}</td></tr>`}</tbody></table></div></section>`; };
V.review.after = () => { const fs = S.findings.filter((f) => f.status !== 'dismissed'); if (!fs.length) return;
  mount('c-scatter', (el, w) => scatter(el, w, fs.map((f) => ({ ...f, agent: f.agent_id }))));
  mount('c-ev', (el, w) => hbar(el, w, Object.keys(EV).map((k) => ({ k: EV[k][0], v: fs.filter((f) => f.evidence === k).length })), { unit: 'findings', label: 'Findings by evidence type' })); };

V.plan = () => { const ord = Object.keys(BK), items = S.findings.filter((f) => f.status === 'approved' || f.status === 'done');
  return `<div class="head"><div><h1>Plan</h1><p>Approved findings in the order to tackle them. The column is a first guess from impact and effort; move an item if your capacity says otherwise.</p></div><span class="pill">${items.length} in the plan · ${openCount()} still in review</span></div>
  ${items.length ? '' : `<div class="note">The plan is empty. Approve findings on the <a href="#review" style="color:var(--accent)">Review</a> page and they appear here.</div>`}
  <div class="cols">${ord.map((b, bi) => { const it = items.filter((f) => f.bucket === b);
    return `<div class="col"><div class="chead"><h2><span class="dot" style="display:inline-block;background:var(${BK[b][1]});margin-right:7px"></span>${BK[b][0]}</h2><span class="mono muted">${it.length}</span></div>
     ${it.map((f) => `<div class="item" data-f="${f.id}" style="${f.status === 'done' ? 'opacity:.6' : ''}"><div style="font-weight:500;${f.status === 'done' ? 'text-decoration:line-through' : ''}">${esc(f.title)}</div><div class="chips"><span class="tag">${agent(f.agent_id).role}</span><span class="tag">Effort ${f.effort}</span>${evTag(f.evidence)}</div>
       <div class="chips">${bi > 0 ? `<button class="btn sm" data-mv="${ord[bi - 1]}">← ${BK[ord[bi - 1]][0]}</button>` : ''}${bi < 2 ? `<button class="btn sm" data-mv="${ord[bi + 1]}">${BK[ord[bi + 1]][0]} →</button>` : ''}<button class="btn sm" data-dec="${f.status === 'done' ? 'approved' : 'done'}">${f.status === 'done' ? 'Reopen' : 'Mark done'}</button></div></div>`).join('') || '<span class="muted">Nothing here yet.</span>'}</div>`; }).join('')}</div>`; };

const connected = (k) => (k === 'dfs' ? S.conn.dfsReady : Boolean(S.conn[k]));

V.connections = () => { const g = S.conn.google, d = S.conn.dfs, cl = S.conn.claude, tin = S.runs.reduce((x, r) => x + r.in_tokens, 0), tout = S.runs.reduce((x, r) => x + r.out_tokens, 0);
  const users = (ks) => `<div><span class="lbl">Used by</span><div class="chips" style="margin-top:6px">${S.agents.filter((a) => a.src.some((s) => ks.includes(s))).map((a) => `<span class="src">${pad(a.id)} ${a.role}</span>`).join('')}</div></div>`;
  const where = (src, act) => (src === 'app' ? `<div class="chips"><span class="tag"><span class="dot good"></span>Saved in this app</span><button class="btn sm" data-act="${act}">Remove</button></div>` : src === 'env' ? '<div class="chips"><span class="tag"><span class="dot good"></span>Read from .env</span></div>' : '');
  return `<div class="head"><div><h1>Connections</h1><p>What the agents can read. They never write to a site or an account. Anything you enter here is stored in a file on this machine only.</p></div></div>
  <div class="grid g2 stag">
   ${(() => { const L = S.conn.llm, sel = llmSel && L.providers[llmSel] ? llmSel : L.active, P = L.providers[sel];
     return `<section class="card" style="--i:0"><div class="chead"><div><h2>AI model</h2><p>Runs the agents</p></div><span class="tag"><span class="dot ${S.mock ? 'warn' : S.hasKey ? 'good' : 'crit'}"></span>${S.mock ? 'Mock mode' : S.hasKey ? 'Ready' : 'Not ready'}</span></div>
     <p class="ink2" style="font-size:13px">${S.mock ? 'The server was started in mock mode, so runs call no model. ' : ''}In use: <b style="font-weight:600">${esc(L.name)}</b>${L.model ? ` · <span class="mono">${esc(L.model)}</span>` : ' · no model chosen'}</p>
     <form data-cred="llm" style="display:flex;flex-direction:column;gap:10px">
      <div class="field"><label class="lbl" for="llm-provider">Provider</label><select id="llm-provider">${Object.entries(L.providers).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v.name)}${v.source ? ' · key saved' : ''}</option>`).join('')}</select></div>
      ${P.source ? where(P.source, 'rm' + (sel === 'anthropic' ? 'claude' : sel)) : `<div class="field"><label class="lbl" for="llm-key">API key</label><input id="llm-key" type="password" autocomplete="off" spellcheck="false" placeholder="${esc(P.hint || '')}"></div>`}
      <div class="field"><label class="lbl" for="llm-model">Model</label><input id="llm-model" list="llm-models" autocomplete="off" spellcheck="false" value="${esc(sel === 'anthropic' && P.model === S.defaultModel ? '' : P.model || '')}" placeholder="${sel === 'anthropic' ? esc(S.defaultModel) + ' (default)' : 'Type the model ID, or load the list'}"><datalist id="llm-models"></datalist></div>
      <div class="chips"><button class="btn pri" type="submit">${sel === L.active ? 'Save' : 'Use this provider'}</button>${sel !== 'anthropic' && P.source ? '<button class="btn" type="button" data-act="loadmodels">Load model list</button>' : ''}<span id="llm-note" class="ink2" style="align-self:center;font-size:13px"></span></div>
     </form>
     <div id="cred-llm-err" class="note bad" hidden></div>
     ${sel === 'anthropic' ? '' : '<p class="muted" style="font-size:12px">The agents were written and tuned for Claude. Other models need reliable tool calling; with them, output appears when each step finishes instead of streaming word by word.</p>'}
     <div class="meter"><div style="display:flex;justify-content:space-between;font-size:12px"><span class="ink2">Tokens used by the latest ${S.runs.length} run${S.runs.length === 1 ? '' : 's'}</span><span class="num">${fmt(tin)} in · ${fmt(tout)} out</span></div></div></section>`; })()}

   <section class="card" style="--i:1"><div class="chead"><div><h2>Public page fetch</h2><p>Built in</p></div><span class="tag"><span class="dot good"></span>On</span></div><p class="ink2" style="font-size:13px">Each run may read up to 8 public pages. Addresses on your own network are refused, and page text is treated as data, never as instructions.</p></section>

   <section class="card" style="--i:2"><div class="chead"><div><h2>Google Search Console and Analytics 4</h2><p>Read-only access to queries, pages, indexing and organic sessions</p></div><span class="tag"><span class="dot ${g.connected ? 'good' : ''}"></span>${g.connected ? 'Connected' : 'Not connected'}</span></div>
     ${g.connected ? `<p class="ink2" style="font-size:13px">${g.mode === 'service' ? `Using the service account <span class="mono" style="overflow-wrap:anywhere">${esc(g.serviceEmail)}</span>. It only sees properties where that address was added as a user.` : 'Signed in with your Google account.'}</p>
         <div class="field"><label class="lbl" for="gsc-site">Search Console property</label><select id="gsc-site"><option value="${esc(g.gscSite || '')}">${esc(g.gscSite || 'Loading…')}</option></select></div>
         <div class="field"><label class="lbl" for="ga4-prop">Analytics 4 property</label><select id="ga4-prop"><option value="${esc(g.ga4Property || '')}">${esc(g.ga4Property || 'Loading…')}</option></select></div>
         <div id="gopt-err" class="note bad" hidden></div>
         <div class="chips"><button class="btn pri" data-act="savegoogle">Save</button><button class="btn" data-act="gdisc">Disconnect</button></div>`
      : `<form class="field" data-cred="service"><label class="lbl" for="cred-sa">Option 1 · Service account key</label>
          <p class="ink2" style="font-size:13px">In Google Cloud, create a service account and a JSON key, and enable the Search Console API, Analytics Data API and Analytics Admin API. Add the service account’s email as a user in Search Console and in Analytics. Then paste the whole key file here.</p>
          <textarea id="cred-sa" rows="4" spellcheck="false" autocomplete="off" placeholder='{ "type": "service_account", … }'></textarea><div><button class="btn pri" type="submit">Save and test</button></div></form>
         <div class="field"><span class="lbl">Option 2 · Sign in with Google</span>${g.oauthConfigured ? `<p class="ink2" style="font-size:13px">Opens Google’s own sign-in page and asks for read-only access.</p><div><a class="btn" href="/oauth/google/start">Connect Google</a></div>` : `<p class="ink2" style="font-size:13px">Needs <span class="mono">GOOGLE_CLIENT_ID</span> and <span class="mono">GOOGLE_CLIENT_SECRET</span> in <span class="mono">.env</span> first; the steps are in <span class="mono">.env.example</span>.</p>`}</div>`}
     <div id="cred-service-err" class="note bad" hidden></div>
     ${users(['gsc', 'ga4'])}</section>

   <section class="card" style="--i:3"><div class="chead"><div><h2>DataForSEO</h2><p>Keyword volumes, live SERPs, ranked keywords and backlinks</p></div><span class="tag"><span class="dot ${d.configured ? 'good' : ''}"></span>${d.configured ? 'Credentials found' : 'Not set up'}</span></div>
     ${!d.configured ? `<form data-cred="dfs" style="display:flex;flex-direction:column;gap:10px"><p class="ink2" style="font-size:13px">Use the API login and API password shown under API Access in your DataForSEO dashboard.</p>
          <div class="field"><label class="lbl" for="cred-dfs-login">API login</label><input id="cred-dfs-login" autocomplete="off" spellcheck="false"></div>
          <div class="field"><label class="lbl" for="cred-dfs-pass">API password</label><input id="cred-dfs-pass" type="password" autocomplete="off"></div>
          <div><button class="btn pri" type="submit">Save and test</button></div></form>`
      : `${where(d.source, 'rmdfs')}
         <div class="meter"><div style="display:flex;justify-content:space-between;font-size:12px"><span class="ink2">Spent this month</span><span class="num">$${d.spent.toFixed(2)} of $${d.cap}</span></div><div class="bar" style="height:8px;border-radius:4px"><i style="width:${d.cap ? Math.min(100, d.spent / d.cap * 100) : 100}%"></i></div></div>
         <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
          <div class="field"><label class="lbl" for="dfs-cap">Monthly cap in dollars</label><input id="dfs-cap" inputmode="decimal" value="${d.cap}"></div>
          <div class="field"><label class="lbl" for="dfs-loc">Location code</label><input id="dfs-loc" inputmode="numeric" value="${d.location}"></div>
          <div class="field"><label class="lbl" for="dfs-lang">Language code</label><input id="dfs-lang" value="${esc(d.language)}"></div></div>
         <p class="muted" style="font-size:12px">Location 2840 is the United States. Each agent run may make at most 10 paid lookups; repeated lookups within 24 hours are free.</p>
         <div class="chips"><button class="btn pri" data-act="savedfs">Save</button><button class="btn" data-act="testdfs">Test connection</button><span id="dfs-test" class="ink2" style="align-self:center;font-size:13px"></span></div>`}
     <div id="cred-dfs-err" class="note bad" hidden></div>
     ${users(['dfs'])}</section>

   ${(() => { const s = S.conn.serpInfo, geoFields = (x) => `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))"><div class="field"><label class="lbl" for="serp-gl-${x}">Country code</label><input id="serp-gl-${x}" value="${esc(s.gl)}"></div><div class="field"><label class="lbl" for="serp-hl-${x}">Language code</label><input id="serp-hl-${x}" value="${esc(s.hl)}"></div></div>`;
     return `<section class="card" style="--i:4"><div class="chead"><div><h2>SerpApi</h2><p>Live Google results for a keyword</p></div><span class="tag"><span class="dot ${s.serpapi.configured ? 'good' : ''}"></span>${s.serpapi.configured ? (s.active === 'SerpApi' ? 'In use' : 'Key found') : 'Not set up'}</span></div>
     <form data-cred="serpapi" style="display:flex;flex-direction:column;gap:10px">
      ${s.serpapi.configured ? `${where(s.serpapi.source, 'rmserpapi')}<p class="ink2" style="font-size:13px">${s.serpapi.used} search${s.serpapi.used === 1 ? '' : 'es'} used by agents this month. Repeated searches within 24 hours are free.</p>` : `<div class="field"><label class="lbl" for="cred-serpapi-key">API key</label><input id="cred-serpapi-key" type="password" autocomplete="off" spellcheck="false"></div>`}
      ${geoFields('a')}<div><button class="btn pri" type="submit">${s.serpapi.configured ? 'Save' : 'Save and test'}</button></div></form>
     <div id="cred-serpapi-err" class="note bad" hidden></div>${users(['serp'])}</section>

   <section class="card" style="--i:5"><div class="chead"><div><h2>Bright Data</h2><p>Google results, and pages that block ordinary fetches</p></div><span class="tag"><span class="dot ${s.bright.configured ? 'good' : ''}"></span>${s.bright.configured ? (s.active === 'Bright Data' ? 'In use' : 'Token found') : 'Not set up'}</span></div>
     <form data-cred="bright" style="display:flex;flex-direction:column;gap:10px">
      ${s.bright.configured ? `${where(s.bright.source, 'rmbright')}<p class="ink2" style="font-size:13px">${s.bright.used} search${s.bright.used === 1 ? '' : 'es'} used by agents this month.${s.serpapi.configured && s.bright.serpZone ? ' SerpApi is used for searches while both are set up.' : ''}</p>` : `<div class="field"><label class="lbl" for="cred-bright-token">API token</label><input id="cred-bright-token" type="password" autocomplete="off" spellcheck="false"></div>`}
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))"><div class="field"><label class="lbl" for="cred-bright-serp">SERP API zone name</label><input id="cred-bright-serp" value="${esc(s.bright.serpZone || '')}" placeholder="Optional"></div><div class="field"><label class="lbl" for="cred-bright-unlock">Web Unlocker zone name</label><input id="cred-bright-unlock" value="${esc(s.bright.unlockZone || '')}" placeholder="Optional"></div></div>
      <p class="muted" style="font-size:12px">With a Web Unlocker zone, an agent’s page fetch retries through Bright Data when a site answers 401, 403, 429 or 503.</p>
      ${geoFields('b')}<div><button class="btn pri" type="submit">${s.bright.configured ? 'Save' : 'Save and test'}</button></div></form>
     <div id="cred-bright-err" class="note bad" hidden></div>${users(['serp'])}</section>`; })()}

   <section class="card" style="--i:6"><div class="chead"><div><h2>Google Business Profile</h2><p>Categories, reviews, hours</p></div><span class="tag"><span class="dot"></span>Not built</span></div>
     <p class="ink2" style="font-size:13px">Google only opens this API to approved projects, so it is not connected here. Paste the profile details into the Local SEO Analyst’s inputs.</p>${users(['gbp'])}</section>
  </div>`; };
V.connections.after = async () => { if (!S.conn.google.connected) return; const g = S.conn.google;
  let o; try { o = await api('GET', '/api/connections/google/options'); } catch (e) { o = { sites: [], properties: [], errors: [e.message] }; }
  const a = $('#gsc-site'), b = $('#ga4-prop'); if (!a || !b) return;
  a.innerHTML = '<option value="">Not selected</option>' + [...new Set([...(g.gscSite ? [g.gscSite] : []), ...o.sites])].map((s) => `<option value="${esc(s)}" ${s === g.gscSite ? 'selected' : ''}>${esc(s)}</option>`).join('');
  const props = o.properties.some((p) => p.id === g.ga4Property) || !g.ga4Property ? o.properties : [{ id: g.ga4Property, name: g.ga4Property }, ...o.properties];
  b.innerHTML = '<option value="">Not selected</option>' + props.map((p) => `<option value="${esc(p.id)}" ${p.id === g.ga4Property ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  if (o.errors.length) { const e = $('#gopt-err'); e.textContent = o.errors.join(' '); e.hidden = false; } };

async function saveCred(kind, form) {
  const val = (id) => { const el = $('#' + id); return el ? el.value.trim() : ''; };
  let url = '/api/connections/credentials', body;
  if (kind === 'llm') { url = '/api/connections/llm'; body = { provider: $('#llm-provider').value, model: val('llm-model') }; if (val('llm-key')) body.key = val('llm-key'); }
  else if (kind === 'dfs') body = { dfsLogin: val('cred-dfs-login'), dfsPassword: $('#cred-dfs-pass').value };
  else if (kind === 'service') { url = '/api/connections/google/service'; body = { json: $('#cred-sa').value }; }
  else if (kind === 'serpapi') { url = '/api/connections/serp'; body = { gl: val('serp-gl-a'), hl: val('serp-hl-a') }; if ($('#cred-serpapi-key')) body.serpapiKey = val('cred-serpapi-key'); }
  else if (kind === 'bright') { url = '/api/connections/serp'; body = { gl: val('serp-gl-b'), hl: val('serp-hl-b'), brightSerpZone: val('cred-bright-serp'), brightUnlockZone: val('cred-bright-unlock') }; if ($('#cred-bright-token')) body.brightToken = val('cred-bright-token'); }
  const btn = $('button[type=submit]', form); btn.disabled = true;
  try { S = await api('PUT', url, body); rep = null; llmSel = null; toast('Saved.'); render(); }
  catch (e) { btn.disabled = false; const box = $('#cred-' + kind + '-err'); if (box) { box.textContent = e.message; box.hidden = false; } else toast(e.message); }
}
async function act(name) {
  try {
    if (name === 'savegoogle') { S = await api('PUT', '/api/connections/settings', { gscSite: $('#gsc-site').value, ga4Property: $('#ga4-prop').value }); rep = null; toast('Saved.'); render(); }
    else if (name === 'gdisc') { S = await api('POST', '/api/connections/google/disconnect'); rep = null; toast('Google disconnected.'); render(); }
    else if (name === 'loadmodels') { const p = $('#llm-provider').value, note = $('#llm-note'); note.textContent = 'Loading…'; const r = await api('GET', '/api/connections/llm/models?provider=' + p); $('#llm-models').innerHTML = r.models.map((m) => `<option value="${esc(m)}">`).join(''); note.textContent = `${r.models.length} models loaded. Click the Model box and start typing.`; }
    else if (name.startsWith('rm')) { S = await api('DELETE', '/api/connections/credentials/' + name.slice(2)); toast('Removed from this app.'); render(); }
    else if (name === 'savedfs') { S = await api('PUT', '/api/connections/settings', { dfsCap: $('#dfs-cap').value, dfsLocation: $('#dfs-loc').value, dfsLanguage: $('#dfs-lang').value.trim() }); toast('Saved.'); render(); }
    else if (name === 'testdfs') { $('#dfs-test').textContent = 'Testing…'; const r = await api('POST', '/api/connections/dfs/test'); $('#dfs-test').textContent = 'Working.' + (r.balance != null ? ` Account balance: $${Number(r.balance).toFixed(2)}` : ''); }
  } catch (e) { if (name === 'testdfs' && $('#dfs-test')) $('#dfs-test').textContent = e.message; else if (name === 'loadmodels' && $('#llm-note')) $('#llm-note').textContent = e.message; else toast(e.message); }
}

let repDays = 28, rep = null;
V.reports = () => { const head = `<div class="head"><div><h1>Reports</h1><p>Search performance from Search Console${S.conn.gsc ? ' for ' + esc(S.conn.google.gscSite) : ''}, against the period before.</p></div>${S.conn.gsc ? `<div class="chips" role="group" aria-label="Date range">${[7, 28, 90].map((n) => `<button class="btn sm" aria-pressed="${n === repDays}" data-rep="${n}">${n} days</button>`).join('')}</div>` : ''}</div>`;
  if (!S.conn.gsc) return head + `<div class="note">Reports need Search Console. Connect Google on the <a href="#connections" style="color:var(--accent)">Connections</a> page and choose a property.</div>`;
  if (!rep || rep.days !== repDays) return head + '<p class="muted">Loading Search Console data…</p>';
  if (rep.failed) return head + `<div class="note bad">${esc(rep.failed)}</div><div><button class="btn" data-rep="${repDays}">Try again</button></div>`;
  const t = rep.totals, p = rep.totalsPrev, pct = (a, b) => (b ? (a - b) / b * 100 : null);
  const delta = (v, good, text) => (v == null ? '<span class="muted" style="font-size:12px">No earlier data</span>' : `<span class="delta ${good ? 'up' : 'down'}">${text} <span class="muted" style="font-weight:400">vs previous</span></span>`);
  const dp = p.position ? t.position - p.position : null, dc = pct(t.clicks, p.clicks), di = pct(t.impressions, p.impressions), dr = p.impressions ? t.ctr - p.ctr : null;
  const arrow = (v) => (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v).toFixed(1);
  const tiles = [['Clicks', fmt(t.clicks), delta(dc, dc >= 0, dc == null ? '' : arrow(dc) + '%')], ['Impressions', fmt(t.impressions), delta(di, di >= 0, di == null ? '' : arrow(di) + '%')], ['Click-through rate', t.ctr.toFixed(1) + '%', delta(dr, dr >= 0, dr == null ? '' : arrow(dr) + ' points')], ['Average position', t.position.toFixed(1), delta(dp, dp <= 0, dp == null ? '' : (dp <= 0 ? '▲ improved ' : '▼ dropped ') + Math.abs(dp).toFixed(1) + ' places')]];
  return head + `<div class="grid g5 stag">${tiles.map((x, i) => `<div class="card tile" style="--i:${i}"><span class="lbl">${x[0]}</span><span class="v">${x[1]}</span>${x[2]}</div>`).join('')}</div>
  <div class="grid g2">
   ${chartCard('c-trend', 'Clicks', `${rep.range.start} to ${rep.range.end}, against ${rep.previous.start} to ${rep.previous.end}`, '<span><i class="ln" style="background:var(--s1)"></i>This period</span><span><i class="ln" style="background:var(--prev)"></i>Previous period</span>', tblHtml(['Day', 'This period', 'Previous'], rep.cur.map((v, i) => ['Day ' + (i + 1), fmt(v), fmt(rep.prev[i])])))}
   ${chartCard('c-pos', 'Queries by ranking position', `Top ${fmt(rep.queryRows)} queries by clicks in this period`, '', tblHtml(['Position', 'Queries'], rep.positions.map((r) => [r.k, r.v])))}
   ${rep.movers.length ? chartCard('c-wl', 'Page winners and losers', 'Change in clicks against the previous period', '<span><i style="background:var(--s1)"></i>Gained</span><span><i style="background:var(--neg)"></i>Lost</span>', tblHtml(['Page', 'Change in clicks'], rep.movers.map((r) => [r.k, (r.v > 0 ? '+' : '') + r.v]))) : ''}
  </div>`; };
V.reports.after = async () => { if (!S.conn.gsc) return;
  if (rep && rep.days === repDays) { if (rep.failed) return; mount('c-trend', (el, w) => lineChart(el, w, rep)); mount('c-pos', (el, w) => vbar(el, w, rep.positions, { label: 'Queries by ranking position' })); if (rep.movers.length) mount('c-wl', (el, w) => diverge(el, w, rep.movers)); return; }
  const days = repDays; let r; try { r = await api('GET', '/api/reports/gsc?days=' + days); } catch (e) { r = { days, failed: e.message }; }
  if (days !== repDays) return; rep = r; if (location.hash === '#reports') render(); };

/* ---------- router + events ---------- */
const NAV = [['overview', 'Overview'], ['site', 'Site'], ['agents', 'Agents'], ['pipeline', 'Pipeline'], ['review', 'Review'], ['plan', 'Plan'], ['reports', 'Reports'], ['connections', 'Connections']];
const cur = () => { const h = location.hash.slice(1); return V[h] ? h : 'overview'; };
function renderNav() { const ac = document.getElementById('agcount'); if (ac) ac.textContent = S.agents.length + ' agents';
const c = cur(), ct = { agents: S.agents.length, review: openCount(), plan: S.findings.filter((f) => f.status === 'approved').length };
  $('#nav').innerHTML = NAV.map(([k, l]) => `<a href="#${k}" ${k === c || (c === 'run' && k === 'agents') ? 'aria-current="page"' : ''}>${l}${ct[k] != null ? `<span class="ct">${ct[k]}</span>` : ''}</a>`).join('');
  $('#sitebox').innerHTML = S.site ? `<small>Site</small><span class="mono" style="overflow-wrap:anywhere">${esc(new URL(S.site.url).hostname)}</span><span class="muted" style="font-size:12px">${esc((S.site.goal || '').slice(0, 60))}</span>` : `<small>Site</small><a href="#site" style="color:var(--accent)">Add your site</a>`;
  $('#keypill').innerHTML = S.mock ? '<span class="dot warn"></span>Mock mode' : S.hasKey ? '<span class="dot good"></span>' + esc(S.conn.llm.name) : '<span class="dot crit"></span>No AI model ready'; }
function render() { mounted.length = 0; untip(); const c = cur(); $('#view').innerHTML = `<div class="view">${V[c]()}</div>`; V[c].after?.(); countUp($('#view')); renderNav(); }
addEventListener('hashchange', () => { render(); scrollTo(0, 0); const h = location.hash; api('GET', '/api/state').then((s) => { S = s; if (location.hash === h && h !== '#run' && h !== '#site' && h !== '#connections') render(); else renderNav(); }).catch(() => {}); });
function goRun(id) { runId = id; if (location.hash === '#run') render(); else location.hash = 'run'; }
async function patch(id, body, msg) { try { S = await api('PATCH', '/api/findings/' + id, body); toast(msg); } catch (e) { toast(e.message); } render(); }

document.addEventListener('click', (e) => { const t = e.target.closest('button,a'); if (!t) return; const d = t.dataset;
  if (d.run) { e.preventDefault(); return goRun(+d.run); }
  if (d.agf) { agFilter = d.agf; return render(); }
  if (d.ff) { fFilter = d.ff; return render(); }
  if (d.rep) { repDays = +d.rep; rep = null; return render(); }
  if (d.act) return act(d.act);
  if (d.tbl) { const on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', on); t.textContent = on ? 'Chart' : 'Table'; $('#' + d.tbl).hidden = on; $('#' + d.tbl + '-t').hidden = !on; return; }
  if (d.dec) { const row = t.closest('[data-f]'); row.classList.add('out'); return patch(row.dataset.f, { status: d.dec }, { approved: 'Approved. Added to the plan.', dismissed: 'Dismissed.', open: 'Moved back to open.', done: 'Marked done.' }[d.dec]); }
  if (d.mv) { const it = t.closest('[data-f]'); it.classList.add('out'); return patch(it.dataset.f, { bucket: d.mv }, 'Moved to ' + BK[d.mv][0] + '.'); }
  if (t.id === 'runbtn') return startRun();
  if (t.id === 'stopbtn') return live[runId]?.ctrl.abort();
});
document.addEventListener('change', (e) => { if (e.target.id === 'llm-provider') { llmSel = e.target.value; render(); $('#llm-provider')?.focus(); } });
document.addEventListener('submit', async (e) => { e.preventDefault(); if (e.target.id === 'runform') return startRun(); if (e.target.dataset.cred) return saveCred(e.target.dataset.cred, e.target); if (e.target.id !== 'siteform') return;
  const body = Object.fromEntries(new FormData(e.target)), err = $('#siteerr');
  try { S = await api('PUT', '/api/site', body); toast('Site saved.'); render(); } catch (x) { err.textContent = x.message; err.hidden = false; } });

/* command bar */
const cmd = $('#cmd'), cl = $('#cmdlist'); let ci = 0;
const matches = () => { const q = cmd.value.trim().toLowerCase(); return S ? S.agents.filter((a) => !q || (a.name + ' ' + a.role + ' ' + pad(a.id)).toLowerCase().includes(q)).slice(0, 8) : []; };
function drawCmd() { const m = matches(); ci = Math.min(ci, Math.max(0, m.length - 1)); cl.hidden = false;
  cl.innerHTML = m.length ? m.map((a, i) => `<button class="${i === ci ? 'on' : ''}" data-run="${a.id}"><span class="mono muted">${pad(a.id)}</span><span style="font-weight:500">${a.name}</span><span class="muted" style="font-size:12px">${esc(a.job)}</span></button>`).join('') : '<div class="muted" style="padding:8px">No agent matches that.</div>'; }
cmd.addEventListener('focus', drawCmd); cmd.addEventListener('input', () => { ci = 0; drawCmd(); });
cmd.addEventListener('keydown', (e) => { const m = matches();
  if (e.key === 'ArrowDown' && m.length) { ci = (ci + 1) % m.length; drawCmd(); e.preventDefault(); }
  else if (e.key === 'ArrowUp' && m.length) { ci = (ci - 1 + m.length) % m.length; drawCmd(); e.preventDefault(); }
  else if (e.key === 'Enter' && m[ci]) { cl.hidden = true; cmd.value = ''; cmd.blur(); goRun(m[ci].id); }
  else if (e.key === 'Escape') { cl.hidden = true; cmd.blur(); } });
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.cmd')) cl.hidden = true; });
document.addEventListener('click', (e) => { if (e.target.closest('#cmdlist [data-run]')) { cl.hidden = true; cmd.value = ''; } });
document.addEventListener('keydown', (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); cmd.focus(); } });

api('GET', '/api/state').then((s) => { S = s; render(); }).catch((e) => { $('#view').innerHTML = `<div class="note bad">Could not reach the server: ${esc(e.message)}</div>`; });
