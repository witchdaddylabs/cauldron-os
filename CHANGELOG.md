# Changelog

All notable changes to Cauldron OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note:** Prior history (v2.x era) has been archived to `docs/history/CHANGELOG-2.x.md`.
> The version was reset to 0.240.0 to reflect the unification Sprint 1 milestone.

---

## [Unreleased]

### Fixed
- **Windows Quick Start**: Updated the Batch and PowerShell launchers for v0.40, Node.js 18+ validation, dependency repair, package-driven startup, and cloud-or-local model guidance.
- **Windows Scaffold Bootstrap**: Use `npm.cmd` when automatically installing generated scaffold dependencies on Windows.
- **Windows CI**: Run the full smoke suite on `windows-latest` for every pull request and main-branch update.

### Changed
- Simplified the README start path and first-blueprint walkthrough to reduce setup friction and cognitive overload.

## [0.40.0] — 2026-06-04 — Blueprint Review, Multi-Agent Handoffs, Community, and Quality

### Added
- **Blueprint Version History & Diffing**: Save blueprint snapshots, restore earlier versions, and inspect structured line-level additions/removals before moving into prototype generation.
- **Multi-Agent Build Orchestration**: Select multiple detected build agents, create scoped handoff packages, and coordinate them through a shared root `cauldron.project.json` manifest.
- **Community Catalog**: Browse curated community DESIGN.md systems and scaffold starter guidance from the Taste Engine. Imported design systems are stored as local runtime data and become selectable immediately.
- **Prototype Quality Scoring**: Score generated prototypes across accessibility, visual hierarchy, spacing, color contrast, and semantic HTML. C/D output shows PM-style suggestions before the critique loop.
- **Release QA Assets**: Captured local-only desktop/mobile screenshots and walkthrough evidence under the ignored `test-images-codex/` directory.

### Changed
- Version bumped to `0.40.0` across package metadata, runtime health/status copy, the UI version ribbon, README, and current architecture/interface docs.
- README now documents the actual 7-stage pipeline and the v0.40 feature set.
- Prototype generation now reports a third progress stage for local quality scoring.
- The test runner now includes community marketplace and quality scorer smoke coverage.

### Notes
- Community design-system imports live under `data/community/design-systems/` or `CAULDRON_DATA_DIR`; runtime imports are not source-controlled.
- Community scaffold starters currently layer prompt guidance onto supported base scaffolds rather than introducing new deterministic scaffold writers.
- Release tag `v0.40.0` should be created from the merged release commit after Phase 5 review.

## [0.30.0] — 2026-06-03 — 5-Phase Codex Sprint (v0.30)

### Added
- **Design Systems Catalog**: 150+ design systems imported from Open Design (nexu-io). Bulk import script (`scripts/import-design-systems.js`) and validation script (`scripts/validate-design-systems.js`). Wired into the frontend Design Reference dropdown.
- **BYOK Build Agent Handoff**: Detect installed agent CLIs (Cursor, Claude Code, Codex, Hermes, OpenCode) via `which`. Generate handoff packages with `cauldron.project.json` manifest. All detected agents support automated launch — Cursor/OpenCode open the project directory; Claude Code, Codex, and Hermes run the agent prompt in the project directory.
- **Critique & Review Loop**: After prototype generation, give natural-language feedback and regenerate in-place. Quick-action buttons: "Make it bolder", "Tighter spacing", "Warmer palette", "More accessible". Iteration history with restore. 3-iteration cap per session with token cost estimates.
- **Scaffold Export**: Generate real project scaffolds — Next.js (TypeScript), Astro, static HTML, AlpineJS. Each scaffold includes a runnable project skeleton with package.json, layout, and starter content. Optional `bootstrap` flag runs `npm install` automatically.
- **UI Polish**: Pipeline progress bar with time estimates. Toast notification system (success/warn/error/info with auto-dismiss). Settings modal with connection testing, Build Agents tab, and provider-specific notes. Keyboard shortcuts (Cmd+Ctrl+Enter, Cmd+Ctrl+S, Cmd+Ctrl+Shift+P/N, Tab). Responsive breakpoints at 1180px and 720px. Sample prompt onboarding for first-time users.
- **Version bump**: `package.json` → v0.30.0 across all surfaces.

### Changed
- `createHandoffPackage()` is now async to support scaffold bootstrap.
- Build agent launch: Claude Code, Codex, and Hermes changed from manual-prompt to automated run-prompt (all 5 agents now auto-launch).
- Critique iterations capped at 3 per session with token cost estimates shown in status bar.
- README rewritten with v0.30 features, 8-stage pipeline, and updated screenshots.

### Fixed
- Handoff smoke test: `/api/handoff` route now properly awaits async `createHandoffPackage()`.
- Scaffold smoke test: updated for async `createHandoffPackage()`.
- Removed `build-status-smoke.js` and `private-records-smoke.js` from `npm test` runner (require external server).

---

## [0.260.0] — 2026-06-03 — Refactor & Polish (Sprint 5)

### Added
- **Blueprint/Prototype Split**: Separate `generate-prototype` endpoint, editable blueprint UI, and refined handoff flow. Build now uses blueprint output for better consistency.
- **Route Extraction Refactor** (Phase 1+2): All routes extracted from monolithic `server.js` into `routes/` barrel (build, drafts, generation, history, models-design, projects, proxy, research-history, spa-catchall, status, templates, workspace-preview). `server.js` slimmed from ~2,200 LOC to focused composition root.
- **Pipeline Activity Log**: NDJSON streaming throughout generation pipeline — real-time status updates pushed to frontend for visibility into each stage.
- **Refero Deep Search**: Full Refero catalog API integration with 5-minute cache for design-style discovery. Replaced orphan styles with current API catalog entries.
- **Comprehensive Smoke Tests**: New `handoff-smoke.js` covering end-to-end handoff/export flow, build-workspace file operations, and template generation.
- **Design System Injection Fix**: Live fetch from design reference URLs — content now properly injected into system prompt.
- **Model Label Polish**: Better model labels displayed in provider/model navigation panel.

### Changed
- **Version bump**: `package.json` → v0.30.0, startup banner → "Cauldron OS v0.30 (Refactor & Polish Sprint 5)"
- **Design Systems Trimmed**: Refero catalog cleaned up — orphan entries removed, replaced with working API results.
- **Frontend UI**: Updated version badge from v0.250 to v0.30 across all surfaces

### Fixed
- Design system injection: fetch content now properly injected into system prompt during generation
- Handoff/export flow post-split: prototype HTML correctly saved, build uses blueprint output, UI button states consistent

## [0.250.0] — 2026-05-16 — Polish & Release (Sprint 4)

### Added
- **7-Stage Pipeline UI**: Build stage added between Prototype and Export, making the full pipeline: Brain Dump → Interrogate → Design System → Blueprint → Prototype → Build → Export.
- **Build Stage Frontend**: Start build workspace, file listing with preview links, workspace iframe preview, handoff to export flow.
- **Workspace Preview Server**: `/workspace-preview/:sessionId/` middleware for serving built files from sandboxed workspaces.

### Changed
- **Version bump**: `package.json` → v0.250.0, startup banner → "Cauldron OS v0.250"
- **Rebranded agent**: System prompt changed from "Private Cauldron" to "Cauldron OS"
- **Version consistency**: Frontend UI ribbon changed from "v3.0" to "v0.250"
- **MANIFEST.md**: Complete rewrite documenting actual v0.250 structure
- **ARCHITECTURE.md**: Full rewrite documenting unified architecture with AlpineJS SPA, 7-stage pipeline, XML agent system, build pipeline
- **GETTING_STARTED.md**: Fixed repo URL (`witch-daddy-labs` → `witchdaddylabs`)
- **DESIGN_REFERENCE.md**: Fixed repo URLs throughout
- **PUSH_GUIDE.md**: Replaced with brief deprecation notice (one-time setup, no longer relevant)
- **All smoke tests updated**: Model version strings, frontend DOM checks, build API endpoint verification

### Fixed
- Stale frontend static smoke test (checked for old DOM IDs that no longer exist)
- Cloud model version string test (gemini-3.1-flash-lite → gemini-3.1-flash-lite-preview)

## [0.240.0] — 2026-05-16 — Unification Sprint 1

### Added
- **Database schema merge**: `research_history` and `project_status_overrides` tables merged from private build into public `db/index.js`.
  - `research_history` tracks URL research sweeps with findings, favorites, and reuse counts.
  - `project_status_overrides` stores manual status overrides for build projects.
- **XML Tool Agent System** (`lib/` directory): agent-loop.js, tools.js, workspace.js, xml-parser.js — multi-turn model <-> tool loop for AI-assisted project building.
- **AlpineJS SPA Frontend**: Replaced vanilla JS + Tailwind CDN frontend with private's AlpineJS single-page app (`public/index.html`, `scripts/app.js`, `styles/tokens.css`, `styles/app.css`).
- **Scaffold Templates**: 4 template types (static HTML, HTML+AlpineJS, React+Vite+Tailwind, Next.js) with associated API endpoint `/api/templates`.
- **Refero Design Styles**: 14 curated design references from refero.design merged into the DESIGN_SYSTEMS catalog.
- **API Routes ported from private build**:
  - GET/POST `/api/research-history` + POST `/api/research-history/:id/favorite`
  - GET `/api/templates`, GET `/api/build-status`
  - POST/DELETE `/api/projects/:name/status`
  - POST `/api/projects/:name/resume`, POST `/api/projects/:name/open-visible`
  - POST `/api/projects/import`
  - POST `/api/build/start`, `/api/build/generate` (SSE), `/api/build/refine` (SSE), `/api/build/stop`
  - GET `/api/build/files/:sessionId`, `/api/build/file/:sessionId`, `/api/build/status/:sessionId`
  - POST `/api/chat/completions` (OpenAI-compatible proxy)
  - Static: `/workspace-preview/:sessionId/*`, `/research-assets/*`
- **Build Pipeline**: End-to-end project building workflow with workspace sandboxing, SSE streaming, and OpenCode handoff.
- **Project Import**: Import existing project folders as drafts via `/api/projects/import`.
- **Build Status Monitoring**: Auto-detection of running/stalled/completed/failed projects with manual status overrides.

### Changed
- **Version bump**: `package.json` → v0.240.0, startup banner → "Cauldron OS v0.240"
- **README.md**: Banner and version references updated to v0.240
- **CHANGELOG.md**: Previous v2.x history archived to `docs/history/CHANGELOG-2.x.md`
- **Design systems**: Expanded from 13 to 27 entries (14 Refero styles + 13 curated brands)
- **Cloud model routing**: Updated `callCloudModel` to support flexible base URLs via `normaliseOpenAICompatibleChatUrl`
- **Handoff flow**: Enhanced to copy build workspace files and save HTML prototypes

### Removed
- Public vanilla JS + Tailwind CDN frontend (replaced by AlpineJS SPA)

---

*Archived history follows below:*
