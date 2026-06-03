# Public Interfaces

This document defines the stable seams for v0.30 work. If a branch changes one of these contracts, update this file and add or update smoke coverage.

## Runtime

- Server entry: `server.js`
- Default port: `3000`
- Static app: `public/`
- Runtime data: `data/`
- Generated projects: `projects/`
- Build workspaces: managed by `lib/workspace.js`

## Frontend Pipeline Contract

The Alpine app is created by `cauldronApp()` in `public/scripts/app.js` and mounted from `public/index.html`.

Pipeline stage IDs:

```text
dump -> interrogate -> system -> blueprint -> prototype -> build -> export
```

Important state names:

| State | Meaning |
| --- | --- |
| `form.brainDump` | raw user idea |
| `form.projectType` | `app` or `site` |
| `form.designReference` | selected design-system id |
| `form.templateId` | selected scaffold/template id |
| `stageModels` | per-stage provider/model routing stored in localStorage |
| `blueprint` | editable generated markdown |
| `prototypeHtml` | generated HTML preview |
| `buildSession` | active build workspace metadata |
| `handoffResult` | latest export/handoff response |
| `pipelineLog` | user-facing activity log |

Frontend agents should preserve these names unless the branch explicitly migrates the contract and updates tests.

## Core API Routes

### Generation And Research

| Route | Method | Request | Response |
| --- | --- | --- | --- |
| `/api/research-url` | POST | `{ url, projectName?, brainDump?, mode? }` | `{ success, findings, formatted, researchId?, reuseCount? }` |
| `/api/clarify` | POST | `{ prompt, model, projectType?, apiKey?, cloudModel? }` | clarify question payload |
| `/api/generate` | POST | blueprint generation payload | generated blueprint/session payload |
| `/api/generate-prototype` | POST SSE | `{ blueprint, model, cloudModel?, apiKey?, ... }` | `token`, `artifact`, `done`, `error` events |
| `/api/refine` | POST | `{ prompt, existingBlueprint, ... }` | refined blueprint payload |
| `/api/handoff` | POST | `{ projectName, blueprint?, sessionId?, designReference?, prototypeHtml? }` | `{ success, message, projectPath, draftId?, filesCopied? }` |

`/api/handoff` is the current export bridge. It creates a project folder, writes `blueprint.md` when available, writes `prototype.html` when available or extractable, writes `.opencode/config.md`, records an initial project status, and saves a draft record.

Known v0.30 gap: the v0.30 plan refers to handoff as living in `routes/projects.js`, but the implemented `/api/handoff` route currently lives in `routes/generation.js`. Phase 2 should consolidate or wrap this route deliberately rather than creating a second incompatible handoff path.

### Build Workspace

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/build/start` | POST | create a build session and workspace |
| `/api/build/generate` | POST SSE | run the XML-tool build loop against a session |
| `/api/build/refine` | POST SSE | continue/refine an existing build session |
| `/api/build/stop` | POST | abort an active build session |
| `/api/build/files/:sessionId` | GET | list workspace files |
| `/api/build/file/:sessionId` | GET | read one workspace file |
| `/api/build/status/:sessionId` | GET | inspect build session metadata |

The v0.30 BYOK/CLI work should treat this as an existing local-agent path, not assume the build stage is empty.

Known v0.30 gap: `/api/build/generate` and `/api/build/refine` are intended SSE execution routes, but they currently depend on helper names that are not imported or passed into the route module. Verify and repair this path before relying on it for real Build-stage execution.

### Models And Design Systems

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/cloud-models` | GET | list supported cloud providers/models |
| `/api/ollama-models` | GET | detect local Ollama models from `/api/tags` |
| `/api/design-systems` | GET | list selectable design-system ids/names/sources |
| `/api/design-reference` | POST | fetch/cache a selected local, Refero, or remote design reference |
| `/api/refero-search` | GET | proxy cached Refero style search |

`/api/design-systems` returns `{ systems: [{ id, name, source }] }`. IDs are canonical catalog IDs. `source` may be `open-design`, `refero`, or `remote`.

Imported catalog entries live under `design-systems/<id>/DESIGN.md` and are indexed by `design-systems/catalog.json`. `/api/design-reference` shares the same cache and loader for local files, Refero prompt guidance, and legacy remote fallbacks.

### Project And Status

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/templates` | GET | return available scaffold templates |
| `/api/build-status` | GET | return aggregate project status |
| `/api/projects/:name/status` | POST/DELETE | set or clear manual project status |
| `/api/projects/:name/resume` | POST | launch OpenCode resume in a project folder |
| `/api/projects/:name/open-visible` | POST | open a visible OpenCode terminal |
| `/api/projects/import` | POST | import existing private project folders |
| `/api/health` | GET | health response |

## Generated Handoff Files

Current `/api/handoff` output may include:

| File | Purpose |
| --- | --- |
| `blueprint.md` | source product/build specification |
| `prototype.html` | standalone generated prototype |
| `.opencode/config.md` | OpenCode-oriented instructions |

Current `/api/handoff` does not launch OpenCode and does not return a `logPath`. Frontend copy and future status UI should distinguish "package created" from "agent launched".

Target v0.30 handoff packages should add:

| File | Purpose |
| --- | --- |
| `cauldron.project.json` | machine-readable project manifest |
| `design-system.md` | selected design reference and extracted tokens |
| `README.md` | human run/build instructions |
| agent-specific rule files | optional `.cursorrules`, Claude/Codex instructions, or equivalent |

## Template Contract

`TEMPLATES` is currently defined in `server.js` and returned by `/api/templates`.

Each template has:

- `id`
- `name`
- `projectType`
- `scaffold`
- `recommendedUse`
- `files`
- `promptBias`

Phase 5 should add real scaffold generation without breaking this public response.

## Test Expectations

Use `npm test` for the existing smoke suite. Add targeted tests when changing:

- API response shapes.
- Generated handoff files.
- Template/scaffold output.
- Frontend text or state required by `tests/frontend-static-smoke.js`.
- Build or project status behavior.
