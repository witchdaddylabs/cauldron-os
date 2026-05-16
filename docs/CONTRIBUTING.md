# Contributing to Cauldron OS

Cauldron OS is small, local-first, and deliberately unfancy. Good contributions make it easier for people to turn rough ideas into useful blueprints without adding framework sludge.

Keep changes small, practical, and easy to review. Nobody wants a 47-file PR that rearranges the furniture.

## Good places to help

Things that actually move the needle:

- New `DESIGN.md` design references
- Better URL research, especially for single-page apps
- Export improvements and blueprint diffing
- Accessibility fixes
- Install/startup fixes for Windows, macOS, and Linux
- Docs that make local setup less painful
- Tests around prompts, routing, exports, and frontend behaviour

Please open an issue first if you want to add a framework, scaffold generator, large dependency, or major architectural change. Cauldron is meant to stay portable and not turn into a dependency hellscape.

## Quick start

```bash
git clone https://github.com/your-username/cauldron-os.git
cd cauldron-os
npm install
npm start
```

Open `http://localhost:3000`.

Use a focused branch:

```bash
git checkout -b fix/short-description
```

## Project shape

- Server/API: `server.js`
- Frontend/UI: `public/index.html`
- Local records: `db/`
- Design references: `design-systems/{brand}/DESIGN.md`
- Tests: `tests/`
- Docs: `README.md`, `docs/`, `CHANGELOG.md`

Default rule: keep it vanilla unless there's a damn good reason not to.

- Node 18+
- Express backend
- Vanilla frontend
- No new dependencies unless necessary
- Clear JSON errors from API routes
- Local-first by default

## Testing

Before opening a PR:

```bash
npm test
```

Also run the app locally and smoke-test whatever you changed.

Basic generation route check, with the server running:

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Test","model":"gemma4:e4b"}'
```

URL research route check:

```bash
curl -X POST http://localhost:3000/api/research-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://tailwindcss.com"}'
```

If a test depends on a local Ollama model or a BYO cloud key, say so in the PR. Don't pretend a cloud-only path was tested locally.

## Pull requests

A useful PR includes:

- What changed
- Why it changed
- Screenshots or short recordings for UI work
- Test notes, including anything you couldn't test
- Docs updates if behaviour changed

PR checklist:

- [ ] small, focused change
- [ ] no unnecessary dependencies
- [ ] backwards compatible, or clearly documented
- [ ] tested locally
- [ ] docs updated if needed

## Code of conduct

Be useful, be direct, and don't be a dick. See [`CODE_OF_CONDUCT.md`](../.github/CODE_OF_CONDUCT.md) for the actual line in the sand.

## Questions?

Maintainer contact: **witchdaddylabs@proton.me**
