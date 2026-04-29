# Contributing to Cauldron OS

Cauldron OS is small, local-first, and deliberately unfancy. Good contributions make it easier for people to turn rough ideas into useful blueprints without adding framework sludge.

Keep changes small, practical, and easy to review.

## Good places to help

Useful contributions line up with the public roadmap:

- new `DESIGN.md` design references
- better URL research, especially for SPAs
- export improvements and blueprint diffing
- accessibility fixes
- install/startup fixes for Windows, macOS, and Linux
- docs that make the local setup less painful
- tests around prompts, routing, exports, and frontend behaviour

Please open an issue first if you want to add a framework, scaffold generator, large dependency, or major architectural change. Cauldron is meant to stay portable.

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

Default rule: keep it vanilla unless there is a damn good reason not to.

- Node 18+
- Express backend
- vanilla frontend
- no new dependencies unless necessary
- clear JSON errors from API routes
- local-first by default

## Testing

Before opening a PR:

```bash
npm test
```

Also run the app locally and smoke-test the thing you changed.

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

If a test depends on a local Ollama model or BYO cloud key, say so in the PR. Do not pretend a cloud-only path was tested locally.

## Pull requests

A useful PR includes:

- what changed
- why it changed
- screenshots or short screen recordings for UI work
- test notes, including anything you could not test
- docs updates if behaviour changed

PR checklist:

- [ ] small, focused change
- [ ] no unnecessary dependencies
- [ ] backwards compatible, or clearly documented
- [ ] tested locally
- [ ] docs updated if needed

## Code of conduct

Be useful, be direct, and do not be a dick. See [`CODE_OF_CONDUCT.md`](../.github/CODE_OF_CONDUCT.md) for the actual line in the sand.

## Contact

Questions or maintainer contact: **witchdaddylabs@proton.me**
