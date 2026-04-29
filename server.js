/**
 * Cauldron 2.3 — Adaptive Local Models
 * Witch Daddy Labs Internal Dev Tool
 *
 * Upgrades:
 * 1. Impeccable Taste Prompt Injection (Grendel)
 * 2. Awesome Design Reference Selector (Camilo & Grendel)
 * 3. Cloner Research Sweep (Grendel)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_URL = `${OLLAMA_BASE_URL}/api/generate`;
const OLLAMA_TAGS_URL = `${OLLAMA_BASE_URL}/api/tags`;
const OLLAMA_TIMEOUT_MS = 600000;
const CLOUD_TIMEOUT_MS = 300000;
const CLARIFY_NUM_PREDICT = Number(process.env.CAULDRON_CLARIFY_NUM_PREDICT || 2048);
const BLUEPRINT_NUM_PREDICT = Number(process.env.CAULDRON_BLUEPRINT_NUM_PREDICT || 8192);
const OPENAI_BASE_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cache for design system references (avoid re-fetching)
const designSystemCache = new Map();
const DESIGN_SYSTEM_SOURCE = 'https://raw.githubusercontent.com/Meliwat/awesome-design-md-pre-paywall/main/design-md';
const DESIGN_SYSTEMS = {
  none: { name: 'None', repo: null },
  cursor: { name: 'Cursor (Sleek Dark)', repo: 'cursor', path: 'DESIGN.md' },
  vercel: { name: 'Vercel (Precision Geist)', repo: 'vercel', path: 'DESIGN.md' },
  lovable: { name: 'Lovable (Playful Gradients)', repo: 'lovable', path: 'DESIGN.md' },
  raycast: { name: 'Raycast (Vibrant Chrome)', repo: 'raycast', path: 'DESIGN.md' },
  linear: { name: 'Linear (Precise Dark Ops)', repo: 'linear.app', path: 'DESIGN.md' },
  stripe: { name: 'Stripe (Editorial Systems)', repo: 'stripe', path: 'DESIGN.md' },
  notion: { name: 'Notion (Warm Structured Docs)', repo: 'notion', path: 'DESIGN.md' },
  apple: { name: 'Apple (Quiet Premium)', repo: 'apple', path: 'DESIGN.md' },
  figma: { name: 'Figma (Collaborative Canvas)', repo: 'figma', path: 'DESIGN.md' },
  supabase: { name: 'Supabase (Developer Emerald)', repo: 'supabase', path: 'DESIGN.md' },
  resend: { name: 'Resend (Minimal Developer SaaS)', repo: 'resend', path: 'DESIGN.md' },
  webflow: { name: 'Webflow (Visual Builder Polish)', repo: 'webflow', path: 'DESIGN.md' },
  opencode: { name: 'OpenCode (Terminal-native Builder)', repo: 'opencode.ai', path: 'DESIGN.md' },
};

// ─── 1. IMPECCABLE TASTE PROMPT (Grendel) ────────────────────────────────────
const DESIGN_GUIDE = `
ANTI-PATTERNS:
- Never default to Inter or Roboto fonts. Prefer system fonts or brand-specific typefaces.
- Never use pure black (#000); always tint it with the primary color or use deep charcoal.
- Avoid nested cards (cards inside cards) — embrace negative space and breathing room.
- Stop using generic blue gradients. Opt for nuanced monochromatic or duotone gradients.

MANDATES:
- High-contrast typography: large headings, generous line-height (1.6–1.8), clear hierarchy.
- Generous vertical rhythm: consistent spacing scale (multiples of 4px or 8px).
- Subtle border highlights: use rgba(255,255,255,0.1) or rgba(0,0,0,0.1) for depth.
- Premium aesthetic logic: spatial design first, intentional component states, clean micro-interactions.
- Component states: define exhausted hover/focus/active/disabled states for every interactive element.
- Borders: 1px solid rgba(255,255,255,0.1); hover → 1px solid rgba(255,255,255,0.2).
- Text: headings 600–700 weight; body never below 400. Line-clamp for truncation, never ellipsis overflow.
`;

const APP_SYSTEM_PROMPT = `You are a senior technical architect with impeccable taste.
Turn the user's product idea into a concise app blueprint.

${DESIGN_GUIDE}

Use exactly these sections:

# Project Blueprint

## PRD
- App Concept
- Core Features
- Target Users

## Database Schema
Provide one JSON code block with likely tables, fields, and relationships.

## Security Posture
- Auth / permissions
- Validation / rate limiting
- Secrets / data protection

## Architecture Notes
- Frontend
- Backend / APIs
- Database
- Hosting / deployment
- Integrations

At the end, include one HTML code block that previews the core app UI as a self-contained HTML + AlpineJS prototype.
Use triple backticks with html. Include Alpine via CDN when interactivity is useful, use x-data/x-show/x-for/click handlers for quick prototype behaviour, and keep the markup runnable in a sandboxed iframe.

Be concise, practical, and specific. No fluff.`;

const SITE_SYSTEM_PROMPT = `You are a sharp product designer and front-end planner with impeccable taste.
Turn the user's idea into a concise static-site blueprint.

${DESIGN_GUIDE}

Use exactly these sections:

# Project Blueprint

## PRD
- Site Concept
- Key Sections
- Target Audience

## Content Structure
Provide one JSON code block with page sections, modules, and content slots.

## Security Posture
- Form handling
- Validation / spam protection
- Secrets / data protection

## Architecture Notes
- Frontend
- Hosting / deployment
- CMS / content handling
- Analytics / integrations
- Performance / SEO

At the end, include one HTML code block that previews the landing page or site layout as a self-contained HTML + AlpineJS prototype.
Use triple backticks with html. Include Alpine via CDN when interactivity is useful, use x-data/x-show/x-for/click handlers for quick prototype behaviour, and keep the markup runnable in a sandboxed iframe.

Prioritise clean layout, hierarchy, and conversion clarity. No fluff.`;

const CLARIFY_SYSTEM_PROMPT = `You are a blunt senior product manager helping a non-developer clarify an app/site idea before any code is planned.

Return JSON only. No markdown. No commentary.

Schema:
{
  "questions": [
    { "id": "short-kebab-id", "label": "Question?", "why": "Short reason." }
  ],
  "assumptions": ["Short assumption."],
  "redFlags": ["Short risk or ambiguity."],
  "suggestedScope": ["Short scope suggestion."]
}

Rules:
- Ask 5 to 8 questions.
- Be practical, specific, and slightly jaded, not cute.
- Prioritise scope, users, workflows, data, risk, version one, and what not to build.
- Do not ask generic startup questions about markets or growth unless clearly relevant.
- Keep every question answerable by a non-developer.
- Keep assumptions, redFlags, and suggestedScope short.
- Never invent implementation details as facts.`;

function getSystemPrompt(projectType = 'app', designReference = '') {
  let base = projectType === 'site' ? SITE_SYSTEM_PROMPT : APP_SYSTEM_PROMPT;
  
  if (designReference && designReference !== 'none') {
    const designContent = designSystemCache.get(designReference);
    if (designContent) {
      base = `# Design Reference: ${DESIGN_SYSTEMS[designReference].name}\n\n${designContent}\n\n---\n\n${base}`;
    }
  }
  
  return base;
}

const CLOUD_MODELS = {
  gemini: {
    defaultModel: 'gemini-3.1-flash-lite-preview',
    models: ['gemini-3.1-flash-lite-preview', 'gemini-3.1-pro-preview'],
    labels: {
      'gemini-3.1-flash-lite-preview': 'Gemini Flash 3.1 Lite Preview',
      'gemini-3.1-pro-preview': 'Gemini Pro 3.1 Preview',
    },
  },
  openai: {
    defaultModel: 'gpt-5.4',
    models: ['gpt-5.4'],
    labels: {
      'gpt-5.4': 'GPT-5.4',
    },
  },
};

function getCloudModelName(provider, _projectType = 'app', requestedModel = '') {
  const config = CLOUD_MODELS[provider];
  if (!config) throw new Error(`Unsupported cloud provider: ${provider}`);
  if (requestedModel && config.models.includes(requestedModel)) return requestedModel;
  return config.defaultModel;
}

function extractJsonObject(text = '') {
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }

  throw new Error('Model did not return a JSON object');
}

function normaliseClarifyResult(raw) {
  const fallback = {
    questions: [],
    assumptions: [],
    redFlags: [],
    suggestedScope: [],
  };

  const result = { ...fallback, ...(raw || {}) };
  result.questions = Array.isArray(result.questions)
    ? result.questions.slice(0, 8).map((q, index) => {
        const id = String(q?.id || `question-${index + 1}`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || `question-${index + 1}`;
        return {
          id,
          label: String(q?.label || q?.question || '').trim(),
          why: String(q?.why || '').trim(),
        };
      }).filter(q => q.label)
    : [];

  result.assumptions = Array.isArray(result.assumptions) ? result.assumptions.slice(0, 4).map(String) : [];
  result.redFlags = Array.isArray(result.redFlags) ? result.redFlags.slice(0, 4).map(String) : [];
  result.suggestedScope = Array.isArray(result.suggestedScope) ? result.suggestedScope.slice(0, 5).map(String) : [];

  if (result.questions.length === 0) {
    throw new Error('Model returned no clarifying questions');
  }

  return result;
}

// ─── 2. DESIGN REFERENCE FETCHER ────────────────────────────────────────────
function fetchDesignSystem(repo, callback) {
  const url = `${DESIGN_SYSTEM_SOURCE}/${repo}/DESIGN.md`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        callback(null, data);
      } else {
        callback(new Error(`HTTP ${res.statusCode}`), null);
      }
    });
  }).on('error', callback);
}

function ensureDesignSystem(system) {
  if (!system || system === 'none' || !DESIGN_SYSTEMS[system]) return Promise.resolve('');
  if (designSystemCache.has(system)) return Promise.resolve(designSystemCache.get(system));
  const { repo } = DESIGN_SYSTEMS[system];
  if (!repo) return Promise.resolve('');
  return new Promise((resolve) => {
    fetchDesignSystem(repo, (err, content) => {
      if (err) {
        console.warn(`[Cauldron] Design reference ${system} unavailable:`, err.message);
        return resolve('');
      }
      designSystemCache.set(system, content);
      resolve(content);
    });
  });
}

// ─── 3. URL RESEARCH SCRAPER (Grendel) ───────────────────────────────────────
function scrapeURL(targetUrl, callback) {
  // Quick URL validation
  try {
    new URL(targetUrl);
  } catch {
    return callback(new Error('Invalid URL'), null);
  }

  const protocol = targetUrl.startsWith('https') ? https : http;
  
  protocol.get(targetUrl, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', async () => {
      try {
        const findings = await analyseHTML(raw, targetUrl);
        callback(null, findings);
      } catch (err) {
        callback(err, null);
      }
    });
  }).on('error', callback);
}

async function analyseHTML(html, baseUrl) {
  // Very lightweight extraction — no heavy DOM libs needed
  const findings = {
    url: baseUrl,
    fonts: [],
    colors: {},
    cssVars: {},
    structureNotes: []
  };

  // Extract fonts from Google Fonts or inline style links
  const fontLinks = html.match(/fonts\.googleapis\.com[^"'>]*/g) || [];
  findings.fonts = fontLinks.map(link => {
    const match = link.match(/family=([^:&]+)/);
    return match ? match[1] : null;
  }).filter(Boolean);

  // Extract CSS custom properties (--*)
  const customProps = html.match(/--[\w-]+\s*:\s*[^;]+/g) || [];
  findings.cssVars = {};
  customProps.forEach(prop => {
    const [name, value] = prop.split(':').map(s => s.trim());
    if (name && value) findings.cssVars[name] = value;
  });

  // Color extraction (hex/rgb/hsl)
  const colors = html.match(/#[0-9A-Fa-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\)/g) || [];
  findings.colors = [...new Set(colors)].slice(0, 20); // dedupe, top 20

  // Structure hints
  if (html.includes('class="container"') || html.includes('class="wrapper"')) {
    findings.structureNotes.push('Uses container/wrapper layout');
  }
  if (html.includes('flex') || html.includes('grid')) {
    findings.structureNotes.push('Uses modern CSS layout (flex/grid)');
  }
  if (html.includes('border-radius')) {
    findings.structureNotes.push('Rounded corners present');
  }
  if (html.includes('box-shadow')) {
    findings.structureNotes.push('Applies drop shadows');
  }

  return findings;
}

function formatResearchForPrompt(findings) {
  if (!findings) return '';
  
  const summary = [];
  summary.push(`## Research Findings from ${findings.url}`);
  
  if (findings.fonts.length) {
    summary.push(`\n**Typography:** ${findings.fonts.join(', ')}`);
  }
  
  if (Object.keys(findings.cssVars).length) {
    summary.push('\n**CSS Variables:**');
    Object.entries(findings.cssVars).forEach(([k, v]) => {
      summary.push(`  - ${k}: ${v}`);
    });
  }
  
  if (findings.colors.length) {
    summary.push(`\n**Color Palette:** ${findings.colors.join(', ')}`);
  }
  
  if (findings.structureNotes.length) {
    summary.push(`\n**Layout Patterns:** ${findings.structureNotes.join('; ')}`);
  }
  
  return summary.join('\n');
}

// ─── API ROUTES ──────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Cauldron 2.3' });
});


function normaliseLimitOffset(query) {
  return {
    limit: Math.min(Math.max(Number(query.limit) || 50, 1), 200),
    offset: Math.max(Number(query.offset) || 0, 0),
  };
}

function sendMarkdownDownload(res, filename, markdown) {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(markdown);
}

// Drafts API — local-first public feature. Runtime files live in ./data.
app.get('/api/drafts', (req, res) => {
  try {
    const { limit, offset } = normaliseLimitOffset(req.query);
    const drafts = db.getAllDrafts(limit, offset, req.query.q || '');
    res.json({ success: true, drafts, total: db.countDrafts() });
  } catch (err) {
    console.error('[Cauldron] Draft list error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch drafts', details: err.message });
  }
});

app.post('/api/drafts', (req, res) => {
  try {
    const { projectName, brainDump = '', blueprint, designReference = 'none', generationMode = 'local', modelUsed = null } = req.body;
    if (!projectName || !blueprint) {
      return res.status(400).json({ success: false, error: 'projectName and blueprint are required' });
    }

    const result = db.createDraft({ projectName, brainDump, blueprint, designReference, generationMode, modelUsed });
    db.createSession({
      sessionId: req.headers['x-session-id'] || db.generateSessionId(),
      brainDump,
      designReference,
      generationMode,
      modelUsed,
      draftId: result.id,
    });

    res.json({ success: true, draftId: result.id, filename: result.filename });
  } catch (err) {
    console.error('[Cauldron] Save draft error:', err);
    res.status(500).json({ success: false, error: 'Failed to save draft', details: err.message });
  }
});

app.get('/api/drafts/:id', (req, res) => {
  try {
    const draft = db.getDraftById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, error: 'Draft not found' });
    res.json({ success: true, draft });
  } catch (err) {
    console.error('[Cauldron] Draft fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch draft', details: err.message });
  }
});

app.get('/api/drafts/:id/export.md', (req, res) => {
  try {
    const draft = db.getDraftById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, error: 'Draft not found' });
    const safeName = String(draft.project_name || 'cauldron-draft').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cauldron-draft';
    sendMarkdownDownload(res, `${safeName}.md`, draft.blueprint || '');
  } catch (err) {
    console.error('[Cauldron] Draft export error:', err);
    res.status(500).json({ success: false, error: 'Failed to export draft', details: err.message });
  }
});

app.delete('/api/drafts/:id', (req, res) => {
  try {
    const ok = db.deleteDraft(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Draft not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[Cauldron] Delete draft error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete draft', details: err.message });
  }
});

app.get('/api/history', (req, res) => {
  try {
    const { limit, offset } = normaliseLimitOffset(req.query);
    res.json({ success: true, sessions: db.getSessions(limit, offset), total: db.countSessions() });
  } catch (err) {
    console.error('[Cauldron] History error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch history', details: err.message });
  }
});

app.post('/api/history/cleanup', (req, res) => {
  try {
    const days = Number(req.body.days || 90);
    res.json({ success: true, purged: db.purgeOldDays(days) });
  } catch (err) {
    console.error('[Cauldron] History cleanup error:', err);
    res.status(500).json({ success: false, error: 'Cleanup failed', details: err.message });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    res.json({
      success: true,
      stats: {
        totalDrafts: db.countDrafts(),
        totalSessions: db.countSessions(),
        recentActivity: db.getSessions(10, 0).length,
      },
    });
  } catch (err) {
    console.error('[Cauldron] Stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch stats', details: err.message });
  }
});

app.get('/api/cloud-models', (req, res) => {
  res.json({ success: true, providers: CLOUD_MODELS });
});

app.get('/api/ollama-models', async (req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(OLLAMA_TAGS_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`Ollama ${response.status}`);
    const data = await response.json();
    const models = Array.isArray(data.models)
      ? data.models.map(model => ({
          name: model.name,
          label: model.name,
          size: model.size || null,
          modifiedAt: model.modified_at || null,
        })).filter(model => model.name)
      : [];
    res.json({ success: true, baseUrl: OLLAMA_BASE_URL, models });
  } catch (err) {
    res.status(503).json({ success: false, baseUrl: OLLAMA_BASE_URL, models: [], error: 'Unable to detect Ollama models', details: err.message });
  } finally {
    clearTimeout(timeout);
  }
});

// Get available design systems
app.get('/api/design-systems', (req, res) => {
  const list = Object.entries(DESIGN_SYSTEMS)
    .filter(([key]) => key !== 'none')
    .map(([key, val]) => ({ id: key, name: val.name }));
  res.json({ systems: list });
});

// Pre-load a design system reference into cache
app.post('/api/design-reference', async (req, res) => {
  const { system } = req.body;
  
  if (!system || !DESIGN_SYSTEMS[system]) {
    return res.status(400).json({ error: 'Invalid design system' });
  }
  
  if (designSystemCache.has(system)) {
    return res.json({ cached: true, system });
  }
  
  const { repo, path: filePath } = DESIGN_SYSTEMS[system];
  if (!repo) {
    return res.json({ cached: false, system, content: '' });
  }
  
  fetchDesignSystem(repo, (err, content) => {
    if (err) {
      console.error(`Failed to fetch ${repo}:`, err.message);
      return res.status(500).json({ error: `Failed to fetch design system: ${err.message}` });
    }
    
    designSystemCache.set(system, content);
    res.json({ cached: false, system, content });
  });
});

// Research endpoint — scrape a URL for design signals
app.post('/api/research-url', (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }
  
  scrapeURL(url, (err, findings) => {
    if (err) {
      console.error('Research failed:', err);
      return res.status(500).json({ error: `Research failed: ${err.message}` });
    }
    
    const formatted = formatResearchForPrompt(findings);
    res.json({ success: true, findings, formatted });
  });
});

// POST /api/clarify — Ask project-manager questions before blueprint generation
app.post('/api/clarify', async (req, res) => {
  try {
    const { prompt, model, projectType = 'app', apiKey = '', cloudModel = '' } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt required' });
    }

    const clarifyPrompt = `Project type: ${projectType}\n\nBrain dump:\n${prompt}\n\nAsk the project-manager questions needed before generating a build blueprint.`;
    let rawText = '';

    if (['openai', 'gemini'].includes(model)) {
      if (!apiKey) {
        return res.status(400).json({ error: 'Missing API key', details: `No API key was provided for ${model}.` });
      }
      rawText = await callCloudModel({
        provider: model,
        apiKey,
        prompt: clarifyPrompt,
        systemPrompt: CLARIFY_SYSTEM_PROMPT,
        projectType,
        requestedModel: cloudModel,
      });
    } else {
      rawText = await callOllamaModel({
        model,
        prompt: clarifyPrompt,
        systemPrompt: CLARIFY_SYSTEM_PROMPT,
        numPredict: CLARIFY_NUM_PREDICT,
        temperature: 0.35,
      });
    }

    const questions = normaliseClarifyResult(extractJsonObject(rawText));
    res.json({ success: true, ...questions });
  } catch (err) {
    console.error('Clarify error:', err);
    res.status(500).json({ error: 'Clarification failed', details: err.message });
  }
});

// POST /api/generate — Routes to local Ollama or cloud models
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, model, projectType = 'app', apiKey = '', designReference = 'none', researchData = null, cloudModel = '', researchUrl = '' } = req.body;
    
    await ensureDesignSystem(designReference);
    let systemPrompt = getSystemPrompt(projectType, designReference);
    
    // Inject dedicated research URL for traceability even when scrape fails or is skipped
    if (researchUrl) {
      systemPrompt += `\n\n## User-provided research URL\n${researchUrl}\nUse this as a visual/reference target when relevant.`;
    }

    // Inject research findings if provided
    if (researchData && researchData.formatted) {
      systemPrompt += `\n\n${researchData.formatted}\n\nUse these design signals to match the visual language and structure.`;
    }
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }
    
    // Cloud models
    if (['openai', 'gemini'].includes(model)) {
      if (!apiKey) {
        return res.status(400).json({
          error: 'Missing API key',
          details: `No API key was provided for ${model}. Add it in Cloud Cauldron and try again.`
        });
      }
      
      const modelUsed = getCloudModelName(model, projectType, cloudModel);
      const blueprint = await callCloudModel({
        provider: model,
        apiKey,
        prompt,
        systemPrompt,
        projectType,
        requestedModel: cloudModel,
      });
      
      db.createSession({
        sessionId: req.headers['x-session-id'] || db.generateSessionId(),
        brainDump: prompt,
        urlResearch: researchData || null,
        designReference,
        generationMode: 'cloud',
        modelUsed,
        draftId: null,
      });
      return res.json({ success: true, blueprint, canHandoff: true, modelUsed, providerUsed: model });
    }
    
    // Local models → Ollama
    const ollamaModel = model;
    const blueprint = await callOllamaModel({
      model: ollamaModel,
      prompt,
      systemPrompt,
      numPredict: BLUEPRINT_NUM_PREDICT,
      temperature: 0.55,
    });
    
    db.createSession({
      sessionId: req.headers['x-session-id'] || db.generateSessionId(),
      brainDump: prompt,
      urlResearch: researchData || null,
      designReference,
      generationMode: 'local',
      modelUsed: ollamaModel,
      draftId: null,
    });
    res.json({ success: true, blueprint, canHandoff: true, modelUsed: ollamaModel, providerUsed: 'ollama' });
    
  } catch (err) {
    console.error('Generate error:', err);
    
    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: 'Generation timed out',
        details: ['openai', 'gemini'].includes(model)
          ? `Cloud model did not respond within ${CLOUD_TIMEOUT_MS / 1000}s.`
          : `Ollama did not respond within ${OLLAMA_TIMEOUT_MS / 1000}s. Try a shorter prompt or a smaller model output.`
      });
    }
    
    res.status(500).json({ error: 'Generation failed', details: err.message });
  }
});

async function callOllamaModel({ model, prompt, systemPrompt, numPredict = 8192, temperature = 0.55 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const ollamaRes = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        system: systemPrompt,
        stream: false,
        options: {
          num_predict: numPredict,
          temperature,
          top_p: 0.9,
        },
      }),
    }).catch(() => {
      throw new Error(`Cannot reach Ollama at ${OLLAMA_URL}. Is Ollama running?`);
    });

    if (!ollamaRes.ok) {
      const text = await ollamaRes.text();
      throw new Error(`Ollama ${ollamaRes.status}: ${text}`);
    }

    const data = await ollamaRes.json();
    return data.response || data.message || '';
  } finally {
    clearTimeout(timeout);
  }
}

async function callCloudModel({ provider, apiKey, prompt, systemPrompt, projectType, requestedModel = '' }) {
  const url = provider === 'gemini' ? GEMINI_BASE_URL : OPENAI_BASE_URL;
  const model = getCloudModelName(provider, projectType, requestedModel);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: provider === 'gemini' ? 0.5 : 0.55,
      }),
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${provider} ${response.status}: ${text}`);
    }
    
    const data = await response.json();
    const blueprint = data?.choices?.[0]?.message?.content;
    
    if (!blueprint) {
      throw new Error(`${provider} returned no blueprint content`);
    }
    
    return blueprint;
  } finally {
    clearTimeout(timeout);
  }
}

// POST /api/handoff — Creates project folder, saves blueprint, triggers OpenCode
app.post('/api/handoff', (req, res) => {
  const { projectName, blueprint } = req.body;
  
  if (!projectName || !blueprint) {
    return res.status(400).json({ error: 'projectName and blueprint required' });
  }
  
  // Sanitize project name for filesystem
  const safeName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
  
  const projectPath = path.join(__dirname, 'projects', safeName);
  
  // Check if project already exists
  if (fs.existsSync(projectPath)) {
    return res.status(409).json({ error: `Project "${safeName}" already exists` });
  }
  
  try {
    // Create project directory
    fs.mkdirSync(projectPath, { recursive: true });
    
    // Save blueprint.md
    const blueprintPath = path.join(projectPath, 'blueprint.md');
    fs.writeFileSync(blueprintPath, blueprint, 'utf-8');
    
    
    // Prepare OpenCode handoff prompt and launch detached background job
    const handoffPrompt = [
      'Read blueprint.md and build the project described there.',
      'Use the blueprint as the source of truth for product scope, schema, stack, and UI direction.',
      'If the blueprint implies a web app, initialise an appropriate app scaffold and begin implementation.',
      'Create a practical first-pass project structure, core setup, and README notes.',
      'Do not read .env or any secret files.',
      'If environment variables are needed, create or update .env.example and continue without requiring real secrets.',
      'Avoid stopping for credential setup unless absolutely necessary.',
      'Be decisive and start building rather than just summarising the blueprint.'
    ].join(' ');
    
    const logPath = path.join(projectPath, 'opencode-handoff.log');
    const outFd = fs.openSync(logPath, 'a');
    const opencodeArgs = [
      '--model', 'opencode-go/kimi-k2.6',
      'run', handoffPrompt,
      '--dir', projectPath,
      '-f', 'blueprint.md'
    ];
    
    
    const child = spawn('opencode', opencodeArgs, {
      cwd: projectPath,
      detached: true,
      stdio: ['ignore', outFd, outFd]
    });
    
    child.unref();
    
    res.json({
      success: true,
      message: 'Project created and OpenCode handoff started',
      projectPath,
      logPath,
      pid: child.pid
    });
    
  } catch (err) {
    console.error('[Cauldron] Handoff error:', err);
    res.status(500).json({ error: 'Handoff failed', details: err.message });
  }
});

// Serve frontend for all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

(async () => {
  await db.init();

  app.listen(PORT, () => {
    console.log(`\n🔥 Cauldron OS 2.3.0 — Witch Daddy Labs (open source)`);
    console.log(`   Master Brain upgrades loaded:`);
    console.log(`   • Impeccable Taste (Grendel)`);
    console.log(`   • Design Reference Selector (Camilo & Grendel)`);
    console.log(`   • URL Research Sweep (Grendel)`);
    console.log(`   • Local Drafts, History & Markdown Export`);
    console.log(`   Server running at http://localhost:${PORT}`);
    console.log(`   Data directory: ${db.paths.DATA_DIR}\n`);
  });
})();
