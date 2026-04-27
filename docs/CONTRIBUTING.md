# Contributing to Cauldron OS

Thank you for considering a contribution! Please read this guide before opening a PR.

---

## Code of Conduct

Be respectful, constructive, and kind. We're all learning.

---

## Getting Started

1. **Fork** the repo on GitHub
2. **Clone** locally: `git clone https://github.com/your-username/cauldron-os.git`
3. **Install**: `npm install`
4. **Run**: `npm start`
5. **Create a branch**: `git checkout -b my-feature`

---

## Development Workflow

### Server Changes
- Edit `server.js` — keep it under ~600 lines if possible
- Use native Node 18+ APIs (fetch, AbortController) — no polyfills
- Add new API routes as `app.METHOD('/path', handler)`
- Error handling: always `try/catch` in async routes; return JSON `{error, details}`

### Frontend Changes
- Edit `public/index.html` — vanilla JS only, no frameworks
- Tailwind via CDN (already included)
- Keep within ~700 lines total
- Add new DOM elements to `DOM` map object
- Update event listeners accordingly

### Adding a Design System
1. Create `design-systems/{brand}/DESIGN.md` — follow the [DESIGN.md spec](https://github.com/VoltAgent/awesome-design-md)
2. Add `{brand}` to `DESIGN_SYSTEMS` mapping in `server.js`
3. Add `<option value="{brand}">Brand Name</option>` in `index.html`
4. Test: Select the brand → generate → verify content appears in prompt context
5. Submit PR with `{brand}` folder included

### Extending Research Scraper
- Edit `analyseHTML()` function in `server.js`
- Extract new signals: font weights, media queries, animations, etc.
- Keep it fast — no external deps, no heavy parsing
- Update `formatResearchForPrompt()` if you add new categories
- Add test URL in `docs/RESEARCH_TEST_CASES.md`

---

## Testing

### Smoke Test (manual)
```bash
node server.js
# In another terminal:
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Test","model":"gemma4:e4b"}'
```

Expected: JSON response with `success: true` and a `blueprint` string.

### URL Research Test
```bash
curl -X POST http://localhost:3000/api/research-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://tailwindcss.com"}'
```

Expected: `success: true`, plus `findings.colors.length > 0`.

---

## Pull Request Process

1. **Update README** if you change public behavior
2. **Update docs/** if you add features or modify architecture
3. **Run smoke tests** locally before pushing
4. **Open PR** with clear description:
   - What changed?
   - Why?
   - Screenshots (if UI)
   - Test notes
5. **Wait for review** — maintainer will respond within 48h

### PR Checklist
- [ ] Code follows existing style (minimal, functional)
- [ ] No new dependencies unless absolutely necessary
- [ ] Backwards compatible (or documented breaking change)
- [ ] Tests updated (if we have any yet)
- [ ] README/docs updated

---

## Release Process (Maintainers Only)

1. Bump version in `package.json` and `server.js` header
2. Update CHANGELOG.md
3. Commit: `git commit -am "chore: release vX.Y.Z"`
4. Tag: `git tag vX.Y.Z`
5. Push: `git push && git push --tags`
6. GitHub Actions will publish (when set up)

---

## Community

- **Issues**: https://github.com/witch-daddy-labs/cauldron-os/issues
- **Discord**: (coming soon)
- **Show & Tell**: Tag @witchdaddylabs on X/Twitter

---

Thanks for helping build a better design-aware AI coding toolkit. 🧙‍♂️✨
