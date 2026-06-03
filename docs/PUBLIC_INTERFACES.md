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
| `keyHealth` | Settings API-key connection health status |
| `blueprint` | editable generated markdown |
| `prototypeHtml` | generated HTML preview |
| `critiqueText` | current natural-language prototype critique |
| `prototypeIterations` | latest prototype snapshots and critique history |
| `buildSession` | active build workspace metadata |
| `handoffResult` | latest export/handoff response |
| `pipelineLog` | user-facing activity log |
| `pipelineProgress` | estimated live progress for model-backed generation |

Frontend agents should preserve these names unless the branch explicitly migrates the contract and updates tests.

## Core API Routes

### Generation And Research

| Route | Method | Request | Response |
| --- | --- | --- | --- |
| `/api/research-url` | POST | `{ url, projectName?, brainDump?, mode? }` | `{ success, findings, formatted, researchId?, reuseCount? }` |
| `/api/clarify` | POST | `{ prompt, model, projectType?, apiKey?, cloudModel? }` | clarify question payload |
| `/api/generate` | POST | blueprint generation payload | generated blueprint/session payload |
| `/api/generate-prototype` | POST SSE | `{ blueprint, model, cloudModel?, apiKey?, critique?, previousPrototypeHtml?, iterationIndex?, ... }` | `progress`, `prototype`, `error` events |
| `/api/refine` | POST | `{ prompt, existingBlueprint, ... }` | refined blueprint payload |
| `/api/handoff` | POST | `{ projectName, blueprint?, sessionId?, designReference?, prototypeHtml? }` | `{ success, message, projectPath, draftId?, filesCopied? }` |

`/api/generate-prototype` can be used for first generation or critique regeneration. When `critique` is provided, callers should also pass `previousPrototypeHtml` so the model can preserve useful interaction structure while applying the requested change.

`/api/handoff` is the current export bridge. It creates a project folder, writes the shared v0.30 handoff package, records an initial project status, and saves a draft record.

### Drafts

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/drafts` | GET | list saved draft records |
| `/api/drafts` | POST | save blueprint plus optional prototype review metadata |
| `/api/drafts/:id` | GET | fetch a full draft including `prototype_html` and `prototype_iterations` |
| `/api/drafts/:id/export.md` | GET | download blueprint markdown |
| `/api/drafts/:id` | DELETE | remove a draft |

Draft saves accept optional `prototypeHtml` and `prototypeIterations`. These fields support the Phase 3 critique loop without mixing prototype snapshots into the editable blueprint markdown.

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
| `/api/build-agents` | GET | detect BYOK build-agent CLIs |
| `/api/build-agents/run` | POST | create a handoff package and optionally launch the selected detected CLI |

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

Current `/api/handoff` and `/api/build-agents/run` output may include:

| File | Purpose |
| --- | --- |
| `blueprint.md` | source product/build specification |
| `prototype.html` | standalone generated prototype |
| `design-system.md` | selected design reference content |
| `cauldron.project.json` | machine-readable handoff manifest |
| `README.md` | human run/build instructions |
| `agent-prompt.md` | prompt for a local build-agent CLI |
| `.cursorrules` | Cursor-oriented project rules |
| `.opencode/config.md` | OpenCode-oriented instructions |

`/api/handoff` creates package files only. `/api/build-agents/run` creates the same package and may launch a detected CLI when the selected agent supports automated launch. Responses distinguish `mode: "handoff-only"`, `mode: "dry-run"`, and `mode: "launched"`.

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
