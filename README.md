# Cauldron OS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.30-blue.svg)](CHANGELOG.md)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![GitHub](https://img.shields.io/badge/github-witchdaddylabs-181717.svg)](https://github.com/witchdaddylabs)

<div align="center">

<img src="assets/hero-header.png" alt="Cauldron OS Hero" width="100%"/>

</div>

> **Bring the messy idea. Cauldron OS 0.30 brings the structure, taste, build agent, and next steps.**

Cauldron OS 0.30 is a local-first workshop for AI-assisted builders. Drop in a rough app or website idea, choose a model or design reference, and Cauldron turns the mess into a structured product blueprint with architecture notes, schema ideas, exportable docs, a live HTML + AlpineJS prototype preview, critique-driven iteration, and build-agent handoff with real scaffold generation.

New in **0.30** (5-Phase Codex Sprint): 150+ design systems from Open Design, BYOK build-agent handoff (Cursor, Claude Code, Codex, Hermes, OpenCode), critique & review loop with iteration history, scaffold export (Next.js, Astro, static HTML, AlpineJS), UI polish (progress bars, keyboard shortcuts, responsive layout, settings modal, toast notifications).

It is built for hobbyists, indie builders, designers, enthusiasts, and developers who want better AI output than "make me a nice dashboard".

---

## Quick Start

```bash
git clone https://github.com/witchdaddylabs/cauldron-os.git
cd cauldron-os
npm install
npm start
# → Open http://localhost:3000
```

### Non-technical start

**Windows:** double-click `start-cauldron.bat` or run `start-cauldron.ps1` in PowerShell.<br>
**macOS / Linux:** open Terminal in the repo folder, then run `npm install` and `npm start`.

You will need Node.js 18+. For local AI generation, install Ollama and pull at least one model. You can also use OpenAI or Google AI Studio with your own API key.

---

## What Cauldron does (v0.30 — 8-Stage Pipeline)

1. **You brain-dump the idea**<br>
   Write naturally. Messy is fine. Paste reference URLs if you have them.

2. **Optional: Annoying PM Mode / Interrogate Idea**<br>
   Cauldron pops up a short set of annoying product-manager questions before generation. Answer what you can; the Q&A gets folded into the final blueprint prompt so the model has firmer scope, risks, users, and assumptions.

3. **Design System & Taste Engine**<br>
   Pick a design reference from 150+ imported Open Design systems (Cursor, Vercel, Raycast, Stripe, Linear, Notion, Figma, etc.) or search Refero's live catalog for style inspiration. Add a reference URL for deep research — Cauldron extracts CSS variables, fonts, colours, and layout patterns via Playwright.

4. **The model creates a blueprint**<br>
   You get product notes, architecture direction, schema ideas, security considerations, and implementation guidance.

5. **You get a live prototype preview + critique loop**<br>
   Cauldron generates an HTML + AlpineJS prototype so you can see and click through the shape of the idea. Give natural-language feedback ("make the header bolder", "tighter spacing") and Cauldron regenerates the prototype in-place. Up to 3 critique iterations per session, with full iteration history and restore.

6. **Build-agent handoff**<br>
   Generate a handoff package with blueprint, prototype, design tokens, and a `cauldron.project.json` manifest — then launch it in your preferred agent CLI (Cursor, Claude Code, Codex, Hermes, OpenCode) or save it for later.

7. **Scaffold export**<br>
   Export as a real project scaffold: Next.js (TypeScript), Astro, static HTML, or AlpineJS. Each scaffold includes a runnable project skeleton with package.json, layout, and starter content wired to your blueprint and design system.

8. **Export and handoff**<br>
   Drafts and history are stored locally. Export Markdown/JSON, download the prototype HTML, or hand the blueprint to a coding agent.

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
- **Critique loop**: Give natural-language feedback on prototypes and regenerate in-place, with iteration history (v0.30)
- **Iterative Refinement**: Tweak generated blueprints with conversational prompts instead of starting from scratch
- Run locally with Ollama — no API costs and no data leaving your machine
- Optional cloud fallback using your own OpenAI or Google AI Studio API key
- Save/load drafts locally with searchable history
- Export blueprints as Markdown or JSON
- Save and download blueprints with one click
- **One-Click Downloads**: Download the generated raw HTML + AlpineJS `prototype.html` directly to your machine
- Create project folders with blueprint + agent stub for your preferred coding tool
- **Keyboard shortcuts**: Cmd/Ctrl+Enter to generate, Cmd/Ctrl+S to save, Cmd/Ctrl+Shift+P/N to move stages (v0.30)

### For design-conscious builders

- Expanded Design Reference dropdown with 150+ local `DESIGN.md` systems imported from Open Design, plus Refero style search for live inspiration
- **Refero Style Search** — Search the live Refero design directory for inspiration (results cached for 5 minutes)
- Dedicated one-URL cloner target field plus Brain Dump URL detection
- **Deep URL research mode** — Uses Playwright to extract CSS variables, fonts, colours, and layout patterns from reference sites
- Taste guardrails that avoid generic AI UI sludge: default Inter/Roboto, pure black, nested cards, and tired blue gradients
- Prompts for stronger spacing, typography, component states, and micro-interactions

### For power users

- **BYOK Build Agent Handoff** — Detect installed agent CLIs (Cursor, Claude Code, Codex, Hermes, OpenCode) and launch builds directly from the pipeline. Handoff includes blueprint, prototype, design tokens, and a `cauldron.project.json` manifest (v0.30)
- **Scaffold Export** — Generate real project scaffolds: Next.js with TypeScript, Astro, static HTML, or AlpineJS. Each scaffold is a runnable project skeleton wired to your blueprint (v0.30)
- **XML Tool Agent System** — Multi-turn build agent that writes, edits, and runs code in a sandboxed workspace
- **Workspace preview** — Live HTML preview of built files via `/workspace-preview/`
- **Pipeline Activity Log** — Real-time NDJSON streaming showing each stage's progress
- **8-stage pipeline** — Brain Dump → Interrogate → Design System → Blueprint → Prototype → Build → Scaffold Export → Handoff
- **Build mode** — Sandboxed workspace with file listing and agent-driven project generation
- Public-safe local records layer using `sql.js`
- Clear extension points for prompts, design systems, URL research, templates, and exporters
- MIT licensed and intentionally local-first

---

## First Blueprint

1. Enter an idea, for example: `A tiny CRM for freelance designers who hate spreadsheets`.
2. Pick **Local Router** or **Cloud Cauldron**.
3. Choose **App** or **Static Site**.
4. Pick a detected local Ollama model, or switch to Cloud Cauldron.
5. Optionally choose a design reference.
6. Optionally add one reference URL in the cloner target field, or paste a URL like `https://raycast.com` into Brain Dump to trigger research mode.
7. Optional but recommended: click **Interrogate Idea** to make Cauldron ask the annoying product-manager questions first.
8. Answer what you can in the pop-up. Blank answers are allowed and treated as unresolved assumptions.
9. Click **Generate Blueprint** or press **Cmd/Ctrl + Enter**.
10. Review the blueprint and HTML + AlpineJS preview.
11. **Give critique**: type feedback in the critique box ("make the CTA more aggressive") or use quick buttons ("Make it bolder", "Tighter spacing", "Warmer palette", "More accessible"). Up to 3 iterations per session.
12. Save/download, export, or click **Build with [Your Agent]** to generate a handoff package and launch it in Cursor, Claude Code, Codex, Hermes, or OpenCode.
13. Or click **Export Scaffold** to generate a runnable Next.js, Astro, or static HTML project.

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

Cloud Cauldron supports user-provided API keys stored in your browser localStorage.

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

### Port

Default: `3000`.

```bash
PORT=4000 npm start
```

### Local data

Drafts, sessions, and local runtime data are stored under `data/` and are gitignored by default.

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

- Blueprint diffing
- Blueprint gallery
- Multi-agent build orchestration
- Plugin marketplace for community scaffolds

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
