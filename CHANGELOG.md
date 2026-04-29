# Changelog

All notable changes to Cauldron OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [2.35.0] — 2026-04-29

### Added
- **Annoying PM Mode / Interrogate Idea**: a pre-generation clarification pass that asks focused product-manager questions before the blueprint is generated.
- Clarification answers, assumptions, red flags, and suggested V1 scope are folded into the final blueprint prompt.
- `/api/clarify` backend support for local and cloud model routing.
- Frontend static smoke coverage for the Annoying PM modal and prompt-folding flow.

### Changed
- Refreshed README and getting-started docs around the clarified blueprint workflow.
- Refreshed README screenshot/demo assets with a Rude Boy Coffee Co rewards-app walkthrough.

### Fixed
- Dedicated Reference URL / Cloner Target now feeds the research sweep even when the Brain Dump itself has no pasted URL.

---

## [2.3.0] — 2026-04-28

### Added
- Local Ollama model autodetection via `/api/ollama-models`, backed by Ollama `/api/tags`
- Local model dropdown with refresh action for machines with different installed models
- Dedicated one-URL Reference URL / Cloner Target field alongside Brain Dump URL detection
- Expanded Design Reference selector to match private Cauldron options: Cursor, Vercel, Lovable, Raycast, Linear, Stripe, Notion, Apple, Figma, Supabase, Resend, Webflow, and OpenCode
- Save & Download Blueprint action that saves a local draft and downloads the Markdown blueprint

### Changed
- Preview generation now requests and labels self-contained HTML + AlpineJS prototypes
- Preview iframe injects AlpineJS CDN when generated markup uses Alpine directives but omits the script
- Design reference fetching now uses the richer pre-paywall design-md source used by private Cauldron
- Brain Dump textarea now fills the full available input panel space

### Fixed
- Public UI no longer hardcodes only two local Ollama router choices when a machine has different models installed

---

## [2.2.0] — 2026-04-27

### Added
- Local draft saving/loading backed by `sql.js`
- Searchable saved draft list and session history UI
- Markdown and JSON export actions
- Public-safe `data/` runtime storage ignored by Git
- Smoke test coverage for draft/history/export endpoints
- Accessibility improvements: action nav, dialogs, focus-visible states, reduced-motion support

### Fixed
- Broken local draft retrieval route from the prototype implementation
- Duplicate/invalid frontend menu and script injection
- Package metadata restored to MIT license and `cauldron-os` package name

---

## [2.1.0] — 2026-04-27

### Added
- DESIGN_GUIDE injected into system prompt with ANTI-PATTERNS and MANDATES
- Design Reference Selector dropdown with Cursor, Vercel, Lovable, Raycast brands
- URL Research Sweep: paste any URL in Brain Dump → auto-scrape → design signal injection
- Brand DNA fetching from VoltAgent/awesome-design-md repository
- Design systems cache (in-memory Map) for fast repeated fetches
- New endpoints: `/api/design-systems`, `/api/design-reference`, `/api/research-url`
- Research indicator UI (badge shows "Researching" while scraping)
- URL detection in Brain Dump with live indicator

### Improved
- Error handling: graceful degradation when design reference fetch fails
- Connection resilience: catches Ollama connection errors without server crash
- JSON parsing: handles malformed Ollama responses with informative error
- Frontend payload now includes `designReference` and `researchData`

### Changed
- Server.js: complete rewrite from Cauldron 2.0 (modular structure)
- Frontend index.html: expanded with design selector and research UI

### Fixed
- Generation no longer crashes if Ollama disconnects mid-stream
- Design reference gracefully skipped if GitHub fetch returns 404

---

## [2.0.0] — 2026-03-15 (internal, not released)

### Added
- Initial Cauldron with basic Ollama routing
- Three-panel layout with live HTML preview
- Project handoff to OpenCode CLI
- Cloud model fallback infrastructure

---

*This CHANGELOG will be updated with each release.*
