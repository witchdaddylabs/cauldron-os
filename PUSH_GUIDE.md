# Cauldron OS — First Release push Guide

**For:** Billy C (Witch Daddy Labs)
**Date:** 2026-04-27
**Target Repo:** https://github.com/witchdaddylabs/cauldron-os

---

## ✅ Pre-Push Checklist (COMPLETE)

All files are in place. Local repo at `~/hermes/witch-daddy-labs/cauldron-os/` is ready.

---

## 🚀 Step-by-Step Push Instructions

### 1. Create the Remote Repository (One-time)

**On GitHub (witchdaddylabs account):**

1. Go to https://github.com/new
2. Repository name: `cauldron-os`
3. Owner: Select `witchdaddylabs` organization
4. Description: `Local-first, design-aware blueprint generator for AI-assisted development`
5. Visibility: **Public**
6. ✗ Do NOT initialize with README, .gitignore, or license — we already have all those
7. Click **Create repository**

**Copy the remote URL** (SSH or HTTPS):
- SSH: `git@github.com:witchdaddylabs/cauldron-os.git`
- HTTPS: `https://github.com/witchdaddylabs/cauldron-os.git`

---

### 2. Initialize & Push from Local

Open Terminal on your Mac (where Hermes runs):

```bash
# Navigate to the prepared repo
cd /Users/habibi/hermes/witch-daddy-labs/cauldron-os

# Verify you see server.js, README.md, etc.
ls -la

# Initialize git (if not already)
git init

# Add all files
git add .

# Check status — should show all files staged
git status

# Commit
git commit -m "chore: initial release Cauldron OS v2.1.0"

# Add remote (replace URL with your chosen SSH/HTTPS)
git remote add origin https://github.com/witchdaddylabs/cauldron-os.git

# Push to GitHub (first push)
git push -u origin main
# If `main` doesn't exist yet, use:
# git push -u origin HEAD:main
```

Expected output: Upload progress, then success message.

---

### 3. Post-Push: GitHub Settings

Once pushed, configure the repo:

1. **Add Billy & Claudia as collaborators**
   - Settings → Collaborators → add `nicenuts` (Billy), `ClaudiaCOO` (if she has GitHub)
   - Give Admin or Write access as appropriate

2. **Enable Features:**
   - Settings → Options → Features:
     - ✓ Issues
     - ✓ Discussions (optional but nice)
     - ✓ Projects (optional)
     - ✓ Wiki (optional — we use docs/ folder instead)

3. **Branch protection** (optional):
   - Settings → Branches → Add rule for `main`
   - Require PR reviews (if you want stricter workflow)
   - But for now, leave it open for easy merging

4. **Topics / Tags:**
   - Settings → Options → About → Topics
   - Add: `ai`, `llm`, `blueprint`, `design-system`, `local-first`, `ollama`, `code-generation`, `witch-daddy-labs`

5. **Social preview:**
   - Upload a custom repo logo (use `assets/brand/logo-sigil.png` or `wdl-logo-primary.png`)
   - Add a short description (already filled from commit)

---

### 4. Create First Release (v2.1.0)

On GitHub repo → Releases → Create a new release:

- Tag version: `v2.1.0`
- Release title: `Cauldron OS 2.1.0 — Master Brain`
- Description: Paste the content of `CHANGELOG.md` (the 2.1.0 section)
- Attach binaries? No (this is source-only)
- Mark as **Latest release**

Click **Publish release**.

---

### 5. Announce (Your Call)

When you're ready to announce:

**Twitter/X:**
```
We open-sourced Cauldron OS — a local-first blueprint generator that gives LLMs "impeccable taste."

It injects premium design mandates, brand DNA, and site research into prompts so you get structured, implementable plans instead of vague rambling.

MIT licensed, by @witchdaddylabs
github.com/witchdaddylabs/cauldron-os
```

**Hacker News:**
- Post to https://news.ycombinator.com/submit
- Title: `Show HN: Cauldron OS – Local Blueprint Generator with Master Brain Upgrades`
- Body: Summarize the three upgrades, link to GitHub, mention MIT/self-hosted

**Reddit:**
- r/LocalLLaMA
- r/ai_devs
- r/webdev

---

## 🆘 If Something Goes Wrong

| Problem | Fix |
|---------|-----|
| Remote already exists | `git remote set-url origin <new-url>` |
| Push rejected (non-fast-forward) | Someone pushed before you? Pull first: `git pull --rebase origin main`, then push again |
| File too large error | Check for assets over 100MB; our largest is hero-header.png (~2.5MB) — should be fine |
| Permission denied (SSH) | Make sure you added SSH key to GitHub, or use HTTPS + credential helper |
| CI fails on GitHub Actions | The workflows are minimal; they should pass. If not, check server.js syntax. |

---

## 📦 What's Included (for your peace of mind)

- **server.js** — Complete Cauldron 2.1 with Master Brain upgrades
- **public/index.html** — Dark-themed three-panel UI
- **package.json** — Express only, MIT licensed
- **docs/** — Architecture, contributing, design reference guides
- **examples/** — Sample blueprint with Cursor design system
- **scripts/** — Blueprint validator + pre-publish check
- **assets/** — Hero header image + WDL brand logos
- **.github/** — Issue templates, PR template, CODE_OF_CONDUCT, SECURITY, CI workflow
- **LICENSE** — MIT with attribution note
- **CHANGELOG.md** — Release history
- **GETTING_STARTED.md** — Quick setup guide

**No secrets, no API keys, no test data** — clean and ready for public eyes.

---

## 🎉 After Push

Once live:

1. **Star the repo** yourself to seed it :)
2. **Pin it** to your GitHub profile
3. **Update Witch Daddy Labs website** (you mentioned this) — add a "Products" or "Open Source" section linking to it
4. **Buy the domain** (`cauldronos.com` or `witchdaddylabs.com/cauldron`) — set up redirect to GitHub
5. **Shout on socials** — bring in early adopters
6. **Answer issues promptly** — first response within 24h builds trust

---

**You're good to go.** The repo is solid, documented, licensed, and prettied up.

Any questions before you push? Just ask.

— Hermes
