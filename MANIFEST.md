# Cauldron OS — Repository Manifest

**Version:** 0.30.0 (pre-1.0 semver)
**License:** MIT
**Org:** Witch Daddy Labs
**Stack:** Node.js/Express, AlpineJS, sql.js, Playwright

---

This is what's in the box. No fluff. No corporate. Just the files and what they do.

---

## Root Level

```
server.js                — Express 5.x server (~2244 lines). Routes, model proxy, prompt builder,
                           Deep Playwright research, build pipeline, handoff. All of it.
package.json             — v0.30.0. Dependencies: express ^5.2.1, playwright ^1.59.1, sql.js ^1.14.1
README.md                — Public docs with hero image and feature walkthrough
LICENSE                  — MIT. Witch Daddy Labs.
CHANGELOG.md             — Keep a Changelog format release history
MANIFEST.md              — This file
FUNDING.yml              — GitHub Sponsors config
GETTING_STARTED.md       — 5-minute setup guide
PUSH_GUIDE.md            — First-release push procedure (internal docs)
.gitignore               — node_modules, data/, projects/, .DS_Store, etc.
.editorconfig            — 2-space, LF, UTF-8
.gitattributes           — Binary handling, LFS annotations
start-cauldron.bat       — Windows double-click launcher
start-cauldron.ps1       — PowerShell launcher
```

---

## Core Application

```
server.js                — Express backend, model routing (Ollama local + OpenAI/Gemini cloud),
                           prompt builder with Master Brain layers, Deep Playwright research
                           (screenshot + CSS extraction), Build pipeline with SSE streaming,
                           handoff to project folders, Annoying PM Mode / Interrogate Idea

public/
  index.html             — AlpineJS SPA frontend (523 lines). 7-stage pipeline UI:
                           Brain Dump → Interrogate → Design System → Blueprint → Prototype → Build → Export
  brand/
    wdl-logo-nav.png      — Nav bar logo
  scripts/
    app.js               — AlpineJS app controller (653 lines). All frontend state management.
  styles/
    app.css              — Component styles
    tokens.css           — Design tokens: Cauldron palette (deep, charcoal, bone, acid, purple),
                           typography (Barlow Semi Condensed, JetBrains Mono), spacing scale,
                           radii, shadows
```

---

## Library — XML Tool Agent System

```
lib/
  agent-loop.js          — Multi-turn model <-> tool loop (374 lines).
                           Streams tokens, detects <action> blocks, executes tools,
                           feeds results back to model. Up to MAX_ROUNDS per user message.
  tools.js               — Tool definitions and executor (472 lines). Read/write files,
                           run shell commands, search, list directories.
  workspace.js           — Build workspace sandbox (356 lines). Session-based project
                           workspace management with preview server.
  xml-parser.js          — XML action parser (155 lines). Extracts <action> blocks
                           from model output for tool execution.
```

---

## Database

```
db/
  index.js               — sql.js local persistence (518 lines). Tables:
                           - drafts (brain dumps + blueprints)
                           - research_history (URL research sweeps with dedup + favorites)
                           - project_status_overrides
                           Data lives in ./data/cauldron.db (gitignored)
```

---

## Design Systems

```
design-systems/
  cursor/                — DESIGN.md (Sleek dark IDE aesthetic)
  vercel/                — .gitkeep placeholder
  lovable/               — .gitkeep placeholder
  raycast/               — .gitkeep placeholder
```

Plus **27 design references** baked into `server.js`:

**13 Curated Brands** (fetched from awesome-design-md):
Cursor · Vercel · Lovable · Raycast · Linear · Stripe · Notion · Apple · Figma · Supabase · Resend · Webflow · OpenCode

**14 Refero Design Styles** (from refero.design):
Antimetal · Good Glyphs · Linear · Cursor · Anthropic · Raycast · Superhuman · Hyperstudio · General Intelligence · Mercury · ElevenLabs · Monopo Saigon · Minimalissimo · Stripe

---

## Scaffold Templates

4 templates defined in `server.js` (TEMPTATES array), served via `/api/templates`:

| ID | Name | Best For |
|----|------|----------|
| static-html | Static HTML/CSS | Landing pages, microsites, zero-build concept pages |
| html-alpine | HTML + AlpineJS | Interactive lightweight prototypes, single-page tools |
| react-vite-tailwind | React + Vite + Tailwind | Client-heavy dashboards, tools, rich MVPs |
| next-app-router | Next.js App Router | Production apps needing routing, server actions, auth |

Each template specifies scaffold type, file list, and prompt bias for the model.

---

## API Routes (all in server.js)

**Blueprints & Builds:**
- POST `/api/generate` — Generate blueprint (SSE stream)
- POST `/api/refine` — Refine existing blueprint (SSE stream)
- POST `/api/build/start` — Start build pipeline
- POST `/api/build/generate` — Generate build files (SSE)
- POST `/api/build/refine` — Refine build (SSE)
- POST `/api/build/stop` — Cancel active build
- GET `/api/build/status/:sessionId` — Build status
- GET `/api/build/files/:sessionId` — List build files
- GET `/api/build/file/:sessionId` — Get specific build file
- GET `/workspace-preview/:sessionId/*` — Workspace preview server

**Models:**
- GET `/api/tags` — Auto-detect Ollama models
- GET `/api/health` — Server health check
- POST `/api/chat/completions` — OpenAI-compatible proxy

**Data:**
- GET/POST `/api/drafts` — Save/load drafts
- GET `/api/drafts/:id` — Get specific draft
- GET/POST `/api/research-history` — Research history CRUD
- POST `/api/research-history/:id/favorite` — Toggle favorite
- DELETE `/api/research-history/:id` — Delete record
- GET `/api/templates` — List scaffold templates
- GET `/api/build-status` — Build monitoring

**Projects:**
- POST `/api/projects/import` — Import existing folder
- POST `/api/projects/:name/resume` — Resume build
- POST `/api/projects/:name/open-visible` — Launch in OpenCode
- POST/DELETE `/api/projects/:name/status` — Override status
- POST `/api/handoff` — Create project folder with blueprint + OpenCode stub

**Static:**
- `/research-assets/*` — Served research screenshots

---

## GitHub Integration

```
.github/
  CODE_OF_CONDUCT.md     — Contributor Covenant 2.1
  SECURITY.md            — Vulnerability disclosure policy
  PULL_REQUEST_TEMPLATE.md
  ISSUE_TEMPLATE/
    bug-report.md
    feature-request.md
  workflows/
    ci.yml               — Node.js lint + smoke test on push/PR
```

---

## Documentation

```
docs/
  ARCHITECTURE.md        — Technical deep dive (Master Brain layers, routing, data flow)
  CONTRIBUTING.md        — PR standards, testing guide, extension points
  DESIGN_REFERENCE.md    — Brand DNA selector docs
  history/
    CHANGELOG-2.x.md     — Archived pre-unification changelog
  plans/
    2026-04-28-annoying-questions.md

examples/
  sample-blueprint.md    — Example output showing brand + research integration
```

---

## Tests

```
tests/
  smoke.js               — Main integration smoke test (starts server, hits endpoints)
  build-status-smoke.js  — Build status API tests
  cloud-models-smoke.js  — Cloud model routing tests
  deep-research-smoke.js — Deep Playwright research tests
  frontend-static-smoke.js — Static asset serving tests
  private-records-smoke.js — Record persistence tests
  research-history-smoke.js — Research history CRUD + favorites tests
  template-generation-smoke.js — Template generation tests
  templates-smoke.js     — Template listing tests
```

Run with: `npm test`

---

## Scripts

```
scripts/
  pre-publish.js         — Pre-push validator
  validate-blueprint.js  — JSON blueprint schema validator
```

---

## Brand Assets

```
assets/
  hero-header.png        — AI-generated banner image (README header)
  brand/
    wdl-logo-primary.png  — Full horizontal WDL logo
    logo-sigil.png         — Witch hat sigil icon
    logo-wordmark.png      — "Witch Daddy Labs" text
  demo/
    cauldron-rude-boy-coffee-walkthrough.gif   — GIF walkthrough
    cauldron-rude-boy-coffee-walkthrough.webm  — Video walkthrough
  screenshots/
    01-main-ui.png        — Three-panel interface
    02-design-dropdown.png — Design Reference selector
    04-rude-boy-preview.png — Generated prototype preview
    archive/              — Retained screenshot history
```

---

## Runtime Data (all gitignored)

```
data/
  cauldron.db            — sql.js database (drafts, research history, projects)
  drafts/                — Saved blueprint drafts
  drafts/.meta           — Draft metadata index

projects/                — Generated handoff project folders (created at runtime)
```

---

## Key Numbers

| Metric | Count |
|--------|-------|
| Total design references | 27 (13 brands + 14 Refero styles) |
| Scaffold templates | 4 |
| Pipeline stages | 7 (Brain Dump → Interrogate → Design System → Blueprint → Prototype → Build → Export) |
| Server lines | ~2244 |
| Lib modules | 4 (agent-loop, tools, workspace, xml-parser) |
| Test files | 9 |
| Dependencies | 3 (express, playwright, sql.js) |

---

*This manifest is a living document. Update it when files move or the architecture shifts.*
