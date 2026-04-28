# Cauldron OS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.3.0-blue.svg)](CHANGELOG.md)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![GitHub](https://img.shields.io/badge/github-witchdaddylabs-181717.svg)](https://github.com/witchdaddylabs)

<div align="center">

<img src="assets/hero-header.png" alt="Cauldron OS Hero" width="100%"/>

</div>

> **Bring the messy idea. Cauldron brings the structure, taste, and next steps.**

Cauldron OS is a local-first workshop for AI-assisted builders. Drop in a rough app or website idea, choose a model or design reference, and Cauldron turns the mess into a structured product blueprint with architecture notes, schema ideas, exportable docs, and a live HTML + AlpineJS prototype preview.

It is built for hobbyists, indie builders, designers, enthusiasts, and developers who want better AI output than “make me a nice dashboard”.

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

## What Cauldron does

1. **You brain-dump the idea**<br>
   Write naturally. Messy is fine. Paste reference URLs if you have them.

2. **Cauldron adds taste and context**<br>
   It injects design rules, optional brand/design references, and URL research before the model sees your prompt.

3. **The model creates a blueprint**<br>
   You get product notes, architecture direction, schema ideas, security considerations, and implementation guidance.

4. **You get a live preview**<br>
   Cauldron asks the model for an HTML + AlpineJS prototype preview so you can see and click through the shape of the idea, not just read about it.

5. **You save, export, or hand it off**<br>
   Drafts and history are stored locally. You can export Markdown/JSON or hand the blueprint to a coding agent such as OpenCode.

---

## Screenshots

**Full three-panel interface** — Brain Dump, Blueprint Output, HTML + AlpineJS Preview<br>
![Main UI](assets/screenshots/01-main-ui.png)

**Design Reference selector** — fuse brand DNA from Cursor, Vercel, Lovable, Raycast, Linear, Stripe, Notion, Apple, Figma, Supabase, Resend, Webflow, or OpenCode<br>
![Design Reference Dropdown](assets/screenshots/02-design-dropdown.png)

---

## Features

### For hobbyists and solo builders

- Turn rough ideas into structured build blueprints
- Run locally with Ollama — no API costs and no data leaving your machine
- Optional cloud fallback using your own OpenAI or Google AI Studio API key
- Save/load drafts locally with searchable history
- Export blueprints as Markdown or JSON
- Save and download blueprints with one click
- Generate a live HTML + AlpineJS prototype preview alongside the written blueprint
- Create project folders and hand off to OpenCode/CLI agents

### For design-conscious builders

- Expanded Design Reference dropdown for Cursor, Vercel, Lovable, Raycast, Linear, Stripe, Notion, Apple, Figma, Supabase, Resend, Webflow, and OpenCode-style visual direction
- Dedicated one-URL cloner target field plus Brain Dump URL detection
- URL research mode that extracts CSS variables, fonts, colours, and layout hints from reference sites
- Taste guardrails that avoid generic AI UI sludge: default Inter/Roboto, pure black, nested cards, and tired blue gradients
- Prompts for stronger spacing, typography, component states, and micro-interactions

### For contributors

- Small Express backend and vanilla frontend
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
7. Click **Generate Blueprint** or press **Cmd/Ctrl + Enter**.
8. Review the blueprint and HTML + AlpineJS preview.
9. Save/download, export, or click **Execute & Hand-off** if you want a coding agent to start building.

---

## Model Routing

### Local models

Cauldron auto-detects local Ollama models from `/api/tags` on startup and fills the Local Ollama Model dropdown. Defaults remain available as fallbacks:

| Project Type | Default Local Model | Best For |
|--------------|---------------------|----------|
| App / product blueprint | `qwen3.5:9b` | Architecture, state, schema, full-stack planning |
| Static site / landing page | `gemma4:e4b` | Layout, visual hierarchy, static markup |

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

Cauldron’s prompt builder adds three design-aware upgrades before generation:

| Module | What it does |
|--------|--------------|
| Impeccable Taste | Adds design anti-patterns and premium UI mandates |
| Design Reference Selector | Pulls brand DNA from `awesome-design-md` style references |
| URL Research Sweep | Scrapes the dedicated reference URL or first Brain Dump URL for CSS variables, fonts, colours, and layout patterns |

This means the model gets more than “build me an app”. It gets taste, constraints, references, and context.

---

## Project Structure

```text
cauldron-os/
├── server.js               # Express backend, model proxy, prompt builder, research scraper
├── db/                     # Local sql.js records backend
├── public/
│   └── index.html          # Frontend cockpit with HTML + AlpineJS preview
├── projects/               # Generated handoff projects (gitignored)
├── data/                   # Local runtime DB/drafts (gitignored)
├── docs/                   # Architecture, install, contributing, and upgrade notes
├── examples/               # Example blueprints/design references
├── scripts/                # Validation/support scripts
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

- Templates library
- Blueprint diffing
- Blueprint gallery
- Basic scaffold generator

The private Witch Daddy Labs build has more experimental automation, build-status, and coding-agent orchestration. Public Cauldron will get the stable, broadly useful pieces as they mature.

---

## Acknowledgments & Inspirations

- [impeccable.style](https://impeccable.style) — design taste manifesto inspiration
- [taste-skill](https://github.com/Leonxlnx/taste-skill) by Leonxlnx — high-agency frontend taste patterns
- [ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template) by JCodesMore — reconnaissance inspiration for URL research
- [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) — DESIGN.md concept and design-system references

---

## License

MIT License — see [LICENSE](LICENSE).

---

<div align="center">

**Built with 💜 by [Witch Daddy Labs](https://witchdaddylabs.com)**

**Happy cooking. 🔥**

</div>
