# Cauldron OS — Getting Started (quick copy-paste)

This file contains the shell commands to clone, set up, and run Cauldron OS locally.

---

## Prerequisites

```bash
# Check your versions
node --version   # → v18+ (v20 recommended)
npm --version    # → 9+
ollama --version # → 0.5+ (if using local models)
```

---

## One-Command Setup

```bash
# 1. Clone the repo
git clone https://github.com/witch-daddy-labs/cauldron-os.git
cd cauldron-os

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

Server starts at http://localhost:3000

---

## Using with Ollama (Local LLM)

```bash
# Pull models for blueprint generation (works on most machines)
ollama pull qwen3.5:9b   # for complex apps, detailed schemas
ollama pull gemma4:e4b   # for fast drafts, static sites

# For a better Annoying PM / Interrogate Idea experience, pull larger models
# (requires a machine with more RAM/VRAM, e.g. 32GB+ RAM or a discrete GPU)
ollama pull gemma4:26b   # recommended minimum for quality local interrogate
ollama pull qwen3.5:27b  # alternative large local option

# Then select in Cauldron UI dropdown
# Default routing: Apps → qwen3.5:9b, Sites → gemma4:e4b
```

---

## Using Cloud Models (OpenAI / Gemini)

1. In Cauldron UI, switch **Generation Mode** to "Cloud Cauldron"
2. Select provider: OpenAI or Google AI Studio
3. Paste your API key in the password field (stored in browser localStorage only)
4. Generate — requests route to cloud API instead of Ollama

---

## First Blueprint Walkthrough

```
1. In "Project Name" field: my-focus-timer
2. In "Brain Dump": 
   "A Pomodoro timer with task queue and ambient sound mixer. 
    Users can sequence tasks, track streaks, and mix rain/café sounds."
3. Leave "Design Reference" as "None" for now (or pick Cursor for dark IDE aesthetic)
4. Ensure "Local Router" selected
5. Optional: click "Interrogate Idea" to get the annoying PM pop-up, answer what you can, then close it
6. Press Cmd+Enter (or click "Generate Blueprint")
7. Wait 10–30 seconds (gemma4:e4b) or 60–90s (qwen3.5:9b)
8. Blueprint appears center panel; Live Preview shows rough HTML mockup
9. Click "Execute & Hand-off" → spawns OpenCode in background at ./projects/my-focus-timer/
10. Check that folder — `blueprint.md` saved, OpenCode starts building
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Server won't start, port 3000 in use | Another node process | `kill PORT=$(lsof -ti:3000)` or change `PORT` env |
| Generate hangs forever | Ollama not running | `ollama serve` in another terminal |
| 400 error on generate | Empty prompt | Type something in Brain Dump |
| 500 on /api/generate | Model not pulled | `ollama list` → see available; `ollama pull <model>` |
| Design Reference dropdown does nothing | Backend not fetched yet | Wait for server startup; check Network tab |
| No HTML preview | Blueprint had no ````html` block | Not all prompts yield HTML; try "preview the landing page" in prompt |

---

## Project Structure (after first use)

```
cauldron-os/
├── server.js              # running
├── public/index.html      # UI
├── projects/              # ← your blueprints land here (gitignored)
│   └── my-focus-timer/
│       ├── blueprint.md
│       └── opencode-handoff.log
└── node_modules/
```

---

