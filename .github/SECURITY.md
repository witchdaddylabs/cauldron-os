# Security Policy

## Supported Versions

We actively maintain the latest version on the `main` branch.

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | ✅ Active development |
| 1.x     | ❌ End-of-life (unsupported) |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, disclose them responsibly via email:

**Email:** security@witchdaddylabs.com  
**PGP Key:** [available on request — contact us first]  
**Response time:** We aim to respond within 48 hours and provide a fix timeline within 7 days.

### What to Include

- Steps to reproduce (if possible)
- Affected component (server.js, frontend, research scraper, etc.)
- Potential impact (data leak, DoS, etc.)
- Suggested fix (if you have one)

---

## Security Measures in Cauldron OS

Cauldron OS is designed to be **local-first** and **privacy-respecting**:

- **No data collection** — your prompts, blueprints, and designs stay on your machine
- **API keys stored locally** — browser localStorage only; never transmitted to our servers
- **No telemetry** — zero analytics, no tracking
- **Open source** — you can audit the code yourself
- **Sandboxed handoffs** — OpenCode runs in your project directory only

### Known Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| OLLAMA_URL injection (user-controlled) | Low | Cauldron connects only to localhost; ensure Ollama is not exposed externally |
| SSRF via research-url endpoint | Medium (local-only use) | In single-user local context, risk minimal. For multi-user deployments, add URL allowlist or block private IP ranges |
| Blueprint handoff folder permissions | Low | Projects created with current user's umask. Do not run Cauldron as root |
| API key leakage via browser localStorage | Low | Browser localStorage is accessible to any script on localhost. Use only on trusted machine. Clear keys when done. |

If you discover a new vulnerability, please follow the reporting process above.

---

## Security Update Policy

When a vulnerability is confirmed:

1. **Private disclosure** — we coordinate with reporter
2. **Patch development** — fix in a private branch
3. **Advisory CVE** — if warranted, request CVE ID
4. **Public disclosure** — security advisory on GitHub, coordinated release
5. **Version bump** — patch release (2.1.1 → 2.1.2)

We follow responsible disclosure timelines (~90 days for patch development).

---

**Thank you for helping keep Cauldron OS and its community safe.**

— Witch Daddy Labs Security Team
