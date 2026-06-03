# BYOK CLI Execution Contract

This contract defines the v0.30 target for agent handoff. It keeps Cauldron local-first: Cauldron prepares the package, the user chooses the agent, and missing CLIs degrade to a saved handoff package.

## Goals

- Generate a complete handoff bundle from the reviewed blueprint and prototype.
- Detect available user-owned agent CLIs without making them mandatory.
- Let the user choose a build agent from Settings or the Build stage.
- Invoke the selected CLI only after the user intentionally starts that action.
- Stream or record useful status back into Cauldron where possible.
- Preserve the existing export flow as the fallback path.

## Supported Agent Kinds

Initial target agents:

| Agent | Detection command | Launch style |
| --- | --- | --- |
| Cursor | `which cursor` | open project directory or README; prompt mode if available |
| Claude Code | `which claude` | run in project directory with prompt file |
| Codex | `which codex` | run in project directory with prompt file |
| OpenCode | `which opencode` | existing project resume/open flow |
| Handoff only | none | save package and show instructions |

Detection must be capability-based. If a command is missing, return `available: false`; do not fail the app.

Current implementation note: `/api/build-agents` detects Cursor, Claude Code, Codex, Hermes, and OpenCode. `/api/build-agents/run` always creates the handoff package. All detected agents support automated launch; Cursor and OpenCode open the project directory directly, while Claude Code, Codex, and Hermes run the agent prompt in the project directory.

## Handoff Bundle

Required files:

```text
projects/<safe-project-name>/
  blueprint.md
  prototype.html
  design-system.md
  cauldron.project.json
  README.md
```

Optional files:

```text
  .cursorrules
  .opencode/config.md
  agent-prompt.md
  build.log
```

## Manifest Shape

`cauldron.project.json` should be stable and machine-readable:

```json
{
  "schemaVersion": 1,
  "projectName": "example-project",
  "createdAt": "2026-06-03T00:00:00.000Z",
  "source": "cauldron-os",
  "cauldronVersion": "0.30.0",
  "projectType": "app",
  "templateId": "html-alpine",
  "designReference": "cursor",
  "files": {
    "blueprint": "blueprint.md",
    "prototype": "prototype.html",
    "designSystem": "design-system.md",
    "readme": "README.md"
  },
  "agent": {
    "mode": "handoff-only",
    "requestedCli": null,
    "command": null
  }
}
```

Future fields may be added, but existing fields should not change meaning without a schema-version bump.

## CLI Detection API

Target endpoint:

```text
GET /api/build-agents
```

Target response:

```json
{
  "success": true,
  "agents": [
    {
      "id": "handoff",
      "name": "Generate handoff package",
      "available": true,
      "command": null,
      "notes": "Always available"
    },
    {
      "id": "cursor",
      "name": "Cursor",
      "available": true,
      "command": "/usr/local/bin/cursor",
      "notes": "Detected on PATH"
    }
  ]
}
```

## Build Invocation API

Target endpoint:

```text
POST /api/build-agents/run
```

Request:

```json
{
  "projectName": "example-project",
  "agentId": "cursor",
  "blueprint": "...",
  "prototypeHtml": "...",
  "designReference": "cursor",
  "templateId": "html-alpine",
  "projectType": "app"
}
```

Response:

```json
{
  "success": true,
  "mode": "launched",
  "agentId": "cursor",
  "projectPath": "/absolute/path/to/projects/example-project",
  "manifestPath": "/absolute/path/to/projects/example-project/cauldron.project.json",
  "command": "cursor /absolute/path/to/projects/example-project",
  "fallback": false
}
```

If launch fails:

```json
{
  "success": true,
  "mode": "handoff-only",
  "agentId": "cursor",
  "projectPath": "/absolute/path/to/projects/example-project",
  "fallback": true,
  "error": "Cursor CLI not found"
}
```

The fallback still counts as success because the handoff package exists.

## Status Tracking

Minimum viable tracking:

- store launch command and timestamp in the manifest.
- write CLI stdout/stderr to `build.log` when running a child process.
- expose status through the existing project status surfaces.

Future tracking can watch file modification times, child process exit codes, or agent-produced completion markers.

## Safety Rules

- Never auto-launch a CLI during blueprint/prototype generation.
- Never require cloud API keys for handoff package generation.
- Never fail export because a preferred CLI is missing.
- Escape project paths and prompt paths when spawning commands.
- Prefer `spawn` with argv arrays over shell strings.
- Keep GUI-opening behavior platform-aware and clearly reported.
- Do not store API keys in manifests, generated README files, or logs.

## Relationship To Existing Routes

Current `/api/handoff` and `/api/build-agents/run` use the shared handoff package writer, so the generated bundle stays consistent.

Current `/api/build/*` routes run the XML tool workspace flow. Phase 2 should decide whether the Build stage prefers BYOK/CLI handoff by default while preserving the XML route as a local-agent option or legacy path.

The frontend now separates package creation from launch state: package-only fallback is reported as `handoff-only`, while a detected automated launch returns `launched` with command/log metadata.
