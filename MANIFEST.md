# Cauldron OS — Repository Manifest

Version: 2.3.0
License: MIT
Organization: Witch Daddy Labs
Repository: github.com/witchdaddylabs/cauldron-os

---

## Files & Directories

### Root Level
```
server.js               — Main Node.js server (526 lines)
package.json            — Project metadata & dependencies v2.3.0
README.md               — Public documentation (with hero image)
LICENSE                 — MIT License (Witch Daddy Labs)
.gitignore              — Excludes node_modules, .DS_Store, etc.
.editorconfig           — Consistent coding style (2-space, LF, UTF-8)
.gitattributes          — Git handling for binaries (images), LFS annotations
CHANGELOG.md            — Release history (Keep a Changelog format)
FUNDING.yml             — GitHub Sponsors config (witchdaddylabs)
GETTING_STARTED.md      — 5-minute setup guide
PUSH_GUIDE.md           — First release push procedure (internal)
```

### Core Application
```
server.js               — Express + Ollama integration
public/
  index.html            — Dark UI (Brain Dump + Output panels)
```

### GitHub Integration
```
.github/
  CODE_OF_CONDUCT.md    — Contributor Covenant 2.1
  SECURITY.md           — Vulnerability reporting policy
  PULL_REQUEST_TEMPLATE.md
  ISSUE_TEMPLATE/
    bug-report.md
    feature-request.md
  workflows/
    ci.yml              — Node lint + version check
```

### Documentation
```
docs/
  ARCHITECTURE.md       — Technical deep dive
  CONTRIBUTING.md       — PR standards & testing guide
  DESIGN_REFERENCE.md   — Brand DNA selector docs
examples/
  sample-blueprint.md   — Example output showing brand + research
```

### Scripts
```
scripts/
  pre-publish.js        — Pre-push validator (runs 0 errors locally)
  validate-blueprint.js — JSON schema validator
```

### Brand Assets
```
assets/
  hero-header.png       — AI-generated banner (2.5 MB landscape)
  brand/
    wdl-logo-primary.png  — Full WDL logo (horizontal)
    logo-sigil.png         — Witch hat sigil (icon)
    logo-wordmark.png      — "Witch Daddy Labs" text
```

### Design System Placeholders
```
design-systems/
  cursor/
    .gitkeep
  vercel/
    .gitkeep
  lovable/
    .gitkeep
  raycast/
    .gitkeep
```

**Note:** Design system folders are ready to populate with `DESIGN.md` files from VoltAgent/awesome-design-md.