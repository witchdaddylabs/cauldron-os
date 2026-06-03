# Chasing Version 0.30 — Product Plan

> **Author:** Claudia (COO, Witch Daddy Labs)
> **Context:** Competitive research against Open Design, Dyad, Taste-Skill, and the broader AI-prototyping landscape (June 2026).
> **Goal:** A structured, autonomous-ready plan that gets Cauldron OS from v0.30 to v0.30 — a compelling open-source design-to-prototype pipeline.

---

## Table of Contents

1. [Competitive Landscape](#1-competitive-landscape)
2. [What to Steal from Open Design (and what to skip)](#2-what-to-steal-from-open-design)
3. [Execution Plan — Phases](#3-execution-plan)
   - [Phase 0: Infrastructure & Delegation Setup](#phase-0-infrastructure--delegation-setup)
   - [Phase 1: Design Systems Catalog — 22 → 150+](#phase-1-design-systems-catalog)
   - [Phase 2: Agent Execution Mode (Build stage rewrite)](#phase-2-agent-execution-mode)
   - [Phase 3: Critique & Review Loop](#phase-3-critique--review-loop)
   - [Phase 4: UI Polish — Production Feel](#phase-4-ui-polish)
   - [Phase 5: Scaffold Export & Template System](#phase-5-scaffold-export--template-system)
4. [Delegation Map — Who Does What](#4-delegation-map)
5. [Risk Register](#5-risk-register)
6. [Success Criteria](#6-success-criteria)

---

## 1. Competitive Landscape

### Who we found

| Tool | Approach | Strengths | Weaknesses |
|------|----------|-----------|------------|
| **Open Design** (nexu-io) | BYOK/CLI-based. No built-in AI. Routes through whatever agent you have (Cursor, Claude Code, Codex, Hermes, etc.) | 152 design systems, 261 plugins, 100+ skills, critique loops, workspace tabs, real scaffold export | No structured pipeline, no Annoying PM Mode, no Refero integration, no editable blueprint stage |
| **Dyad** | Open-source Bolt alternative. Local-first. App Blueprints (plan → generate) | Clean UX, plan-before-generate workflow, solid sandbox preview | No design taste engine, no multi-stage pipeline, web app focused only |
| **Taste-Skill** (Leon Lin) | System prompt + ruleset for AI design taste | Anti-slop mandate system, community adoption, works with any agent | Not a product — just a skill/prompt. No UI, no pipeline |
| **Libra / OpenStone** | Bolt clones, fast UI gen | Speed | One-shot only, no design depth |
| **Penpot / Quant-UX** | Traditional design tools | Mature, self-hostable | Not AI-native, no agent integration |

### Where Cauldron wins

- **7-stage deterministic pipeline** — nobody else has this. It's our moat.
- **Annoying PM Mode** — unique interrogation layer.
- **Refero deep search** — live API integration with real design styles.
- **Editable blueprint before prototype** — review before generation.
- **Already local-first with cloud fallback** and multiple provider support.

### Where we lose

- **22 design systems vs 152** — this is embarrassing. Easiest fix in the plan.
- **One-shot prototype** — no critique/review loop. Open Design has this.
- **Build stage is a stub** — just starts a session, doesn't actually build anything.
- **UI is functional but not polished** — padding, spacing, responsive handling.
- **Scaffold export doesn't scaffold** — Next.js/Astro templates just bias the prompt.

---

## 2. What to Steal from Open Design

### Steal Immediately (low effort, high impact)

| Feature | Why | Effort |
|---------|-----|--------|
| **Design systems catalog** — bulk import their 152 DESIGN.md files | Instant 7x increase in design references. Their DESIGN.md format is richer too (full palette + typography + use cases). | 1-2 hours |
| **DESIGN.md token schema** — enforce machine-readable colour/token contracts | Makes design systems auto-injectable into prompts. Currently we hand-write them. | 2-3 hours |
| **BYOK CLI execution model for Build stage** — instead of trying to build files, have Cauldron generate a handoff package and invoke the user's agent CLI | The Build stage is currently a stub. This makes it actually useful. | 4-6 hours |

### Adapt (medium effort, high impact)

| Feature | Why | Effort |
|---------|-----|--------|
| **Critique/review loop** — after prototype generation, allow "make the header less aggressive" and iterate in-place | Biggest UX gap. Open Design calls this "critique theater." | 6-8 hours |
| **Trigger-based skill discovery** — skills auto-activate based on the user's brain dump content | Makes the pipeline smarter about which design systems and templates to suggest. | 4-6 hours |

### Skip for now (not worth the effort)

| Feature | Why |
|---------|-----|
| Plugin marketplace (261 plugins) | Massive platform effort. Not our core value prop. |
| Workspace tabs | Nice for power users but won't drive adoption. |
| Desktop app | We're web-first. That's fine. |

---

## 3. Execution Plan

### Phase 0: Infrastructure & Delegation Setup

**Owner:** Claudia (orchestration) + Bobbi (implementation)

**Goal:** Make the repo delegation-ready so Cursor/Claude Code can work on specific files without stepping on each other.

**Tasks:**

1. [ ] **Add AGENTS.md** — document the repo structure, coding conventions, and delegation map so any agent can onboard in one read.
2. [ ] **Add .cursorrules** — project-specific rules for Cursor Agent (framework conventions, file layout, design tokens).
3. [ ] **Define public interfaces** for each subsystem (design systems API, template system, pipeline stages) so parallel work is safe.
4. [ ] **Document the BYOK/CLI execution contract** — what a handoff package looks like and how agent CLIs invoke it.

**Definition of done:**
- `AGENTS.md` exists and a fresh agent can build the project from scratch.
- `.cursorrules` is set.
- Public interfaces are documented at the top of each route file.

---

### Phase 1: Design Systems Catalog — 22 → 150+

**Owner:** Bobbi (bulk import + validation script) → Claudia (QA)

**Goal:** Import Open Design's `design-systems/` directory, normalise to Cauldron's format, and wire into the frontend.

**Tasks:**

1. [ ] **Stage 1.1 — Copy the raw catalog**
   - Clone latest `open-design.git`.
   - Copy `design-systems/` (152 directories) into Cauldron's `design-systems/`.
   - Each directory has a `DESIGN.md` with the full spec.

2. [ ] **Stage 1.2 — Normalise to Cauldron's format**
   - Cauldron's `server.js` has a `DESIGN_SYSTEMS` map with `{ name, repo, path }`.
   - Write a script (`scripts/import-design-systems.js`) that reads each `DESIGN.md`, extracts the name and key tokens, and appends to `DESIGN_SYSTEMS`.
   - Format: `{ id: 'apple', name: 'Apple', repo: null, path: 'design-systems/apple/DESIGN.md' }`

3. [ ] **Stage 1.3 — Wire into frontend dropdown**
   - The `/api/design-systems` endpoint already returns `DESIGN_SYSTEMS` as a list.
   - The frontend dropdown at `public/index.html` already iterates `designSystems`.
   - This should just work after the server restart. Smoke test it.

4. [ ] **Stage 1.4 — OPTIONAL: Add token schema**
   - Add a `tokens.schema.ts` or equivalent JSON schema that validates each DESIGN.md has: name, colors[], fonts[], visual_description.
   - Add a `scripts/validate-design-systems.js` that checks this on build.

**Definition of done:**
- Cauldron lists 150+ design systems in the "Design Reference" dropdown.
- Selecting one injects its tokens into the generation prompt.
- A validation script catches malformed entries.

---

### Phase 2: Agent Execution Mode (Build stage rewrite)

**Owner:** Claudia (architecture + prompt design) → Bobbi (implementation)

**Goal:** Replace the stub Build stage with a real agent-execution pipeline. When the user hits "Start Build," Cauldron doesn't try to build files itself — it generates a handoff package and lets the user's preferred agent CLI (Cursor, Claude Code, Codex, Hermes, etc.) execute it.

**This is the core steal from Open Design's BYOK/CLI model.**

**How Open Design does it:**
- No built-in AI. You bring your own key or CLI.
- The desktop app has a "daemon" that manages agent runs.
- Each run is a conversation with an agent. The app shows run status, streaming output, and results.
- The app generates a structured brief/prompt, hands it to the agent CLI, and displays the result.

**How Cauldron should do it:**

1. [ ] **Stage 2.1 — Handoff package format**
   - Define a standard handoff bundle: `{ blueprint.md, prototype.html, design-system.md, cauldron.project.json }`.
   - This already exists partially in `routes/projects.js` (the handoff endpoint saves these files).
   - Formalise it with a schema and a `cauldron.project.json` manifest.

2. [ ] **Stage 2.2 — CLI detection**
   - On the Settings panel, add a "Build agent" selector.
   - Detect installed CLIs: `which cursor`, `which claude`, `which codex`, `which opencode`.
   - Default: "Generate handoff package" (the current export flow).
   - Options per detected CLI: "Build with Cursor", "Build with Claude Code", etc.

3. [ ] **Stage 2.3 — Build invocation**
   - When the user clicks "Build with Cursor," Cauldron:
     1. Generates the handoff bundle in `projects/<name>/`.
     2. Creates a `.cursorrules` file in the project with taste mandates.
     3. Opens Cursor to that directory: `cursor projects/<name>/`.
     4. OR invokes `cursor projects/<name>/README.md` to open with instructions.
   - For CLI-based agents:
     1. Generates a build prompt from the blueprint.
     2. Runs `cursor --prompt "Build this project from the spec in blueprint.md"`.
     3. Streams output back to Cauldron's pipeline log.

4. [ ] **Stage 2.4 — Build status tracking**
   - Add a build session poller that checks the project directory for changes.
   - When the agent finishes (detect via exit code or file modification), mark the build stage as complete.
   - Show build output in the pipeline log.

**Definition of done:**
- User can choose "Build with Cursor" from the Build stage.
- Cauldron generates a handoff bundle + kicks Cursor open to the project.
- Pipeline log shows build progress.
- Build completes and files are available in the project folder.

---

### Phase 3: Critique & Review Loop

**Owner:** Claudia (UX + prompt design) → Cursor Agent (frontend)

**Goal:** After prototype generation, allow the user to give natural-language feedback and have Cauldron regenerate the prototype in-place. This is the "critique theater" from Open Design.

**Tasks:**

1. [ ] **Stage 3.1 — Critique input**
   - Below the generated prototype preview, add a critique textarea: "What would you change?"
   - Show the last 3-5 iterations in a timeline on the left side of the preview panel.

2. [ ] **Stage 3.2 — Critique injection into generation**
   - When the user submits critique:
     1. Append the feedback to the generation prompt.
     2. Re-run the prototype generation with `{ ...originalPrompt, critique: feedback }`.
     3. Diff the new output against the old one.
     4. Show a side-by-side or overlay comparison in the preview panel.

3. [ ] **Stage 3.3 — Iteration history**
   - Each prototype iteration gets a snapshot saved to the draft.
   - User can scroll back through iterations or revert.
   - Show iteration count: "v3 / 5 iterations."

4. [ ] **Stage 3.4 — Voice/mood critique shortcuts**
   - Quick-buttons: "Make it bolder", "Tighter spacing", "Warmer palette", "More accessible".
   - Each injects a specific prompt tweak without the user having to type.

**Definition of done:**
- User can type "make the header bigger and the cards tighter" and see a regenerated prototype.
- Iteration history shows all versions with diff.
- Quick-buttons work for common feedback patterns.

---

### Phase 4: UI Polish — Production Feel

**Owner:** Cursor Agent (frontend)

**Goal:** Take the UI from "functional dark theme" to "polished tool" — without breaking the existing layout.

**Tasks:**

1. [ ] **Stage 4.1 — Pipeline progress bar**
   - During generation, show an estimated progress bar per stage.
   - Blueprint: ~2 min → show a 120s progress bar with stage breakdown.
   - Prototype: ~3 min → show a 180s progress bar.
   - Use real timing data from `pipelineComplete.duration` to calibrate estimates.

2. [ ] **Stage 4.2 — Empty states**
   - Replace "Nothing brewed yet" with contextual onboarding:
     - First visit: sample prompts, quick-start guide.
     - Returning user: recent drafts list, "pick up where you left off."
   - Open Design's home screen does this well — show template prompts.

3. [ ] **Stage 4.3 — Toast notification polish**
   - Add type hierarchy: success (green), warn (amber), error (red), info (purple).
   - Auto-dismiss after 3s for success/info, stay for warn/error.
   - Better positioning — fixed top-right with stacking.

4. [ ] **Stage 4.4 — Keyboard shortcuts**
   - Cmd+Enter = Generate (works for brain dump / regenerate)
   - Cmd+S = Save draft
   - Cmd+Shift+P = Previous pipeline stage
   - Cmd+Shift+N = Next pipeline stage
   - Tab between preview/log panels

5. [ ] **Stage 4.5 — Settings modal**
   - API key entry is functional but bare. Add:
     - Connection test button (ping the provider).
     - Key health indicator (green/yellow/red).
     - Provider-specific notes (e.g., "OpenAI models: gpt-5.4 is fastest, o4-mini is cheapest").

6. [ ] **Stage 4.6 — Responsive viewport handling**
   - Ensure the UI works at 1280px width (many developers use side-by-side).
   - Ensure it works at 1920px width (capped at a comfortable max).
   - The current layout is functional but the right panel feels empty on large screens.

**Definition of done:**
- First-time user sees onboarding prompts instead of "Nothing brewed yet."
- Generation shows a progress bar with ETA.
- Keyboard shortcuts work across the app.
- Settings modal has connection testing.
- Layout is comfortable at 1280–1920px.

---

### Phase 5: Scaffold Export & Template System

**Owner:** Bobbi (scaffold generators) → Claudia (QA)

**Goal:** Make the Next.js and Astro templates actually generate real scaffolded projects, not just bias the AI prompt.

**Tasks:**

1. [ ] **Stage 5.1 — Scaffold definitions**
   - For each template in `TEMPLATES`, define a `scaffoldFiles()` function that generates the actual project structure:
     - `nextjs`: `npx create-next-app@latest --typescript` equivalent, then write in the generated components.
     - `astro`: `npm create astro@latest` equivalent.
     - `static-html`: Write `index.html`, `styles.css` directly.
     - `html-alpine`: Write `index.html`, `styles.css`, `app.js` directly.

2. [ ] **Stage 5.2 — Handoff pipeline**
   - After blueprint + prototype generation:
     1. User selects "Export as Next.js project."
     2. Cauldron scaffolds the project skeleton.
     3. Writes the generated component files into the skeleton.
     4. Saves to `projects/<name>/` with a `README.md` explaining how to run it.
     5. Option: auto-run `npm install && npm run dev` in a terminal.

3. [ ] **Stage 5.3 — OpenDesign-style agent handoff**
   - Instead of Cauldron generating the code itself, generate a detailed spec and let the user's agent CLI build it.
   - The spec includes: design tokens, component list, page structure, data models.
   - The agent gets invoked: `cursor --prompt "Build this project" projects/<name>/`.

**Definition of done:**
- Exporting as Next.js creates a runnable `npm install && npm run dev` project.
- Exporting as Astro creates a runnable Astro project.
- Agent handoff generates a complete spec and invokes the user's CLI.

---

## 4. Delegation Map

| Phase | Work Package | Who | Method |
|-------|-------------|-----|--------|
| **P0** | AGENTS.md + .cursorrules | Claudia | Write directly |
| **P1** | Design systems import | Bobbi | Terminal + file tools |
| **P1** | Token schema + validator | Bobbi | Terminal + file tools |
| **P1** | QA the 150 systems | Claudia | Spot-check 10-15 systems via curl |
| **P2** | Handoff package format | Claudia | Architecture design, then Bobbi implements |
| **P2** | CLI detection + settings | Cursor Agent | Frontend work in cursor |
| **P2** | Build invocation | Bobbi | Backend routes |
| **P2** | Build status tracking | Bobbi | Backend + frontend |
| **P3** | Critique UI | Cursor Agent | Frontend components |
| **P3** | Critique backend prompt injection | Claudia | Prompt design + route wiring |
| **P3** | Iteration history | Bobbi | DB schema + API routes |
| **P4** | Progress bar | Cursor Agent | Frontend component |
| **P4** | Empty states | Cursor Agent | Frontend component |
| **P4** | Toasts + shortcuts | Cursor Agent | Frontend polish |
| **P4** | Settings modal | Cursor Agent | Frontend component |
| **P5** | Scaffold definitions | Bobbi | Backend file generation |
| **P5** | Agent handoff | Claudia + Bobbi | Architecture + implementation |

**Delegation flow:**
1. Claudia writes the spec for each phase.
2. Low-risk implementation tasks → delegated to Bobbi (file tools + terminal) or Cursor Agent (frontend components).
3. High-risk architecture/architecture → Claudia owns (prompt design, API contracts, data flow).
4. Every phase ends with QA by Claudia before phase is marked done.

---

## 5. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Open Design's DESIGN.md format is incompatible with our prompt injection | Medium | High — Phase 1 fails | Our system accepts any markdown. We just need `name:` and basic colour info. If full palette parsing fails, fall back to "design system X is selected" as plain text injection. |
| Cursor CLI invocation breaks on different macOS versions | Medium | Medium — Phase 2 fails | Wrap in try/catch. Fall back to "save handoff package" if CLI invocation fails. Show clear error message. |
| Critique loop burns too many API tokens | High | Medium — Phase 3 | Limit critique iterations to 3 per session. Show estimated token cost before regeneration. |
| Next.js scaffolding creates broken projects (wrong versions, missing deps) | High | Medium — Phase 5 | Use `npx create-next-app@latest` for baseline. Add smoke test that runs `npm run build` on the scaffolded project. |
| UI polish changes break existing layout | Medium | High — Phase 4 | All CSS changes must use the existing token system. Visual regression test: compare before/after screenshots of key pages. |

---

## 6. Success Criteria

Cauldron OS v0.30 ships when:

- [ ] **150+ design systems** in the Design Reference dropdown (up from 22).
- [ ] **Build stage invokes real agents** — user can choose Cursor/Claude Code and Cauldron generates a handoff + launches the build.
- [ ] **Critique loop works** — user can give feedback and regenerate the prototype in-place with iteration history.
- [ ] **UI feels polished** — progress bars, empty states, keyboard shortcuts, toast hierarchy, responsive layout.
- [ ] **Scaffold export works** — Next.js/Astro exports create real, runnable projects.
- [ ] **All CI tests pass** — existing smoke tests + new tests for build invocation, critique, scaffold generation.
- [ ] **No regressions** — existing pipeline (Brain Dump → Blueprint → Prototype → Export) still works exactly as before.

---

## Appendix: Quick Reference — Key Files

| File | Purpose | Phase |
|------|---------|-------|
| `server.js` | TEMPLATES constant, DESIGN_SYSTEMS map, route registration, prompt system | All |
| `routes/generation.js` | Blueprint + prototype generation endpoints | P3 |
| `routes/projects.js` | Handoff/export, project folder creation | P2, P5 |
| `routes/build.js` | Build session management | P2 |
| `routes/models-design.js` | Design systems API, Refero search | P1 |
| `public/scripts/app.js` | Frontend AlpineJS app — all pipeline logic | P2, P3, P4 |
| `public/index.html` | Frontend templates | P2, P3, P4 |
| `public/styles/app.css` | All layout CSS | P4 |
| `public/styles/tokens.css` | Design tokens (colours, spacing, fonts) | P4 |
| `db/index.js` | SQLite database schema | P3 (iteration history) |
| `scripts/import-design-systems.js` | **New** — bulk import script | P1 |
| `scripts/validate-design-systems.js` | **New** — validation script | P1 |
| `design-systems/` | **Enhanced** — 150+ design systems | P1 |
