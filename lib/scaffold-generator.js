const fs = require('fs');
const path = require('path');

function writeFile(projectPath, relativePath, content) {
  const filePath = path.join(projectPath, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return relativePath;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtmlDocument(html = '') {
  const bodyMatch = String(html || '').match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (bodyMatch?.[1] || html || '').trim();
}

function titleCase(value = '') {
  return String(value || 'Cauldron Project')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function defaultHtmlBody({ projectName, blueprint }) {
  const excerpt = String(blueprint || '').replace(/[#*_`>-]/g, '').trim().slice(0, 420)
    || 'Generated from a Cauldron OS blueprint. Replace this starter content with the production implementation.';
  return `<main class="shell">
  <section class="hero">
    <p class="eyebrow">Cauldron scaffold</p>
    <h1>${escapeHtml(projectName)}</h1>
    <p>${escapeHtml(excerpt)}</p>
    <a href="#blueprint">Read the blueprint</a>
  </section>
  <section id="blueprint" class="panel">
    <h2>Build direction</h2>
    <p>Use <code>blueprint.md</code>, <code>design-system.md</code>, and <code>agent-prompt.md</code> as the source of truth.</p>
  </section>
</main>`;
}

function baseStyles() {
  return `:root {
  color-scheme: dark;
  --bg: #0d0f14;
  --panel: #171b23;
  --text: #f5f0e8;
  --muted: #aab0a6;
  --accent: #c1ff00;
  --line: rgba(255,255,255,0.12);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  color: var(--text);
  background: radial-gradient(circle at 20% 0%, rgba(193,255,0,0.12), transparent 30%), var(--bg);
}
a { color: var(--accent); }
.shell {
  width: min(1120px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 72px 0;
}
.hero {
  display: grid;
  gap: 18px;
  padding: 48px;
  border: 1px solid var(--line);
  background: linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025));
}
.eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-size: clamp(42px, 8vw, 92px);
  line-height: 0.95;
}
h2 { margin-top: 0; }
p { max-width: 70ch; color: var(--muted); font-size: 18px; line-height: 1.55; }
.panel {
  margin-top: 24px;
  padding: 28px;
  border: 1px solid var(--line);
  background: var(--panel);
}
code { color: var(--accent); }
button, a {
  min-height: 44px;
}
`;
}

function scaffoldStaticHtml(context) {
  const body = stripHtmlDocument(context.prototypeHtml) || defaultHtmlBody(context);
  return [
    writeFile(context.projectPath, 'index.html', `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(context.projectName)}</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
${body}
</body>
</html>
`),
    writeFile(context.projectPath, 'styles.css', baseStyles()),
  ];
}

function scaffoldHtmlAlpine(context) {
  const body = stripHtmlDocument(context.prototypeHtml) || defaultHtmlBody(context);
  return [
    writeFile(context.projectPath, 'index.html', `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(context.projectName)}</title>
  <link rel="stylesheet" href="./styles.css" />
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <script defer src="./app.js"></script>
</head>
<body x-data="cauldronScaffold()">
${body}
</body>
</html>
`),
    writeFile(context.projectPath, 'styles.css', baseStyles()),
    writeFile(context.projectPath, 'app.js', `function cauldronScaffold() {
  return {
    projectName: ${JSON.stringify(context.projectName)},
    generatedAt: ${JSON.stringify(new Date().toISOString())},
  };
}
`),
  ];
}

function scaffoldNextjs(context) {
  const componentName = titleCase(context.projectName);
  const body = escapeHtml(stripHtmlDocument(context.prototypeHtml) || 'Build this page from blueprint.md and design-system.md.');
  return [
    writeFile(context.projectPath, 'package.json', JSON.stringify({
      scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
      dependencies: { '@types/node': 'latest', '@types/react': 'latest', '@types/react-dom': 'latest', next: 'latest', react: 'latest', 'react-dom': 'latest', typescript: 'latest' },
      devDependencies: {},
    }, null, 2) + '\n'),
    writeFile(context.projectPath, 'next.config.mjs', `const nextConfig = {};
export default nextConfig;
`),
    writeFile(context.projectPath, 'tsconfig.json', JSON.stringify({
      compilerOptions: {
        target: 'es5',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
      exclude: ['node_modules'],
    }, null, 2) + '\n'),
    writeFile(context.projectPath, 'next-env.d.ts', '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n'),
    writeFile(context.projectPath, 'app/layout.tsx', `import './globals.css';

export const metadata = {
  title: ${JSON.stringify(context.projectName)},
  description: 'Generated by Cauldron OS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`),
    writeFile(context.projectPath, 'app/page.tsx', `export default function Page() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Cauldron scaffold</p>
        <h1>${componentName}</h1>
        <p>${body}</p>
        <a href="/blueprint.md">Read the blueprint</a>
      </section>
    </main>
  );
}
`),
    writeFile(context.projectPath, 'app/globals.css', baseStyles()),
  ];
}

function scaffoldAstro(context) {
  const body = stripHtmlDocument(context.prototypeHtml) || defaultHtmlBody(context);
  return [
    writeFile(context.projectPath, 'package.json', JSON.stringify({
      scripts: { dev: 'astro dev', build: 'astro build', preview: 'astro preview' },
      dependencies: { astro: 'latest' },
      devDependencies: {},
    }, null, 2) + '\n'),
    writeFile(context.projectPath, 'astro.config.mjs', `import { defineConfig } from 'astro/config';

export default defineConfig({});
`),
    writeFile(context.projectPath, 'src/pages/index.astro', `---
import '../styles/global.css';
const title = ${JSON.stringify(context.projectName)};
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body>
${body.split('\n').map(line => `    ${line}`).join('\n')}
  </body>
</html>
`),
    writeFile(context.projectPath, 'src/styles/global.css', baseStyles()),
  ];
}

const SCAFFOLDERS = {
  'static-html': scaffoldStaticHtml,
  'html-alpine': scaffoldHtmlAlpine,
  nextjs: scaffoldNextjs,
  astro: scaffoldAstro,
};

const SCAFFOLD_METADATA = {
  'static-html': {
    entrypoint: 'index.html',
    packageManager: null,
    commands: {},
    roles: { 'index.html': 'entry', 'styles.css': 'style' },
  },
  'html-alpine': {
    entrypoint: 'index.html',
    packageManager: null,
    commands: {},
    roles: { 'index.html': 'entry', 'styles.css': 'style', 'app.js': 'script' },
  },
  nextjs: {
    entrypoint: 'app/page.tsx',
    packageManager: 'npm',
    commands: { dev: 'npm run dev', build: 'npm run build', start: 'npm run start' },
    roles: {
      'package.json': 'manifest',
      'next.config.mjs': 'config',
      'tsconfig.json': 'config',
      'next-env.d.ts': 'types',
      'app/layout.tsx': 'layout',
      'app/page.tsx': 'entry',
      'app/globals.css': 'style',
    },
  },
  astro: {
    entrypoint: 'src/pages/index.astro',
    packageManager: 'npm',
    commands: { dev: 'npm run dev', build: 'npm run build', preview: 'npm run preview' },
    roles: {
      'package.json': 'manifest',
      'astro.config.mjs': 'config',
      'src/pages/index.astro': 'entry',
      'src/styles/global.css': 'style',
    },
  },
};

function fileMetadata(scaffoldId, relativePath) {
  const role = SCAFFOLD_METADATA[scaffoldId]?.roles?.[relativePath] || 'source';
  return {
    path: relativePath,
    role,
    kind: role === 'manifest' || role === 'config' ? 'config' : 'source',
    generated: true,
  };
}

function createScaffold(context) {
  const requestedId = context.templateId || 'html-alpine';
  const scaffoldId = SCAFFOLDERS[requestedId]
    ? requestedId
    : SCAFFOLDERS[context.projectType]
      ? context.projectType
      : 'html-alpine';
  const scaffold = SCAFFOLDERS[scaffoldId];
  const paths = scaffold(context);
  const metadata = SCAFFOLD_METADATA[scaffoldId] || SCAFFOLD_METADATA['html-alpine'];
  return {
    id: scaffoldId,
    templateId: scaffoldId,
    scaffold: scaffoldId,
    entrypoint: metadata.entrypoint,
    packageManager: metadata.packageManager,
    commands: metadata.commands,
    files: paths.map(file => fileMetadata(scaffoldId, file)),
    paths,
  };
}

module.exports = {
  createScaffold,
  SCAFFOLDERS,
};
