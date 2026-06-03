/**
 * Cauldron OS v0.260 — Witch Daddy Labs
 *
 * Thin composition root. All business logic and routes extracted to:
 * - lib/        (model-client, research, agent-loop, tools, workspace, xml-parser)
 * - routes/     (route handlers organized by domain)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { chromium } = require('playwright');
const db = require('./db');
const { findNextAction } = require('./lib/xml-parser');
const workspace = require('./lib/workspace');
const { runTool, toolsSystemPrompt } = require('./lib/tools');
const { generateWithTools, buildSystemPrompt } = require('./lib/agent-loop');
const {
  CLOUD_MODELS,
  getCloudModelName,
  extractJsonObject,
  normaliseClarifyResult,
  normaliseOpenAICompatibleChatUrl,
  modelRequiresDefaultTemperature,
  buildChatPayload,
  inferProviderFromModel,
  callOllamaModel,
  callCloudModel,
} = require('./lib/model-client');
const {
  scrapeURLFast,
  scrapeRenderedURL,
  formatResearchForPrompt,
} = require('./lib/research');
const {
  createDesignSystems,
  createDesignSystemService,
} = require('./lib/design-system-catalog');
const registerAllRoutes = require('./routes');
const { version: PACKAGE_VERSION } = require('./package.json');

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
const REFERO_BASE = 'https://styles.refero.design/style';

// ─── Refero Styles Index ──────────────────────────────────────────────────
// Cleaned 2026-06-02: replaced orphaned UUIDs with current Refero API catalog.
// Each entry has promptGuidance for rich injection when no DESIGN.md is available.
const REFERO_STYLES = {
  'refero-linear': {
    name: 'Linear (Midnight Command Center)',
    uuid: '90ce5883-bb24-4466-93f7-801cd617b0d1',
    scheme: 'dark',
    colors: ['#08090a', '#0f1011', '#161718'],
    fonts: ['Inter Variable', 'Berkeley Mono'],
    promptGuidance: 'Pitch-black SaaS aesthetic with precise typography and monospace code accents. Sidebar-driven tooling layout. Dark grays layered for depth. Use monospace for data and code, Inter for UI. Minimal chrome, maximum data density. Professional developer tool feel.'
  },
  'refero-mercury': {
    name: 'Mercury (Mountain Top Command)',
    uuid: '3172cd4d-118a-4a16-a259-6b634d32322e',
    scheme: 'dark',
    colors: ['#5266eb', '#cdddff', '#171721'],
    fonts: ['arcadiaDisplay', 'arcadia'],
    promptGuidance: 'Dark backdrop with distinctive Cornflower Blue (#5266eb) as the signature accent. High-contrast hierarchy with ghost-blue highlights on deep navy surfaces. Custom arcadia typeface family gives it a refined, editorial feel. Banking/finance quality polish — trustworthy and premium.'
  },
  'refero-github': {
    name: 'GitHub (Developer Warmth)',
    uuid: 'c3ceca5c-d329-4559-b947-016172941ba2',
    scheme: 'dark',
    colors: ['#0d1117', '#000000', '#151a22'],
    fonts: ['Mona Sans', 'Mona Sans VF', 'Mona Sans Mono'],
    promptGuidance: 'Warm dark canvas (#0d1117) with GitHub\'s signature developer-friendly aesthetic. Mona Sans for UI with dedicated monospace variant for code. Repository-and-navigation oriented layout. Approachable dark mode that feels like a workspace, not a cinema. Community and collaboration cues.'
  },
  'refero-slash': {
    name: 'Slash (Editorial Noir)',
    uuid: '7c38e84b-aea0-4c8f-b3e9-60b994ee6c6b',
    scheme: 'dark',
    colors: ['#000000', '#030304', '#08080a'],
    fonts: ['Inter', 'Ivy Presto'],
    promptGuidance: 'Pure black canvas with editorial serif accent (Ivy Presto) for headings. Inter for body. Extremely minimalist — almost no chrome or borders. Content-forward design that lets typography do the heavy lifting. Feels like a premium magazine in dark mode. High-contrast, elegant, restrained.'
  },
  'refero-superhuman': {
    name: 'Superhuman (Warm Parchment)',
    uuid: '418b374a-be64-44f0-b17e-1d45308c7e62',
    scheme: 'both',
    colors: ['#f2f0eb', '#292827', '#ffffff'],
    fonts: ['Super Sans VF'],
    promptGuidance: 'Warm parchment off-white (#f2f0eb) canvas with deep ink (#292827) text — email/correspondence inspired. Custom Super Sans VF gives controlled warmth. Works in both light (parchment) and dark (ink) modes. Feels like writing on quality paper. Intimate, productive, human-scale interface. Keyboard-first interaction cues.'
  },
  'refero-apple': {
    name: 'Apple (Quiet Premium)',
    uuid: 'c9cabb96-32fa-4896-837a-f2497ce1c856',
    scheme: 'light',
    colors: ['#1d1d1f', '#707070', '#474747'],
    fonts: ['SF Pro Display', 'SF Pro Text'],
    promptGuidance: 'Quiet light aesthetic with Apple\'s signature SF Pro type system. Generous whitespace, rounded corners, subtle shadows. Product-focused layout with hero imagery. The quintessential premium brand experience — minimal, expensive-feeling, everything in its right place. Neutral grays with no aggressive colors.'
  },
  'refero-travelperk': {
    name: 'Travelperk (Electric Lime)',
    uuid: '75c06591-34d2-493a-bd49-70551b5e4a53',
    scheme: 'light',
    colors: ['#beff50', '#14140f', '#000000'],
    fonts: ['OTSono'],
    promptGuidance: 'Bold lime green (#beff50) signature color against near-black (#14140f) text — energetic and unmistakable. Custom OTSono font gives distinctive character. Playful but professional. High-energy B2B SaaS that refuses to be boring. Great for fintech, travel, or any brand that wants to stand out with confidence.'
  },
  'refero-arva': {
    name: 'Arva (Teal Serif)',
    uuid: '15846be3-8df8-42e4-a05c-d9395dcec369',
    scheme: 'light',
    colors: ['#07503f', '#b2cee7', '#fceace'],
    fonts: ['Inter', 'RecklessLight', 'Reckless'],
    promptGuidance: 'Deep teal (#07503f) as the anchor color paired with a refined serif (Reckless) for warmth. Light airy background with warm cream accents. Nature-and-craft aesthetic — feels like a design-forward brand in the sustainability or wellness space. Calm, grounded, artisanal without being rustic.'
  },
  'refero-posthog': {
    name: 'PostHog (Clean Developer)',
    uuid: '56cd3725-3ff0-459e-894d-5da58d1fc549',
    scheme: 'light',
    colors: ['#ffffff', '#eeefe9', '#e5e7e0'],
    fonts: ['IBM Plex Sans Variable', 'ui-monospace'],
    promptGuidance: 'Crisp white canvas with subtle warm-gray surfaces. IBM Plex family for a developer-friendly but polished feel. Monospace for data and metrics. Clean, functional, transparent. Open-source tooling aesthetic — honest, unstyled, proud of being utilitarian. Great for analytics, dev tools, or data products.'
  },
  'refero-monopo': {
    name: 'Monopo Saigon (Gradient Depths)',
    uuid: '3e52dd36-6ab1-48c6-bc40-47ef6d33abc2',
    scheme: 'dark',
    colors: ['#000000', '#ffffff', '#181818'],
    fonts: ['Roobert', 'Raleway'],
    promptGuidance: 'Pure black canvas with shifting gradient overlays creating depth. Frosted glass effects and layered transparency. Roobert for bold headings, Raleway for body. Agency/studio portfolio feel — theatrical, immersive, showcase-first. Dark and atmospheric with moments of bright contrast. Motion-forward aesthetic.'
  },
  'refero-huly': {
    name: 'Huly (Deep Workspace)',
    uuid: 'd018e81d-6bb6-4445-86d7-39fd6be7e74d',
    scheme: 'dark',
    colors: ['#090a0c', '#111111', '#303236'],
    fonts: ['Esbuild', 'Inter'],
    promptGuidance: 'Deep charcoal workspace with Esbuild (custom geometric) for headings and Inter for body. Project-management inspired sidebar-and-canvas layout. Dense information display with clean separation. Feels like a professional creative tool — Figma/Notion territory. Multi-panel, keyboard-shortcut-ready, power-user oriented.'
  },
  'refero-amplemarket': {
    name: 'Amplemarket (Crisp Monochrome)',
    uuid: 'db451eca-8de6-43a9-a5d5-35271befdffd',
    scheme: 'light',
    colors: ['#111111', '#ffffff', '#272625'],
    fonts: ['Labil Grotesk Variable'],
    promptGuidance: 'Stark black-on-white with Labil Grotesk — a controlled, neutral grotesk. No decorative colors, no gradients. Pure information hierarchy through typography weight and spacing alone. Sales/enterprise tool aesthetic. Sharp, fast, no-nonsense. The design disappears so the data speaks.'
  },
  'refero-oryzo': {
    name: 'ORYZO AI (Warm Earth)',
    uuid: '1f204e95-454a-437e-845b-c1b169d35607',
    scheme: 'dark',
    colors: ['#100904', '#ffedd7', '#40372e'],
    fonts: ['halyard-display-variable', 'Arial'],
    promptGuidance: 'Warm dark canvas with brown-earth undertones (#100904) rather than cool navy. Cream/warm-white text (#ffedd7) for a softer, less clinical read. Halyard Display for headlines. AI/productivity tool with a human touch. Approachable dark mode — feels like a well-lit room at night rather than a cave.'
  },
  'refero-authkit': {
    name: 'Authkit (Midnight Auth)',
    uuid: 'e80231a2-e4d6-406a-a2c9-2e6109679690',
    scheme: 'dark',
    colors: ['#05060f', '#ffffff', '#2f343'],
    fonts: ['Untitled Sans', 'aeonikPro', 'dotDigital'],
    promptGuidance: 'Near-black navy canvas (#05060f) with pure white text — maximum contrast. Untitled Sans and aeonikPro for a modern, slightly geometric feel. Clean, trustworthy, security-conscious aesthetic. Authentication/identity product territory — needs to feel safe and solid. Minimal motion, maximum clarity.'
  },
};

// Cache for design system references (avoid re-fetching)
const DESIGN_SYSTEM_SOURCE = 'https://raw.githubusercontent.com/Meliwat/awesome-design-md-pre-paywall/main/design-md';
const LEGACY_DESIGN_SYSTEMS = {
  none: { name: 'None', repo: null, path: null },
  cursor: { name: 'Cursor (Sleek Dark)', repo: 'cursor', path: 'DESIGN.md' },
  vercel: { name: 'Vercel (Precision Geist)', repo: 'vercel', path: 'DESIGN.md' },
  lovable: { name: 'Lovable (Playful Gradients)', repo: 'lovable', path: 'DESIGN.md' },
  raycast: { name: 'Raycast (Vibrant Chrome)', repo: 'raycast', path: 'DESIGN.md' },
  stripe: { name: 'Stripe (Editorial Systems)', repo: 'stripe', path: 'DESIGN.md' },
  notion: { name: 'Notion (Warm Structured Docs)', repo: 'notion', path: 'DESIGN.md' },
  figma: { name: 'Figma (Collaborative Canvas)', repo: 'figma', path: 'DESIGN.md' },
  supabase: { name: 'Supabase (Developer Emerald)', repo: 'supabase', path: 'DESIGN.md' },
  webflow: { name: 'Webflow (Visual Builder Polish)', repo: 'webflow', path: 'DESIGN.md' },
  opencode: { name: 'OpenCode (Terminal-native Builder)', repo: 'opencode.ai', path: 'DESIGN.md' },
};
const DESIGN_SYSTEMS = createDesignSystems({
  rootDir: __dirname,
  legacySystems: LEGACY_DESIGN_SYSTEMS,
  referoStyles: REFERO_STYLES,
});
const {
  cache: designSystemCache,
  fetchDesignSystem,
  ensureDesignSystem,
} = createDesignSystemService({
  rootDir: __dirname,
  systems: DESIGN_SYSTEMS,
  remoteBaseUrl: DESIGN_SYSTEM_SOURCE,
});

// ─── TEMPLATES ───────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'static-html',
    name: 'Static HTML/CSS',
    projectType: 'site',
    scaffold: 'static-html',
    recommendedUse: 'simple landing pages, microsites, and zero-build concept pages',
    files: ['index.html', 'styles.css', 'README.md', 'blueprint.md', 'cauldron.project.json'],
    promptBias: 'Build a polished static HTML/CSS site with semantic markup, responsive sections, strong hierarchy, and no build tooling. The HTML preview must be a complete, working landing page with all sections rendered using realistic content and proper design states.',
  },
  {
    id: 'html-alpine',
    name: 'HTML + AlpineJS',
    projectType: 'prototype',
    scaffold: 'html-alpine',
    recommendedUse: 'interactive lightweight prototypes and single-page tools',
    files: ['index.html', 'styles.css', 'README.md', 'blueprint.md', 'cauldron.project.json'],
    promptBias: 'Build a polished, self-contained interactive prototype using semantic HTML, AlpineJS state management (x-data, x-show, x-transition, x-for), minimal dependencies, accessible controls, and premium dark UI styling. Include baked-in demo data, localStorage persistence, and proper loading/empty/error states. The HTML preview must be a fully working app.',
  },
  {
    id: 'nextjs',
    name: 'Next.js App',
    projectType: 'app',
    scaffold: 'nextjs',
    recommendedUse: 'modern React apps, SaaS dashboards, and production web apps',
    files: ['app/page.tsx', 'app/layout.tsx', 'package.json', 'README.md', 'blueprint.md', 'cauldron.project.json'],
    promptBias: 'Build a production-quality Next.js app with TypeScript, App Router, Server Components by default, and client components for interactive sections. Use Tailwind CSS for styling with a professional design system approach. Include proper loading/error/empty states, responsive design, and accessible markup.',
  },
  {
    id: 'astro',
    name: 'Astro Static',
    projectType: 'site',
    scaffold: 'astro',
    recommendedUse: 'content-heavy sites, blogs, documentation, and marketing pages',
    files: ['src/pages/index.astro', 'public/', 'package.json', 'README.md', 'blueprint.md', 'cauldron.project.json'],
    promptBias: 'Build a polished Astro site with static output, semantic HTML, and modern CSS. Use Astro components for layout and content sections. The site must be fully working with realistic content, proper meta tags, responsive design, and accessible markup.',
  },
];

// ─── Session state for build pipeline ──────────────────────────────────────
const activeBuildControllers = new Map();
const buildSessions = new Map();

// ─── Prompt System ─────────────────────────────────────────────────────────
const DESIGN_GUIDE = `
## Taste Mandates (non-negotiable)
- No purple unless explicitly requested. No gradients unless they serve the design.
- No emojis as design elements. No stock photography placeholders.
- No generic "lorem ipsum" — all copy must be real and contextual.
- No centered layouts for body content. Left-aligned is the default.
- No pure black (#000000) — use rich dark grays instead.
- No pure white (#FFFFFF) — use warm off-whites instead.
- Typography must have clear hierarchy: display → heading → body → meta.
- Spacing must follow a consistent 4px or 8px grid.
- Interactive elements must have visible hover/focus states.
- Motion must be purposeful — no gratuitous animation.
- Every component must work at mobile (375px), tablet (768px), and desktop (1440px).
- WCAG 2.1 AA contrast compliance is mandatory.
- Dark mode is the default aesthetic — light mode is the alternative.
`;

const APP_SYSTEM_PROMPT = `You are a senior technical architect with impeccable taste.
${DESIGN_GUIDE}

Your job is to produce a complete, structured blueprint document for a web application.

## Output Format\nProduce a complete blueprint document with these sections:\n\n### 1. Project Overview\n- App name, tagline, and one-paragraph description\n- Target users and core value proposition\n\n### 2. Core Features\n- Numbered list of 5-8 MVP features\n- Each feature: name, 1-line description, why it matters\n\n### 3. User Flows\n- Describe 2-3 key user journeys step by step\n- Include entry points, decision points, and outcomes\n\n### 4. Technical Architecture\n- Recommended frontend approach (from the selected template)\n- State management strategy\n- Data flow overview\n- Key integration points\n\n### 5. UI/UX Specifications\n- Layout grid and breakpoints\n- Primary navigation pattern\n- Key screens/views (3-5)\n- Component inventory\n\n### 6. Information Architecture\n- Sitemap or screen hierarchy\n- Content types and data models\n\n### 7. Visual Direction\n- Typography scale (display, heading, body, meta)\n- Color palette (primary, secondary, accent, neutral, semantic)\n- Spacing system\n- Interaction patterns\n\n### 8. Implementation Notes\n- Build considerations\n- Performance requirements\n- Accessibility requirements\n- Browser support\n`;

const SITE_SYSTEM_PROMPT = `You are a sharp product designer and front-end planner with impeccable taste.
${DESIGN_GUIDE}

Your job is to produce a complete, structured blueprint document for a website.

## Output Format
Produce a complete blueprint document with these sections:

### 1. Project Overview
- Site name, tagline, and one-paragraph description
- Target audience and key message

### 2. Content Strategy
- Primary pages (5-8)
- Content hierarchy per page
- Key calls to action

### 3. User Experience
- Primary user journey(s)
- Navigation structure
- Interaction patterns

### 4. Page Specifications
- For each primary page: purpose, layout, key components
- Responsive behavior notes

### 5. Visual Identity
- Typography system (fonts, scale, weights)
- Color palette (with specific hex values)
- Imagery style and art direction
- Spacing and layout grid

### 6. Technical Approach
- Build approach (from the selected template)
- Performance targets
- SEO considerations
- Analytics/tracking needs

### 7. Component Inventory
- Reusable components needed
- Per-component specs (props, states, behavior)

### 8. Implementation Notes
- Build priorities
- Content migration needs
- Third-party integrations
`;

const CLARIFY_SYSTEM_PROMPT = `You are a blunt senior product manager helping a non-developer clarify an app/site idea before any code is planned.

Your job is to ask clarifying questions and surface assumptions.

Return JSON only:
{
  "questions": [{"id": "unique-id", "label": "The question?", "why": "Why this matters"}],
  "assumptions": ["assumption 1"],
  "redFlags": ["risk 1"],
  "suggestedScope": ["scope suggestion 1"]
}

Ask no more than 8 questions. Focus on: users, workflows, scope, constraints, success criteria.`;

const PROTOTYPE_SYSTEM_PROMPT = `You are a senior front-end developer with impeccable taste.
Your job is to convert a product blueprint into a polished, working HTML prototype.

## Instructions
- Read the blueprint below carefully — this is your source of truth
- Produce a complete, self-contained HTML page with embedded CSS
- Use AlpineJS (via CDN) for any interactivity
- Follow the selected design reference for visual styling
- Output only the HTML inside a \`\`\`html fenced code block
- Do NOT produce another planning document — only the prototype HTML
- Respect the blueprint's structure: sections, components, features, flow

## Blueprint
{blueprint text goes here}
`;

function getSystemPrompt(projectType = 'app', designReference = '') {
  let base = projectType === 'site' ? SITE_SYSTEM_PROMPT : APP_SYSTEM_PROMPT;

  if (designReference && designReference !== 'none') {
    const ds = DESIGN_SYSTEMS[designReference];
    if (ds?.promptGuidance) {
      base += `\n\n## Active Design Reference: ${ds.name}\n${ds.promptGuidance}\n\nThis design reference takes priority over generic taste mandates. Follow its visual language, color palette, typography, and general aesthetic.`;
    } else if (ds) {
      base += `\n\n## Active Design Reference: ${ds.name}\nUse the selected design system as the primary visual language. This reference takes priority over generic taste mandates.`;
    }
  }

  return base;
}

function getTemplate(templateId = '') {
  return TEMPLATES.find(t => t.id === templateId) || null;
}

function formatTemplateForPrompt(template) {
  if (!template) return '';
  const files = Array.isArray(template.files) && template.files.length
    ? `\n\nExpected scaffold files:\n${template.files.map(file => `- ${file}`).join('\n')}`
    : '';
  return `## Project Type: ${template.name}\n${template.promptBias}${files}`;
}

// ─── Cloud Agent Build Helper ──────────────────────────────────────────────

async function _runCloudAgentBuild({ prompt, model, apiKey, systemPrompt, sessionId, onToken, signal, cloudModel }) {
  const MAX_ROUNDS = 40;
  const provider = model;
  const url = provider === 'gemini' ? GEMINI_BASE_URL : OPENAI_BASE_URL;
  const modelName = getCloudModelName(provider, 'app', cloudModel || '');

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  const finalActions = [];
  const finalFiles = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (signal && signal.aborted) break;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: true,
        temperature: provider === 'gemini' ? 0.5 : 0.55,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`${provider} ${response.status}: ${text}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim().startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) {
            fullText += content;
            if (onToken) onToken(content);
          }
        } catch (e) {
          // Skip malformed JSON lines
        }
      }
    }

    const actions = _extractBuildActions(fullText);

    if (actions.length === 0) {
      return { files: [...new Set(finalFiles)], actions: finalActions, messages };
    }

    for (const action of actions) {
      if (signal && signal.aborted) break;
      const ctx = { sessionId };
      const result = await runTool(action.name, action.args, ctx);
      if (['write_file', 'edit_file', 'delete_file'].includes(action.name)) {
        if (action.args && action.args.path) {
          finalFiles.push(action.args.path);
        }
      }
      finalActions.push({ name: action.name, args: action.args, result });
      messages.push({
        role: 'user',
        content: `[Tool Result: ${action.name}]\n\n${result}\n\nContinue working. If you are done, respond with a summary of what was completed.`,
      });
    }
    messages.push({ role: 'assistant', content: fullText });
  }

  return { files: [...new Set(finalFiles)], actions: finalActions, messages };
}

function _extractBuildActions(text) {
  const actions = [];
  let fromIndex = 0;
  while (fromIndex < text.length) {
    const result = findNextAction(text, fromIndex);
    if (result === null || result === 'incomplete') break;
    actions.push({ name: result.name, args: result.args });
    fromIndex = result.end;
  }
  return actions;
}

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/research-assets', express.static(path.join(db.paths.DATA_DIR, 'research')));

// ─── Register all routes ───────────────────────────────────────────────────
// ─── Project & Build Status Helpers ────────────────────────────────────────

function safeProjectName(name) {
  const safe = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!safe) throw new Error('Invalid project name');
  return safe;
}

function getProjectsDir() {
  return path.join(__dirname, 'projects');
}

function getProjectPath(name) {
  const safe = safeProjectName(name);
  const projectPath = path.join(getProjectsDir(), safe);
  const root = getProjectsDir();
  if (!projectPath.startsWith(root)) throw new Error('Invalid project path');
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) throw new Error(`Project not found: ${safe}`);
  return { safe, projectPath };
}

function readTextIfExists(filePath, maxChars = 12000) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').slice(0, maxChars);
}

function detectProjectTypeFromFolder(projectPath, packageJson = null) {
  if (packageJson?.dependencies?.next || fs.existsSync(path.join(projectPath, 'app'))) return 'app';
  if (fs.existsSync(path.join(projectPath, 'index.html'))) return 'site';
  return 'app';
}

function summarisePackage(packageJson) {
  if (!packageJson) return 'No package.json found.';
  const deps = Object.keys(packageJson.dependencies || {}).slice(0, 18);
  const devDeps = Object.keys(packageJson.devDependencies || {}).slice(0, 12);
  return [
    `Package name: ${packageJson.name || 'unknown'}`,
    `Scripts: ${Object.keys(packageJson.scripts || {}).join(', ') || 'none'}`,
    `Dependencies: ${deps.join(', ') || 'none'}`,
    `Dev dependencies: ${devDeps.join(', ') || 'none'}`,
  ].join('\n');
}

function buildProjectInventory(projectPath) {
  const ignore = new Set(['node_modules', '.next', 'dist', 'build', '.git']);
  const entries = [];
  function walk(dir, depth = 0) {
    if (depth > 2 || entries.length > 80) return;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignore.has(item.name) || item.name.startsWith('.env')) continue;
      const rel = path.relative(projectPath, path.join(dir, item.name));
      entries.push(`${item.isDirectory() ? 'd' : 'f'} ${rel}`);
      if (item.isDirectory()) walk(path.join(dir, item.name), depth + 1);
    }
  }
  walk(projectPath);
  return entries.join('\n');
}

function createBlueprintFromProjectFolder(projectPath, name, packageJson) {
  const blueprint = readTextIfExists(path.join(projectPath, 'blueprint.md'));
  if (blueprint.trim()) return { blueprint, source: 'blueprint.md' };

  const readme = readTextIfExists(path.join(projectPath, 'README.md'), 6000);
  const claude = readTextIfExists(path.join(projectPath, 'CLAUDE.md'), 2000);
  const packageSummary = summarisePackage(packageJson);
  const inventory = buildProjectInventory(projectPath);

  return {
    source: 'project-folder-reconstruction',
    blueprint: [
      `# Project Blueprint`,
      ``,
      `## Imported Project`,
      `- Project folder: ${name}`,
      `- Source: reconstructed from existing project files because no blueprint.md was present.`,
      ``,
      `## README Extract`,
      readme || 'No README.md found.',
      ``,
      `## Package / Stack Signals`,
      '```text',
      packageSummary,
      '```',
      ``,
      claude ? `## Agent Notes\n${claude}\n` : '',
      `## File Inventory`,
      '```text',
      inventory || 'No readable project files found.',
      '```',
    ].filter(Boolean).join('\n'),
  };
}

function listImportableProjects() {
  const projectsDir = getProjectsDir();
  if (!fs.existsSync(projectsDir)) return [];

  return fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const projectPath = path.join(projectsDir, entry.name);
      const packagePath = path.join(projectPath, 'package.json');
      let packageJson = null;
      if (fs.existsSync(packagePath)) {
        try { packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8')); } catch {}
      }
      const { blueprint, source } = createBlueprintFromProjectFolder(projectPath, entry.name, packageJson);
      const existing = db.getDraftByProjectName(entry.name);
      return {
        name: entry.name,
        path: projectPath,
        projectType: detectProjectTypeFromFolder(projectPath, packageJson),
        packageName: packageJson?.name || entry.name,
        source,
        hasBlueprint: fs.existsSync(path.join(projectPath, 'blueprint.md')),
        alreadyImported: Boolean(existing),
        existingDraftId: existing?.id || null,
        blueprint,
      };
    })
    .filter(project => project.blueprint && project.blueprint.trim());
}

function readTail(filePath, maxChars = 6000) {
  if (!fs.existsSync(filePath)) return '';
  const stat = fs.statSync(filePath);
  const start = Math.max(0, stat.size - maxChars);
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    return buffer.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function getProcessLines() {
  try {
    return execFileSync('ps', ['-axo', 'pid,ppid,stat,etime,command'], { encoding: 'utf8', timeout: 2000 }).split('\n');
  } catch {
    return [];
  }
}

function getRunningProcessForProject(projectPath, processLines = getProcessLines()) {
  return processLines.find(line => line.includes(projectPath) && /(opencode|npm run dev|next dev|vite|astro)/i.test(line)) || '';
}

function classifyProjectStatus({ projectPath, hasPackage, hasLog, logTail, runningLine }) {
  if (runningLine) return 'running';
  const tail = String(logTail || '').toLowerCase();
  if (/permission|external_directory|denied|failed|error|traceback|exception|cancelled|aborted/.test(tail)) return 'stalled';
  if (/build (?:complete|completed|finished|successful)|implementation (?:complete|completed)|project (?:complete|completed)|done(?:[.!]|\\s*$)|successfully (?:built|created|implemented)|all (?:set|done)|ready for review|handoff complete|everything is documented in the `?readme/i.test(tail)) return 'completed';
  if (/project scaffold(?:ed| is built)|here'?s what was built/i.test(tail)) return 'completed';
  if (/next steps|todo|remaining|manual|configure|migration|supabase|prisma|env|needs/.test(tail)) return 'needs_review';
  if (hasPackage && (fs.existsSync(path.join(projectPath, 'README.md')) || fs.existsSync(path.join(projectPath, 'app')) || fs.existsSync(path.join(projectPath, 'src')))) return 'needs_review';
  if (hasLog) return 'unknown';
  return hasPackage ? 'needs_review' : 'unknown';
}

function getBuildStatus() {
  const projectsDir = getProjectsDir();
  if (!fs.existsSync(projectsDir)) return { projects: [], summary: { tracked: 0, running: 0, stalled: 0, failed: 0, needs_review: 0, completed: 0, unknown: 0 } };
  const overrides = new Map(db.getProjectStatusOverrides().map(row => [row.project_name, row]));
  const processLines = getProcessLines();
  const projects = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const projectPath = path.join(projectsDir, entry.name);
      const logPaths = ['opencode-handoff.log', 'opencode-resume.log'].map(file => path.join(projectPath, file));
      const newestLog = logPaths
        .filter(file => fs.existsSync(file))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
      const hasPackage = fs.existsSync(path.join(projectPath, 'package.json'));
      const hasBlueprint = fs.existsSync(path.join(projectPath, 'blueprint.md'));
      const logTail = newestLog ? readTail(newestLog, 3500) : '';
      const runningLine = getRunningProcessForProject(projectPath, processLines);
      const autoStatus = classifyProjectStatus({ projectPath, hasPackage, hasLog: Boolean(newestLog), logTail, runningLine });
      const override = overrides.get(entry.name);
      const status = override?.status || autoStatus;
      return {
        name: entry.name,
        path: projectPath,
        status,
        autoStatus,
        manualStatus: override?.status || null,
        statusNote: override?.note || null,
        statusUpdatedAt: override?.updated_at || null,
        hasPackage,
        hasBlueprint,
        hasLog: Boolean(newestLog),
        logPath: newestLog,
        logTail,
        running: Boolean(runningLine),
        runningProcess: runningLine.trim(),
        updatedAt: newestLog ? fs.statSync(newestLog).mtime.toISOString() : fs.statSync(projectPath).mtime.toISOString(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const summary = { tracked: projects.length, running: 0, stalled: 0, failed: 0, needs_review: 0, completed: 0, unknown: 0 };
  for (const project of projects) {
    summary[project.status] = (summary[project.status] || 0) + 1;
  }
  return { projects, summary };
}

function buildResumePrompt(projectName) {
  return [
    `Continue the stalled build for ${projectName}.`,
    'Read blueprint.md, README.md, package.json, and any opencode logs first.',
    'Finish the most useful first-pass implementation without requiring real secrets.',
    'If credentials are needed, update .env.example and document exact setup steps.',
    'Prioritise getting the app scaffold runnable, then write a concise completion report.'
  ].join(' ');
}

function buildOpencodeArgs(prompt, projectPath) {
  return ['--model', 'opencode-go/deepseek-v4-flash', 'run', prompt, '--dir', projectPath];
}

function commandPreview(command, args) {
  return [command, ...args.map(arg => /\s/.test(arg) ? JSON.stringify(arg) : arg)].join(' ');
}

const deps = {
  db,
  TEMPLATES,
  DESIGN_SYSTEMS,
  workspace,
  designSystemCache,
  fetchDesignSystem,
  getSystemPrompt,
  getTemplate,
  formatTemplateForPrompt,
  ensureDesignSystem,
  CLARIFY_SYSTEM_PROMPT,
  PROTOTYPE_SYSTEM_PROMPT,
  CLARIFY_NUM_PREDICT,
  BLUEPRINT_NUM_PREDICT,
  OLLAMA_BASE_URL,
  OLLAMA_TAGS_URL,
  CLOUD_TIMEOUT_MS,
  activeBuildControllers,
  buildSessions,
  safeProjectName,
  getProjectPath,
  getProjectsDir,
  buildResumePrompt,
  buildOpencodeArgs,
  commandPreview,
  listImportableProjects,
  getBuildStatus,
  callOllamaModel,
  callCloudModel,
  getCloudModelName,
  extractJsonObject,
  normaliseClarifyResult,
  scrapeURLFast,
  scrapeRenderedURL,
  formatResearchForPrompt,
  inferProviderFromModel,
  CLOUD_MODELS,
  rootDir: __dirname,
  PACKAGE_VERSION,
};

registerAllRoutes(app, deps);

// ─── Start server ──────────────────────────────────────────────────────────
(async () => {
  try {
    await db.init();
    app.listen(PORT, () => {
      console.log(`\n🔥 Cauldron OS v0.260 — Witch Daddy Labs (Refactor & Polish Sprint 5)`);
      console.log(`   Merged features from public open-source + private advanced builds`);
      console.log(`   Master Brain upgrades loaded:`);
      console.log(`   • Impeccable Taste (Grendel)`);
      console.log(`   • Design Reference Selector (Camillo & Grendel)`);
      console.log(`   • URL Research Sweep (Grendel)`);
      console.log(`   • Annoying PM Mode / Interrogate Idea`);
      console.log(`   • XML Tool Agent System (agent-loop, tools, workspace)`);
      console.log(`   • Build Pipeline (start / generate / refine / stop)`);
      console.log(`   • Research History & Project Status Records`);
      console.log(`   • Scaffold Templates & OpenCode Handoff`);
      console.log(`   Server running at http://localhost:${PORT}`);
      console.log(`   Data directory: ${db.paths.DATA_DIR}\n`);
    });
  } catch (err) {
    console.error('[Cauldron] Failed to initialise database:', err);
    process.exit(1);
  }
})();
