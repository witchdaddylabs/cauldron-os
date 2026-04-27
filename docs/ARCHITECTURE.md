# Cauldron OS Architecture

**Version:** 2.1
**Core Principle:** Local-first, modular, skill-based Master Brain upgrades.

---

## System Overview

Cauldron OS is a Node.js/Express server that sits between your UI (or API client) and an LLM (Ollama locally, OpenAI/Gemini in cloud). Its job is to **enrich** the user's raw idea with structured design intelligence before sending it to the model, then return a **blueprint** with PRD, schema, security notes, architecture, and HTML preview.

```
User Idea → Prompt Builder (Master Brain) → LLM → Blueprint → Handoff
```

---

## Core Components

### 1. Frontend (`public/index.html`)

**Role:** Single-page application

**Structure:**
- Three-panel layout: Brain Dump (left) | Blueprint (center) | Live Preview (right)
- Bottom bar: Generate + Execute buttons
- Pure HTML + inline JS (no bundler)

**State:**
```javascript
{
  prompt,                    // raw brain dump text
  projectName,
  generationMode,            // 'local' | 'cloud'
  projectType,               // 'app' | 'site'
  designReference,           // 'none' | 'cursor' | 'vercel' | ...
  cloudProvider,             // 'openai' | 'gemini'
  apiKeys { openai, google },
  currentResearchData,       // scraped URL findings (object)
  currentBlueprint           // last generated markdown+html
}
```

**Key functions:**
- `generateBlueprint()` — orchestrates: detect URLs → trigger research → POST /api/generate → render
- `detectURLs()` — regex finds `https?://...` in prompt
- `triggerResearch()` — POST /api/research-url, waits, stores `currentResearchData`
- `parseBlueprint()` — extracts HTML code block from markdown for preview iframe
- `renderPreviewHTML()` — writes iframe

---

### 2. Backend (`server.js`)

**Role:** API server + LLM router + design intelligence injector

**Routes:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Health check — returns `{status:'ok', service:'Cauldron 2.1'}` |
| `/api/design-systems` | GET | Returns list of available brand references |
| `/api/design-reference` | POST | Fetch DESIGN.md from GitHub, cache in memory |
| `/api/research-url` | POST | Scrape URL, extract design signals, return formatted findings |
| `/api/generate` | POST | Main generation — builds system prompt, calls LLM, returns blueprint |
| `/api/handoff` | POST | Create project folder, save blueprint, spawn OpenCode process |

**Global State:**
```javascript
const DESIGN_SYSTEMS = { none, cursor, vercel, lovable, raycast } // brand → repo mapping
const designSystemCache = new Map() // { brand: DESIGN.md string }
```

**Prompt Building Flow (generate route):**

```javascript
function getSystemPrompt(projectType, designReference) {
  let prompt = projectType === 'site' ? SITE_SYSTEM_PROMPT : APP_SYSTEM_PROMPT
  
  // 1. Impeccable Taste — DESIGN_GUIDE is already baked into SITE/APP prompts
  prompt = basePrompt // includes DESIGN_GUIDE upfront

  // 2. Design Reference (if selected)
  if (designReference && designReference !== 'none') {
    const designContent = designSystemCache.get(designReference)
    if (designContent) {
      prompt = `# Design Reference: ${brand}\n\n${designContent}\n\n---\n\n${prompt}`
    }
  }

  return prompt
}
```

Then, inside the generate handler:

```javascript
if (researchData && researchData.formatted) {
  systemPrompt += `\n\n${researchData.formatted}\n\nUse these design signals to match the visual language.`
}
```

Result: system prompt stack = `[Design Reference (optional)] + [Base Prompt with Taste] + [Research Findings (optional)]`

---

### 3. Master Brain Upgrades (Skills)

Each upgrade is a **self-contained module** that can be used as a skill outside Cauldron.

#### Skill: `impeccable-taste`
- **File:** `~/.hermes/skills/impeccable-taste/SKILL.md`
- **Provides:** DESIGN_GUIDE vocabulary (ANTI-PATTERNS + MANDATES)
- **Usage:** Load in any agent session to enforce premium design output
- **Note:** Already embedded in Cauldron's system prompts; loading separately is for external usage

#### Skill: `design-reference-selector`
- **File:** `~/.hermes/skills/design-reference-selector/SKILL.md`
- **Provides:** `GET/POST /api/design-reference` pattern and brand fetching logic
- **Usage:** Load when you need brand DNA in any prompt
- **Dependency:** Relies on `awesome-design-md` repo availability

#### Skill: `url-research-sweep`
- **File:** `~/.hermes/skills/url-research-sweep/SKILL.md`
- **Provides:** `scrapeURL()` + `analyseHTML()` + format logic
- **Usage:** Load when you need to analyse a website's design tokens

---

## Data Flow

### Blueprint Generation (Happy Path)

1. **User** → fills Brain Dump, selects options, hits Cmd+Enter
2. **Frontend** → `detectURLs()` finds URL? → if yes, shows "Researching" badge → `fetch('/api/research-url')` → stores `currentResearchData`
3. **Frontend** → `fetch('/api/generate', { prompt, model, designReference, researchData })`
4. **Backend** → `getSystemPrompt()` builds base + designRef
5. **Backend** → appends `researchData.formatted` if present
6. **Backend** → routes to Ollama (`/api/generate` route for local) or Cloud
7. **LLM** → returns blueprint markdown with optional HTML block
8. **Backend** → `{ success: true, blueprint, canHandoff: true }`
9. **Frontend** → syntax-highlights markdown, extracts HTML → renders in iframe
10. **User** → clicks Execute → `POST /api/handoff` → creates `projects/{name}/` → spawns OpenCode daemon

### URL Research Flow

1. **Frontend** detects URL in prompt → calls `POST /api/research-url` with `{url}`
2. **Backend** `scrapeURL()` → native `http.get` or `https.get` → raw HTML
3. **Backend** `analyseHTML(html)` → 
   - regex: `--[\w-]+\s*:\s*[^;]+` → CSS vars object
   - regex: `fonts\.googleapis\.com[^"'>]*` → font families
   - regex: `#[0-9A-Fa-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\)` → colors
   - string presence: `flex`, `grid`, `container`, `border-radius`, `box-shadow` → structure notes
4. **Backend** `formatResearchForPrompt()` → Markdown block
5. **Response** `{ success: true, findings, formatted }` → frontend stores
6. **Prompt injection** happens in `/api/generate` before calling LLM

---

## Extension Points

### Adding a New Design System
1. Create `design-systems/{handle}/DESIGN.md` (follow VoltAgent spec)
2. Add entry to `DESIGN_SYSTEMS` in `server.js`
3. Add `<option>` in `index.html`
4. Optionally add skill variant in `skills/design-reference-selector/`

### Adding a New Prompt Injection
1. Edit `APP_SYSTEM_PROMPT` or `SITE_SYSTEM_PROMPT` constants in `server.js`
2. Consider extracting to a skill file if it's reusable across projects
3. Document in `docs/`

### Switching to a Different LLM Backend
Cauldron is currently Ollama-first. To add another local provider:
1. Add new route handler like `/api/generate-llama.cpp` or `/api/generate-litellm`
2. Mirror the `/api/generate` signature
3. Update frontend `getRoutedModel()` and UI dropdown
4. Keep abstraction layer — don't hardcode assumptions

---

## Security Considerations

- **No authentication** — Cauldron is localhost-only. If exposing externally, add basic auth or IP whitelist.
- **API keys stored in browser** — localStorage, never sent to our server except to OpenAI/Gemini directly from backend.
- **OpenCode handoff** — runs with full filesystem access to `projects/{name}/`. Ensure that directory is trusted.
- **URL research** — subject to SSRF if user puts internal IPs. Currently no protection; assumes single-user local context. For multi-user, add URL allowlist or block private ranges.

---

## Performance Notes

- **Design reference cache** — in-memory Map, persists until server restart (~MB). Cold start on first use per brand (200-500ms GitHub fetch).
- **Research scraper** — synchronous `http.get`, no timeouts besides Node defaults (~2min). Consider adding `timeout: 10000` for robustness.
- **Ollama** — streaming not implemented; `stream: false` waits for full completion. Large models (9B) at 8192 tokens can take 60–90s. Use gemma4:e4b for ~15s drafts.
- **Frontend** — no bundler, just one HTML file. CDN Tailwind adds ~30KB.

---

## Future Roadmap (2.2 ideas)

- [ ] Docker + docker-compose with Ollama container included
- [ ] Streaming responses (Server-Sent Events) for progressive blueprint rendering
- [ ] Project templates library (SaaS, mobile app, blog, dashboard)
- [ ] Built-in accessibility audit on generated HTML
- [ ] Export to Notion/Linear via API
- [ ] "Compare designs" mode — research two URLs and diff their design tokens
- [ ] Skill marketplace — load `design-reference` and `url-research` as separate npm-installable packages

---

*Architecture document version: 2.1 — Last updated 2026-04-27 by Hermes Agent for Witch Daddy Labs*
