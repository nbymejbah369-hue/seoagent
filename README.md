# Nineteen

Nineteen single-purpose SEO agents in one local web app. Each agent has one job, runs in its own conversation, and puts its recommendations in a review queue. Nothing is acted on until you approve it.

This is the first version: single user, runs on your machine, data in a local SQLite file.

## Start

Requires Node 22.5 or newer (built with Node 24).

```bash
npm install
```

Copy `.env.example` to `.env` and add your Anthropic API key, then:

```bash
npm start
```

Open http://localhost:3019, add your site on the Site page, then run an agent.

To try the app without a key (placeholder output, no model calls):

```bash
npm run mock
```

## What works

- **Site profile**: agents prefill their inputs from it.
- **91 agents**: the original 19 plus 72 added later. Agents 80 to 91 are Pagination Reviewer, Breadcrumb and Navigation Reviewer, Site Search Analyst, Zero-Click Query Analyst, Pillar Page Reviewer, Comparison Page Planner, Glossary Builder, Case Study Optimizer, Author Page Reviewer, SEO Change Log Writer, SEO Experiment Designer and Weekly Digest Writer (in `agents/prompts-batch6.md`). Agents 68 to 79 are Repurposing Planner, Video SEO Reviewer, Keyword Difficulty Estimator, Toxic Link Reviewer, JavaScript Rendering Reviewer, Mobile Usability Reviewer, Security and HTTPS Reviewer, International SEO Planner, Algorithm Update Analyst, ROI and Forecast Modeller, Stakeholder Q&A Preparer and Competitor SWOT Builder (in `agents/prompts-batch5.md`). Agents 56 to 67 are Headline Tester, Readability and Tone Editor, Fact Checker, Seasonal Trends Analyst, Branded Search Analyst, Migration Planner, Anchor Text Reviewer, Unlinked Mentions Finder, Digital PR Idea Generator, Broken Link Builder, Citation Auditor and Review Analyst (in `agents/prompts-batch4.md`). Agents 44 to 55 are Product Page Reviewer, Category Page Reviewer, Service Area Page Planner, Landing Page Reviewer, Image SEO Reviewer, Hreflang Reviewer, AI Crawler Reviewer, Entity and Brand Reviewer, Prompt Set Builder, Content Calendar Builder, Quarterly Roadmap Builder and Workflow Router (in `agents/prompts-batch3.md`). Agents 32 to 43 are Topic Cluster Planner, Content Pruning Advisor, E-E-A-T Reviewer, Redirect Mapper, Canonical Reviewer, Core Web Vitals Analyst, Robots and Sitemap Reviewer, LLM Citation Tracker, Developer Ticket Writer, Executive Summary Writer, Competitor Change Monitor and Link Prospector (in `agents/prompts-extra.md`). Agents 20 to 31 are Featured Snippet Hunter, People Also Ask Miner, Content Gap Finder, Cannibalization Detector, Search Intent Classifier, SERP Feature Analyst, Long-Tail Opportunity Finder, Traffic Drop Investigator, Meta Writer, FAQ Writer, Answer-Ready Content Editor, SEO QA Checker (in `agents/prompts-more.md`). The first 19 prompts live in `agents/prompts.md`; metadata in `agents/agents.json`. The added agents take no automatic hand-off unless their entry sets `"from"` to another agent's number.
- **Real runs**: streamed from the Claude API. An agent can read up to 8 public pages per run and must return structured output (summary, sections, findings, inputs needed, hand-off).
- **Hand-off**: each agent can receive the previous agent's latest output; the Planner receives every finding.
- **Pipeline**: agents 01 to 07 in order, one stage at a time.
- **Review queue**: approve, dismiss or undo, with an impact-against-effort chart.
- **Plan board**: Fix first, Then, Later; move items and mark them done.
- **Command bar**: press `/` and type an agent name.

## Connections

All connections are read-only. Enter credentials on the Connections page; no restart is needed. They are saved in `data/nineteen.db` on this machine, in plain text, and are never sent back to the browser. Values in `.env` still work, and a value entered in the app wins over `.env`.

- **AI model**: choose Claude (Anthropic), ChatGPT (OpenAI), Gemini, Groq or OpenRouter, paste that provider's API key, and pick a model. Claude is the default and the one the agents were tuned for. The other providers are called through their OpenAI-compatible chat endpoints, need a model with reliable tool calling, and show output step by step instead of streaming. Setting `OPENAI_BASE_URL` points the ChatGPT provider at any OpenAI-compatible server.
- **SerpApi or Bright Data**: live Google results for the agents that study search results. If both are set up, SerpApi is used. Searches are cached for 24 hours and limited to 10 paid lookups per run. A Bright Data Web Unlocker zone also lets page fetches retry when a site blocks an ordinary request.
- **Google, option 1 (simplest)**: create a service account and a JSON key in Google Cloud, enable the Search Console API, Analytics Data API and Analytics Admin API, add the service account's email as a user in Search Console and in Analytics, then paste the key file on the Connections page.

- **Google, option 2 (sign in with Google)**: create an OAuth client of type "Web application" in Google Cloud, enable the Search Console API, Analytics Data API and Analytics Admin API, and add the redirect URI `http://localhost:3019/oauth/google/callback`. Then press Connect Google and choose a property for each. If you change `PORT`, change the redirect URI to match.
- **DataForSEO**: enter the API login and API password from your DataForSEO dashboard. Lookups are cached for 24 hours, limited to 10 paid lookups per agent run, and stop at the monthly cap you set (default $5).
- **Reports**: clicks against the previous period, queries by ranking position, and page winners and losers, from Search Console.

Each agent only gets the tools for the sources listed on its card.

## Not built yet

Google Business Profile (Google only opens that API to approved projects), DataForSEO site crawl and AI-answer lookups, login and workspaces, scheduling, share links. See `MASTER-PROMPT.md` for the full specification and build order.

## Settings (`.env`)

| Name | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Required for real runs |
| `MODEL` | `claude-opus-5-5` | Model used by every agent |
| `EFFORT` | `medium` | `low`, `medium`, `high`, `xhigh` or `max` |
| `PORT` | `3019` | Local port |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | none | Google OAuth client for Search Console and Analytics |
| `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | none | DataForSEO API credentials |

## Safety notes

- By default the server listens on `127.0.0.1` only. To deploy, set `HOST=0.0.0.0`, `APP_PASSWORD` (HTTP Basic login; the app refuses to start without it) and `PUBLIC_URL`, serve it over HTTPS, and keep `DATA_DIR` on a persistent disk (a `Dockerfile` is included; `/healthz` is the health check). API keys entered in the app are stored in plain text in that database.
- The page fetcher refuses addresses on private networks and treats page text as data.
- Agents have no tool that can change a website or an account.

## Debugging

```bash
node server.js --fetch https://example.com/
```

prints exactly what an agent sees when it reads that page.
