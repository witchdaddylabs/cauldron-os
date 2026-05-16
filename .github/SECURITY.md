# Security Policy

## Supported versions

We maintain the latest version on `main`. That's the one.

| Version | Supported |
|---------|-----------|
| 0.x     | ✅ Active development |

Anything older doesn't exist yet, so this is straightforward.

## Reporting a vulnerability

**Please don't report security issues through public GitHub issues.**

Email us privately:

**witchdaddylabs@proton.me**

We aim to respond within 48 hours and have a fix timeline within 7 days.

### What to include

- How to reproduce it (if possible)
- Which component is affected (server.js, frontend, research scraper, etc.)
- What the potential impact is (data leak, DoS, etc.)
- A suggested fix if you have one

## Security by design

Cauldron OS is **local-first** and **privacy-respecting** by default:

- **No data collection** — your prompts, blueprints, and designs stay on your machine
- **API keys stored locally** — browser localStorage only, never transmitted to our servers
- **No telemetry** — zero analytics, zero tracking
- **Open source** — you can audit every line
- **Sandboxed handoffs** — OpenCode runs in your project directory only

### Known risks

| Risk | Severity | What we do about it |
|------|----------|---------------------|
| OLLAMA_URL injection (user-controlled) | Low | Cauldron only connects to localhost. Keep Ollama off your network interface. |
| SSRF via research-url endpoint | Medium (local-only) | Risk is minimal in single-user context. For multi-user deployments, add a URL allowlist or block private IP ranges. |
| Blueprint handoff folder permissions | Low | Projects are created with your current user's umask. Don't run Cauldron as root. |
| API key leakage via browser localStorage | Low | localStorage is accessible to any script on localhost. Use this on a machine you trust. Clear keys when you're done. |

If you find something new, follow the reporting process above.

## Disclosure process

When a vulnerability is confirmed:

1. **Private disclosure** — we coordinate with the reporter
2. **Fix development** — we prepare and test the patch
3. **Release** — we publish the fix and note the security impact in release notes

We resolve confirmed issues as quickly as practical for a small open source project.

Thanks for helping keep Cauldron OS safe.
