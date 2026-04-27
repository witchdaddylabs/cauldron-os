# Changelog

All notable changes to Cauldron OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Initial open-source release
- Master Brain upgrades (Impeccable Taste, Design Reference Selector, URL Research Sweep)
- Three-panel UI (Brain Dump → Blueprint → Live Preview)
- Ollama local model routing (qwen3.5:9b for apps, gemma4:e4b for sites)
- Cloud fallback with OpenAI GPT-5.4 and Google Gemini 2.5
- OpenCode/CLI handoff with detached background spawning
- Skill-based architecture (impeccable-taste, design-reference-selector, url-research-sweep)

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
