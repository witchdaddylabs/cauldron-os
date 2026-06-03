# Cauldron OS — Pipeline Activity Log (v0.30 Integration Spec)

> **Author:** Camillo (Design Director, Witch Daddy Labs)
> **Date:** 2026-05-18
> **Status:** Spec — ready for implementation
> **Source:** Pattern observed in WDL Money Printer prototype — real-time pipeline logging proved valuable for user trust, diagnostic visibility, and experience quality.

---

## 1. Problem Statement

When a user clicks "Generate Blueprint" in Cauldron OS, the following happens invisibly:

1. Research sweep (URL fetch + design reference lookup)
2. Model generation (Ollama / OpenAI / Gemini)
3. Blueprint assembly
4. Result rendering

During this time (5-60+ seconds depending on model), the Blueprint and Preview panels sit empty. The user has no indication of:
- Whether progress is being made
- Which stage the system is in
- What the system is doing at each step
- Where a failure occurred if something breaks

This is the **black box problem.** The pipeline activity log gives the user visibility into each stage, building trust and providing diagnostic value.

---

## 2. Layout & Behaviour

### 2.1 No Layout Changes

The existing 3-panel layout is untouched:

```
┌────────────────┬────────────────┬──────────────────┐
│  Brain Dump    │  Blueprint     │  Preview          │
│  [textarea]    │  [result]      │  [iframe / log]   │
│                │                │                   │
│  Controls      │                │                   │
│  [Generate]    │                │                   │
└────────────────┴────────────────┴──────────────────┘
```

### 2.2 Preview Panel — Content Swap

The Preview panel has two content modes, toggled automatically:

| Phase | Preview Panel Shows |
|-------|-------------------|
| **Idle** | Iframe (existing) — blank or last preview |
| **Generating** | Pipeline Activity Log (replaces iframe) |
| **Complete** | Iframe returns. Compact summary bar at top of Preview panel |
| **Error** | Log persists with error highlighted. User can switch back to iframe |

### 2.3 Activity Log Toggle

A small toggle button lives in the Preview panel header:

```
[🔍 Preview | 📋 Log]     ← tab-style toggle
```

- Default: **Preview** tab (shows iframe)
- User clicks **Log** → shows the pipeline log for the last generation run
- The **Log** tab badge shows step count: `📋 Log (4)`
- During generation, the **Log** tab is auto-selected

### 2.4 Compact Summary Bar (Post-Generation)

When generation completes and the iframe returns, a 1-line summary bar appears at the top of the Preview panel:

```
┌─────────────────────────────────────────────────┐
│ ✅ Generated in 12.3s · 4 steps · [📋 View Log] │
└─────────────────────────────────────────────────┘
│                   iframe                         │
│                                                   │
└─────────────────────────────────────────────────┘
```

This bar is always visible above the iframe when there's a completed run to review. Clicking `[📋 View Log]` opens the full activity log.

---

## 3. Pipeline Activity Log — Component Spec

### 3.1 Visual Design

```
┌─ PIPELINE ACTIVITY ────────────────────────────┐
│                                                  │
│  12:01:23  🔍  Referro design research...    ✅ │
│  12:01:25  🎨  Generating imagery via Codex  ✅ │
│  12:01:27  🏗️  Building site...              ✅ │
│  12:01:29  ☁️  Deploying to Cloudflare...    ⏳ │
│                                                  │
│  Total: 12.3s · 4/4 steps complete               │
└──────────────────────────────────────────────────┘
```

### 3.2 Entry Types

Each log entry has three visual states:

| State | Icon | Colour | Description |
|-------|------|--------|-------------|
| **Pending** | `⏳` or `○` | `text-obsidian-500` | Step queued, not yet started |
| **Active** | `🔄` or animated dot | `text-neon-amber` | Step currently running |
| **Complete** | `✅` | `text-neon-emerald` | Step finished successfully |
| **Warning** | `⚠️` | `text-neon-amber` | Step completed with non-blocking issue |
| **Error** | `❌` | `text-neon-rose` | Step failed |

### 3.3 Styling Tokens

```css
/* Log panel */
.pipeline-log {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.8;
  padding: 16px;
  overflow-y: auto;
  background: rgba(13, 13, 15, 0.6);
}

/* Entry */
.pipeline-entry {
  display: flex;
  gap: 10px;
  padding: 4px 0;
  opacity: 0;
  animation: pipelineLogIn 0.3s ease forwards;
}

.pipeline-entry .time {
  color: #72727d;       /* obsidian-400 */
  flex-shrink: 0;
  min-width: 60px;
}

.pipeline-entry .msg  { flex: 1; }
.pipeline-entry .info  { color: #b794f6; }  /* neon-purple */
.pipeline-entry .ok    { color: #34d399; }  /* neon-emerald */
.pipeline-entry .warn  { color: #fbbf24; }  /* neon-amber */
.pipeline-entry .error { color: #fb7185; }  /* neon-rose */

@keyframes pipelineLogIn {
  to { opacity: 1; }
}

/* Summary bar */
.pipeline-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(52, 211, 153, 0.06);
  border-bottom: 1px solid rgba(52, 211, 153, 0.15);
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
}

/* Tab toggle */
.pipeline-tab {
  padding: 4px 12px;
  font-size: 11px;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.15s;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}
.pipeline-tab.active {
  background: rgba(183, 148, 246, 0.15);
  color: #b794f6;
}
.pipeline-tab:not(.active) {
  color: #72727d;
}
.pipeline-tab:not(.active):hover {
  color: #d9d9dd;
}
```

### 3.4 Animations

- **Entry appearance:** Fade in with 0.3s ease, 100ms stagger between entries
- **State transition:** Pulse amber ring on active step, then snap to green checkmark on completion
- **Completion:** Brief glow pulse on the summary bar when all steps finish

---

## 4. Backend Events (Server-Sent Events)

### 4.1 Event Stream

The backend sends progress events over the existing generate endpoint. The response is a JSON stream where each line is a progress event, and the final line is the complete blueprint.

```json
// Progress event (sent as each step starts/completes)
{"type": "progress", "step": 1, "total": 4, "label": "Researching design references...", "status": "active"}
{"type": "progress", "step": 1, "total": 4, "label": "Researching design references...", "status": "complete", "duration": 2.1}
{"type": "progress", "step": 2, "total": 4, "label": "Generating imagery via Codex...", "status": "active"}
{"type": "progress", "step": 2, "total": 4, "label": "Generating imagery via Codex...", "status": "complete", "duration": 4.3}
...

// Error event
{"type": "error", "step": 3, "label": "Building site...", "message": "Ollama model not found. Check local models."}

// Complete event
{"type": "complete", "duration": 12.3, "steps": 4}
```

### 4.2 Pipeline Stages (v1)

These are the stages for the current Blueprint generation flow, mapped to existing server.js code:

| # | Stage | Server.js Hook | Expected Duration |
|---|-------|---------------|-------------------|
| 1 | Researching design references | `researchUrlInput` → URL fetch + design system lookup | 1-3s |
| 2 | Generating Blueprint | `/api/generate` → model call | 5-60s |
| 3 | Assembling output | Post-processing (description, tags, etc.) | <1s |
| 4 | Rendering preview | Blueprint → HTML/AlpineJS conversion | <1s |

### 4.3 Implementation Pattern (server.js)

The existing `/api/generate` endpoint uses streaming (`res.write`). Progress events can be injected before and after each logical stage:

```javascript
// Before research
res.write(JSON.stringify({type: "progress", step: 1, total: 4, label: "Researching design references...", status: "active"}) + '\n');

// ... do research ...

// After research
res.write(JSON.stringify({type: "progress", step: 1, total: 4, label: "Researching design references...", status: "complete", duration: elapsed}) + '\n');

// Before generation
res.write(JSON.stringify({type: "progress", step: 2, total: 4, label: "Generating Blueprint...", status: "active"}) + '\n');

// ... existing generation stream ...

// After generation
res.write(JSON.stringify({type: "progress", step: 2, total: 4, label: "Generating Blueprint...", status: "complete", duration: elapsed}) + '\n');
```

### 4.4 Client-side Consumption (index.html)

```javascript
// In the fetch response handling for generate
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      
      if (event.type === 'progress') {
        addPipelineEntry(event);
      } else if (event.type === 'error') {
        addPipelineEntry({...event, status: 'error'});
        showPipelineError(event.message);
      } else if (event.type === 'blueprint') {
        renderBlueprint(event.data);
        showPipelineSummary();
        switchToPreviewTab();
      }
    } catch (e) {
      // Existing blueprint line handling
      appendBlueprintText(line);
    }
  }
}
```

---

## 5. Existing UI Elements That Need Modification

### 5.1 index.html — Preview Panel (lines ~427-435)

Current structure:
```html
<section class="panel flex-1 flex flex-col m-2 overflow-hidden rounded-none">
  <div class="flex-none px-4 py-2 border-b border-obsidian-800/30 flex items-center justify-between">
    <label class="text-xs font-semibold text-neon-amber uppercase tracking-widest">Preview</label>
  </div>
  <div class="flex-1 relative bg-white">
    <iframe id="previewFrame" class="w-full h-full" sandbox="allow-scripts"></iframe>
  </div>
</section>
```

Changes needed:
1. Add tab-style toggle in the header: `[Preview | Activity]`
2. Wrap iframe in a container div for show/hide
3. Add pipeline-log container div alongside the iframe
4. Add summary bar above the iframe

### 5.2 Generate Button Handler (js in index.html)

The existing generate handler needs to:
1. Clear the pipeline log
2. Show the pipeline log (auto-switch to Activity tab)
3. Parse SSE-style progress lines from the generation response
4. On completion: switch back to Preview tab, show summary bar

### 5.3 Existing Response Stream Handler

The current `/api/generate` endpoint already streams JSON lines. The existing handler appends blueprint content to the result div. This handler needs to be extended to:
- Intercept lines with `type: "progress"` → route to pipeline log
- Pass all other lines through to the existing blueprint rendering

---

## 6. Error Handling

| Scenario | Log Behaviour | User Sees |
|----------|--------------|-----------|
| Step completes normally | Entry turns green ✅ | Progress continues |
| Model timeout | Entry turns red ❌, stops at that step | "Generation timed out. Try a smaller model." |
| Research URL fails | Entry shows warning ⚠️ | "Could not fetch URL. Continuing without reference." |
| Blueprint assembly fails | Entry turns red ❌ | "Error assembling Blueprint. Check server logs." |

The pipeline log always **preserves the last failed run's log** — it doesn't clear on view. Users can inspect exactly where and why it failed.

---

## 7. Implementation Order

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Add pipeline log CSS styles | `public/index.html` (style block) | ~20 lines |
| 2 | Add tab toggle and log container to Preview panel | `public/index.html` | ~15 lines |
| 3 | Write `addPipelineEntry()` and `showPipelineSummary()` JS functions | `public/index.html` (script block) | ~40 lines |
| 4 | Modify generate handler to parse progress events | `public/index.html` (script block) | ~15 lines |
| 5 | Add progress event emissions to `server.js` | `server.js` | ~30 lines |
| 6 | Test with all generation modes (Ollama, OpenAI, Gemini) | Manual QA | — |
| 7 | Update Preview tab to show log badge count during generation | `public/index.html` | ~5 lines |

**Total estimated effort: ~2 hours** — the backend streaming infrastructure already exists, this is mostly frontend wiring.

---

## 8. Future Enhancements (v2)

- **Persistent history:** Logs are saved per draft/blueprint and viewable from the History panel
- **Export log:** Copy pipeline log as Markdown for debugging (useful for support)
- **Per-step timing:** Hover on any step to see exact duration
- **Cancel button:** Stop generation mid-pipeline (needs backend abort support)
- **Expandable steps:** Click a step to see its full output/details
- **Log level filter:** Toggle between "All steps" and "Errors only"

---

## 9. Design Precedent

The pipeline activity log pattern is inspired by:
- **Vercel deployment logs** — streaming build output with status indicators per step
- **GitHub Actions** — step-by-step workflow visualization with collapsible logs
- **WDL Money Printer** (our own prototype) — proved the UX value of visible pipeline stages

The key difference from these precedents: Cauldron's log is **user-facing, not developer-facing.** The language is plain English ("Researching design references..."), not raw terminal output. Every step is explainable to a non-technical user.

---

*End of spec. Ready for implementation.*
