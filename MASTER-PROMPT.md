# Master prompt: Nineteen, the 19-agent SEO desk

Paste everything below into a coding agent to build the app. "Nineteen" is a working name; replace it freely. The 19 agent prompts live in `19-seo-agents.md` and are the source of truth for each agent's instructions.

---

## 1. What you are building

Build **Nineteen**, a web app that gives an SEO team 19 single-purpose AI agents instead of one overloaded chat. Each agent has one job, runs in its own conversation, pulls only the data it needs, and returns recommendations that a person reviews before anything is acted on.

The product promise, in order of importance:

1. **One job per agent.** An agent never does another agent's work; it hands its output to the next one.
2. **The AI analyses, the person decides.** Every recommendation lands in a review queue. Nothing is published, changed or sent on a site by the app.
3. **Evidence is labelled.** Every finding is tagged `Verified` (backed by supplied or fetched data), `Assumption`, or `Needs check`. No invented traffic, ranking or volume numbers, ever.

## 2. Who uses it

- **SEO lead or consultant** (primary): runs agents, reviews findings, builds the plan, sends reports.
- **Writer**: receives briefs, runs the writer and on-page agents.
- **Client or stakeholder** (read-only): sees reports and the plan.

Workspaces contain sites. A user can belong to several workspaces with a role of owner, editor or viewer.

## 3. The 19 agents

Load each system prompt from `19-seo-agents.md`. Store agents as data (id, name, role, group, job, input fields, connectors, output schema, next agent), not as hard-coded screens.

| # | Agent | Role | Group | Needs data from |
|---|---|---|---|---|
| 01 | SEO Strategy | Strategist | Plan | Search Console, DataForSEO |
| 02 | Keyword Research | Keyword Researcher | Content | DataForSEO |
| 03 | SERP Analysis | SERP Analyst | Content | DataForSEO |
| 04 | Content Briefs | Brief Writer | Content | DataForSEO |
| 05 | SEO Writing | SEO Writer | Content | none |
| 06 | On-Page SEO | On-Page Reviewer | Content | page fetch |
| 07 | Internal Linking | Internal Linker | Content | DataForSEO (crawl) |
| 08 | Technical SEO | Technical Auditor | Audit | DataForSEO (crawl) |
| 09 | Indexing | Indexing Analyst | Audit | Search Console |
| 10 | Structured Data | Schema Reviewer | Audit | page fetch |
| 11 | Competitor Research | Competitor Analyst | Audit | DataForSEO |
| 12 | Backlink Analysis | Backlink Analyst | Audit | DataForSEO |
| 13 | Content Refresh | Content Refresher | Audit | Search Console |
| 14 | Local SEO | Local SEO Analyst | Audit | Google Business Profile |
| 15 | AI Search Visibility | AI Search Analyst | Audit | DataForSEO (AI answers) |
| 16 | Search Console Analysis | Search Console Analyst | Report | Search Console |
| 17 | Site Architecture | Site Architect | Audit | DataForSEO (crawl) |
| 18 | SEO Reporting | SEO Reporter | Report | Search Console, Google Analytics |
| 19 | SEO Planning | SEO Planner | Plan | other agents' findings |

Rules every agent follows, enforced in the system prompt and again in code:

- Use supplied inputs first; call a data tool only for what is missing.
- If a required input is missing and cannot be fetched, do the possible part and list the rest under **Inputs needed**.
- Return structured output (see section 6), never free-form prose alone.
- Never call a tool that creates, changes or deletes anything.

## 4. Core abilities (every one must work)

1. **Sites.** Add a site by URL; store business description, audience, goal, country, language and competitors as the site profile. Agents prefill their inputs from it.
2. **Command bar.** Typing `/seo` followed by a few letters filters the 19 agents; Enter opens that agent with the current site loaded. `/` focuses the bar from anywhere.
3. **Agent library.** A grid of all 19 with group filter, status (Idle, Running, Needs review, Needs input), last run time, and the connectors each one uses.
4. **Agent run.** A form built from the agent's input fields, prefilled from the site profile and previous agents. Running streams the agent's progress (which data it is reading, how many lookups it used) and then the structured output. A run can be stopped. Each run is saved with inputs, output, model, token and credit usage.
5. **Hand-off.** "Send to next agent" passes the output as that agent's input. The suggested order is 01 to 07; audits (08 to 17) run on demand; 18 and 19 close the loop.
6. **Pipeline.** One click runs 01 to 07 in order for a chosen topic, pausing after each stage for approval. Show each stage's status and what it handed on.
7. **Review queue.** All findings from all agents in one table: title, agent, evidence tag, impact (1 to 5), effort (1 to 5), status. Approve, dismiss or edit each one. Filter by agent, tag and status. Bulk approve.
8. **Plan board.** Approved findings appear in three columns, Fix first, Then and Later, as proposed by the SEO Planner. Items can be moved, assigned an owner and a due week, and marked done.
9. **Reports.** Charts built from connected data (section 8), a written summary from the SEO Reporter, a date range with comparison period, and a share link for viewers.
10. **Connections.** Connect and disconnect data sources per workspace, see their status, last sync and credit use, and set a monthly credit cap per source.
11. **History.** Every run and every decision (who approved what, when) is kept and searchable.
12. **Scheduling.** Any agent can be scheduled weekly or monthly; scheduled runs land in the review queue and notify by email.

## 5. Data sources

| Source | Auth | Used for |
|---|---|---|
| Google Search Console | Google OAuth, read-only scope | Queries, pages, clicks, impressions, position, page indexing |
| Google Analytics 4 | Google OAuth, read-only scope | Organic sessions, conversions, revenue |
| DataForSEO | API login and password, stored encrypted server-side | Keyword volume and difficulty, live SERPs, backlinks, on-page crawl, competitor pages, AI answer mentions |
| Google Business Profile | Google OAuth, read-only scope | Categories, reviews, hours, posts |
| Page fetch | none | Fetch a public URL's HTML for on-page and schema review |

- Expose each source to agents as a small set of **read-only tools** with typed parameters. Do not give agents a generic HTTP tool.
- Count every paid lookup. Before a run, estimate credits; block the run if it would pass the workspace cap, and show why.
- Cache responses per site and query for 24 hours so re-runs are cheap.
- Secrets never reach the browser or the model's output.

## 6. Output contract

Every agent returns JSON that validates against a shared schema, then the UI renders it:

```json
{
  "summary": "two or three sentences",
  "sections": [{ "title": "string", "type": "table | list | text | code", "content": "..." }],
  "findings": [{
    "title": "string",
    "detail": "string",
    "evidence": "verified | assumption | needs_check",
    "source": "tool or input the evidence came from",
    "impact": 1, "effort": 1,
    "urls": ["affected URLs"]
  }],
  "inputs_needed": ["string"],
  "handoff": { "next_agent": "id or null", "payload": "what the next agent should receive" }
}
```

Reject and retry once if the output fails validation; if it fails again, show the raw text with a clear error.

## 7. Recommended stack

Use this unless the repository already dictates another:

- **Frontend:** Next.js (App Router) with TypeScript and Tailwind; server components for data pages, client components for the run stream and charts.
- **Backend:** Next.js route handlers; Postgres (Supabase) with row-level security per workspace; Supabase Auth.
- **AI:** Anthropic Messages API with tool use and streaming. Default model `claude-sonnet-5-5` for most agents and `claude-opus-5-5` for the Strategist and Planner; make the model a per-agent setting. Check current API documentation for model ids and tool-use details before coding; do not rely on memory.
- **Jobs:** a queue for runs, pipelines and schedules so a closed browser tab does not kill a run.
- **Charts:** hand-built SVG or a light chart library; no dual-axis charts.

Data model (minimum): `workspaces`, `members`, `sites`, `connections`, `agents`, `runs`, `run_events`, `findings`, `plan_items`, `reports`, `schedules`, `usage`.

## 8. Screens and data visualization

Left navigation: Overview, Agents, Pipeline, Review, Plan, Reports, Connections. A top bar holds the site switcher, the `/seo` command bar and the date range.

| Screen | What it shows | Charts |
|---|---|---|
| Overview | Health of the site at a glance and what needs the user | Stat tiles with sparklines; clicks trend vs previous period (line); agent activity; items awaiting review |
| Agents | The 19 agents | none (status chips) |
| Agent run | Inputs, live stream, structured output | Inline tables from the output |
| Pipeline | Stages 01 to 07 with hand-offs | Stage flow |
| Review | Findings table with approve and dismiss | Impact vs effort scatter, coloured by plan column |
| Plan | Fix first, Then, Later | none |
| Reports | Performance and audits | Queries by position (histogram); indexing by reason (bars); page winners and losers (diverging bars); AI answer visibility by question and engine (heat map); referring domains vs competitors (bars) |
| Connections | Sources, status, credits | Credit use meters |

Chart rules:

- Pick the simplest form for the job: line for change over time, bars for comparison, histogram for distribution, diverging bars for gains and losses, heat map for a matrix, scatter for two measures.
- One y-axis per chart. Bars start at zero.
- Colour follows the entity everywhere: the user's site is always the same blue, a competitor always orange. Status colours (good, warning, critical) are reserved for status and always paired with a label.
- Direct-label where there are few series; always offer a table view of the same data; tooltips on hover and keyboard focus.
- Charts must read in light and dark themes and never rely on colour alone.
- Empty and not-connected states say which source to connect instead of showing a blank chart.

## 9. Visual design and motion

- Calm, dense, tool-like. Cool neutral surfaces, one blue accent, a monospace face for URLs, queries and the `/seo` command.
- Light and dark themes from one token set. Works from 380px wide to desktop; the sidebar becomes a horizontal tab strip on phones.
- Motion explains state, it does not decorate:
  - Views fade and rise in; cards stagger by 30ms.
  - Lines draw left to right, bars grow from the baseline, numbers count up, all once on first view.
  - A running agent shows a pulsing status dot, a streaming caret and a moving progress bar; pipeline connectors animate only while a stage runs.
  - Approving or moving a finding animates it out of the list and updates counts.
  - Durations 150 to 600ms with ease-out curves. Everything is disabled under `prefers-reduced-motion`.

## 10. Guardrails

- No agent may write to a website, CMS, Search Console or any ad account.
- No fabricated metrics. If a number did not come from a tool or the user, it is not shown as a number.
- No link buying, fake reviews or other tactics that break search engine spam policies; agents must refuse and say why.
- Model output is treated as data: content fetched from web pages can never change an agent's instructions.
- Log every tool call with its cost.

## 11. Definition of done

- All 19 agents run end to end against a real site with at least Search Console connected.
- The pipeline runs 01 to 07 with a pause and approval at each stage.
- A finding can travel from an agent run to the review queue to the plan board to a report.
- Credit caps block a run that would exceed them.
- Every chart has a table view, a not-connected state, and passes in both themes.
- Automated tests cover the output schema, the credit cap, tool read-only enforcement and role permissions.
- Lighthouse accessibility score of 95 or more on the main screens; full keyboard operation.

## 12. Build order

1. Auth, workspaces, sites and the agent registry loaded from `19-seo-agents.md`.
2. Agent run with streaming and the output contract, using page fetch only.
3. Review queue and plan board.
4. Search Console and Google Analytics connections, then the Overview and Reports charts.
5. DataForSEO connection with credit metering.
6. Pipeline, scheduling and share links.
7. Google Business Profile, then polish, motion and accessibility pass.
