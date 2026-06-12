# Cauldron OS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.40-blue.svg)](CHANGELOG.md)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![GitHub](https://img.shields.io/badge/github-witchdaddylabs-181717.svg)](https://github.com/witchdaddylabs)

<div align="center">

<img src="assets/hero-header.png" alt="Cauldron OS Hero" width="100%"/>

</div>

> **Bring the messy idea. Cauldron OS 0.40 brings the structure, taste, critique, build agents, and next steps.**

Cauldron OS 0.40 is a local-first workshop for AI-assisted builders. Drop in a rough app or website idea, choose a model or design reference, and Cauldron turns the mess into a structured product blueprint with architecture notes, schema ideas, exportable docs, a live HTML + AlpineJS prototype preview, critique-driven iteration, and build-agent handoff with real scaffold generation.

New in **0.40**: blueprint version history with line-level diffs, multi-agent handoff packages, a Community catalog for DESIGN.md systems and scaffold guidance, and deterministic prototype quality scoring with Annoying PM notes before critique.

It is built for hobbyists, indie builders, designers, enthusiasts, and developers who want better AI output than "make me a nice dashboard".

---

## Start Here

**Required:** Install the current [Node.js LTS release](https://nodejs.org) (Node 18 or newer).

**Windows (easiest):**

1. [Download Cauldron OS as a ZIP](https://github.com/witchdaddylabs/cauldron-os/archive/refs/heads/main.zip) and extract it.
2. Open the extracted folder and double-click `start-cauldron.bat`.
3. Keep the launcher window open, then visit [http://localhost:3000](http://localhost:3000).

The launcher checks Node.js, repairs missing dependencies, and starts Cauldron.

PowerShell users can run:

```powershell
.\start-cauldron.ps1
```

**macOS / Linux:**

```bash
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

To generate with AI, choose either:

- **Cloud:** add your own OpenAI or Google Gemini API key in Settings.
- **Local:** install [Ollama](https://ollama.com) and pull a model.

<details>
<summary>Developer install from Git</summary>

```bash
git clone https://github.com/witchdaddylabs/cauldron-os.git
cd cauldron-os
npm install
npm start
```

</details>

---

## What Cauldron does (v0.40 — 7-Stage Pipeline)

1. **You brain-dump the idea**<br>
   Write naturally. Messy is fine. Paste reference URLs if you have them.

2. **Optional: Annoying PM Mode / Interrogate Idea**<br>
   Cauldron pops up a short set of annoying product-manager questions before generation. Answer what you can; the Q&A gets folded into the final blueprint prompt so the model has firmer scope, risks, users, and assumptions.

3. **Design System & Taste Engine**<br>
   Pick a design reference from 150+ imported Open Design systems (Cursor, Vercel, Raycast, Stripe, Linear, Notion, Figma, etc.) or search Refero's live catalog for style inspiration. Add a reference URL for deep research — Cauldron extracts CSS variables, fonts, colours, and layout patterns via Playwright.

4. **The model creates a blueprint**<br>
   You get product notes, architecture direction, schema ideas, security considerations, and implementation guidance. Cauldron keeps version snapshots and shows line-level diffs between blueprint revisions.

5. **You get a live prototype preview + critique loop**<br>
   Cauldron generates an HTML + AlpineJS prototype so you can see and click through the shape of the idea. A local quality pass scores accessibility, hierarchy, spacing, contrast, and semantic HTML before you critique it. Give natural-language feedback ("make the header bolder", "tighter spacing") and Cauldron regenerates the prototype in-place. Up to 3 critique iterations per session, with full iteration history and restore.

6. **Build-agent handoff**<br>
   Generate one or more scoped handoff packages with blueprint, prototype, design tokens, and `cauldron.project.json` manifests — then launch detected agent CLIs (Cursor, Claude Code, Codex, Hermes, OpenCode) or save packages for later.

7. **Export and handoff**<br>
   Drafts and history are stored locally. Export Markdown/JSON, download the prototype HTML, or generate a runnable Next.js, Astro, static HTML, or AlpineJS scaffold for a coding agent.

---

## Screenshots

**Brain Dump → Blueprint pipeline** — Stage 04 Blueprint with generation running. OpenAI provider configured, blueprint generating in the right panel.<br>
![Blueprint generation](assets/screenshots/01-main-ui.png)

**Generated Blueprint** — Complete blueprint for "Tiny Tyrants Day Care" generated in 66.9s across 4 stages. Editable Markdown in the left panel, log and rendered output on the right.<br>
![Generated Blueprint](assets/screenshots/02-design-dropdown.png)

**Walkthrough demo** — Full pipeline walkthrough: Brain Dump → Design System → Blueprint generation → Prototype preview. Stitched from screen recordings at 1.5x speed.<br>
![Chihuahua walkthrough](assets/demo/cauldron-chihuahua-walkthrough.gif)

---

## Features

### For hobbyists and solo builders

- Turn rough ideas into structured build blueprints
- **Annoying PM Mode**: interrogate rough ideas with a product-manager question pass before generation, then fold the answers into the final blueprint prompt
- **Critique loop**: Give natural-language feedback on prototypes and regenerate in-place, with iteration history
- **Blueprint diffing**: Keep blueprint snapshots, restore earlier versions, and inspect line-level changes (v0.40)
- **Iterative Refinement**: Tweak generated blueprints with conversational prompts instead of starting from scratch
- Run locally with Ollama — no API costs and no data leaving your machine
- Optional cloud fallback using your own OpenAI or Google AI Studio API key
- Save/load drafts locally with searchable history
- Export blueprints as Markdown or JSON
- Save and download blueprints with one click
- **One-Click Downloads**: Download the generated raw HTML + AlpineJS `prototype.html` directly to your machine
- Create project folders with blueprint + agent stub for your preferred coding tool
- **Keyboard shortcuts**: Cmd/Ctrl+Enter to generate, Cmd/Ctrl+S to save, Cmd/Ctrl+Shift+P/N to move stages

### For design-conscious builders

- Expanded Design Reference dropdown with 150+ local `DESIGN.md` systems imported from Open Design, plus Refero style search for live inspiration
- **Community catalog** — Import curated community DESIGN.md references and apply community scaffold guidance without committing runtime imports (v0.40)
- **Refero Style Search** — Search the live Refero design directory for inspiration (results cached for 5 minutes)
- Dedicated one-URL cloner target field plus Brain Dump URL detection
- **Deep URL research mode** — Uses Playwright to extract CSS variables, fonts, colours, and layout patterns from reference sites
- Taste guardrails that avoid generic AI UI sludge: default Inter/Roboto, pure black, nested cards, and tired blue gradients
- Prompts for stronger spacing, typography, component states, and micro-interactions

### For power users

- **BYOK Build Agent Handoff** — Detect installed agent CLIs (Cursor, Claude Code, Codex, Hermes, OpenCode) and launch builds directly from the pipeline. Handoff includes blueprint, prototype, design tokens, and a `cauldron.project.json` manifest
- **Multi-agent orchestration** — Select multiple build agents and generate scoped packages under a shared root manifest (v0.40)
- **Prototype quality scoring** — Score accessibility, visual hierarchy, spacing, color contrast, and semantic HTML before critique (v0.40)
- **Scaffold Export** — Generate real project scaffolds: Next.js with TypeScript, Astro, static HTML, or AlpineJS. Each scaffold is a runnable project skeleton wired to your blueprint
- **XML Tool Agent System** — Multi-turn build agent that writes, edits, and runs code in a sandboxed workspace
- **Workspace preview** — Live HTML preview of built files via `/workspace-preview/`
- **Pipeline Activity Log** — Real-time NDJSON streaming showing each stage's progress
- **7-stage pipeline** — Brain Dump → Interrogate → Design System → Blueprint → Prototype → Build → Export
- **Build mode** — Sandboxed workspace with file listing and agent-driven project generation
- Public-safe local records layer using `sql.js`
- Clear extension points for prompts, design systems, URL research, templates, and exporters
- MIT licensed and intentionally local-first

---

## First Blueprint

1. Write your idea in **Brain Dump**.
2. Choose a cloud provider or a detected local Ollama model.
3. Optionally run **Interrogate** and choose a design reference.
4. Generate and review the blueprint.
5. Generate the prototype, review its quality score, and add critique if needed.
6. Save it, export a scaffold, or create a build-agent handoff.

---

## Model Routing

### Local models

Cauldron auto-detects local Ollama models from `/api/tags` on startup and fills the Local Ollama Model dropdown. Defaults remain available as fallbacks for **blueprint generation**:

| Project Type | Default Local Model | Best For |
|--------------|---------------------|----------|
| App / product blueprint | `qwen3.5:9b` | Architecture, state, schema, full-stack planning |
| Static site / landing page | `gemma4:e4b` | Layout, visual hierarchy, static markup |

These small models (9b–E4B) produce solid blueprints and prototypes, making them viable for generation-only workflows. However, if you want **strong Annoying PM / Interrogate Idea questions** from a local model, you will want a larger model such as **Gemma 4:26b** or **Qwen 3.5/3.6:27b**. Smaller models tend to ask very basic questions during the clarify phase. For the best interrogate experience, use cloud models (OpenAI, Gemini) which produce sharp, specific, jaded-PM-tier questions in seconds.

You can change the selected model in the UI. This makes cloned installs portable across machines with different Ollama model libraries, including Windows desktops with heavier models.

### Cloud models

Cloud Cauldron supports user-provided API keys stored in your browser localStorage. Every pipeline stage follows the provider you've selected, so one key runs the whole pipeline — pick Gemini and blueprint *and* prototype generation both run on Gemini, no surprise hops to another provider.

| Provider | Default / Available Models |
|----------|----------------------------|
| OpenAI | `gpt-5.4` |
| Google AI Studio | `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview` |

Google routing now follows the currently available 3.1 choices. Flash Lite is the preferred lightweight architecture model; Pro Preview is available as the heavier fallback.

---

## The Master Brain layer

Cauldron's prompt builder adds three design-aware upgrades before generation:

| Module | What it does |
|--------|--------------|
| Impeccable Taste | Adds design anti-patterns and premium UI mandates |
| Design Reference Selector | Pulls brand DNA from local Open Design `DESIGN.md` systems and Refero style references |
| URL Research Sweep | Scrapes the dedicated reference URL or first Brain Dump URL for CSS variables, fonts, colours, and layout patterns |

This means the model gets more than "build me an app". It gets taste, constraints, references, and context.

---

## Project Structure

```text
cauldron-os/
├── server.js               # Express backend, model proxy, prompt builder, research scraper
├── routes/                 # Route barrel (build, build-agents, drafts, generation, history, models, etc.)
├── lib/                    # Core modules (model-client, research, agent-loop, workspace, scaffold-generator, handoff-package, build-agents, design-system-catalog)
├── db/                     # Local sql.js records backend
├── public/
│   └── index.html          # Frontend cockpit with HTML + AlpineJS preview
├── projects/               # Generated handoff projects (gitignored)
├── data/                   # Local runtime DB/drafts (gitignored)
├── design-systems/         # 150+ imported Open Design DESIGN.md systems
├── docs/                   # Architecture, contributing, BYOK contract, public interfaces, and upgrade notes
├── examples/               # Example blueprints/design references
├── scripts/                # Validation/support scripts (import-design-systems, validate-design-systems)
├── assets/                 # Branding and screenshots
├── start-cauldron.bat      # Windows launcher
├── start-cauldron.ps1      # PowerShell launcher
├── LICENSE                 # MIT License
└── README.md
```

---

## Configuration

### Environment variables

Copy [`.env.example`](.env.example) for the full list. Cauldron reads these straight from the process environment — it doesn't auto-load a `.env` file yet, so export them (or use your own loader) before `npm start`. The ones you'll actually reach for:

| Variable | Default | What it does |
|----------|---------|--------------|
| `PORT` | `3000` | Port the server listens on (`PORT=4000 npm start`) |
| `CAULDRON_HOST` | `127.0.0.1` | Network interface to bind — see below |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Where Cauldron looks for your local Ollama |
| `CAULDRON_DATA_DIR` | `./data` | Where drafts, the local DB, and research assets live |
| `CAULDRON_COMMUNITY_OFFLINE` | `0` | Set to `1` to skip remote community-catalog fetches |

### Network access

Cauldron is local-first, so it binds to `127.0.0.1` (loopback) by default — it stays on your machine and nothing else on the network can see it. Want to open it on another device, like a tablet on your couch? Bind all interfaces:

```bash
CAULDRON_HOST=0.0.0.0 npm start
```

It also turns away cross-origin requests to its state-changing endpoints, so a random web page you happen to have open can't quietly poke your local instance.

### Local data

Drafts, sessions, and local runtime data live under `data/` (or wherever `CAULDRON_DATA_DIR` points) and are gitignored by default.

### API keys

Cloud API keys are entered in the browser and stored locally in browser localStorage. They are not committed to the repo.

---

## Contributing

Pull requests are welcome. Useful areas:

- Add new design references
- Improve URL research, especially for SPAs
- Add template/scaffold options such as React + Vite, Next.js, FastAPI, or SwiftUI
- Improve exports and blueprint diffing
- Improve accessibility
- Add tests and docs
- Clean up install paths for different operating systems

Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) before opening a PR.

---

## Roadmap ideas

Near-term public roadmap candidates:

- Blueprint gallery and reusable project starters
- Remote community catalog sync and moderation workflow
- Deeper build-output verification and automated accessibility checks
- More deterministic scaffold writers and framework targets

---

## Acknowledgments & Inspirations

- [impeccable.style](https://impeccable.style) — design taste manifesto inspiration
- [taste-skill](https://github.com/Leonxlnx/taste-skill) by Leonxlnx — high-agency frontend taste patterns
- [ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template) by JCodesMore — reconnaissance inspiration for URL research
- [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) — DESIGN.md concept and design-system references
- [Open Design](https://github.com/nexu-io/open-design) — imported Apache-2.0 `DESIGN.md` catalog used for the expanded design-system library
- [Refero.design](https://refero.design) — design style discovery API

---

## License

MIT License — see [LICENSE](LICENSE).

---

<div align="center">

**Built with 💜 by [Witch Daddy Labs](https://witchdaddylabs.com)**

**Happy cooking. 🔥**

</div>
