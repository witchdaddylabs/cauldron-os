#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  extractDesignSystemName,
  normaliseSystemId,
} = require('../lib/design-system-catalog');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_REPO = 'nexu-io/open-design';
const SOURCE_REF = process.env.OPEN_DESIGN_REF || 'main';
const SOURCE_TREE_URL = `https://api.github.com/repos/${SOURCE_REPO}/git/trees/${SOURCE_REF}?recursive=1`;
const RAW_BASE = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_REF}`;
const OUT_DIR = path.join(ROOT, 'design-systems');
const MIN_EXPECTED = Number(process.env.CAULDRON_MIN_DESIGN_SYSTEMS || 150);

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.text();
}

function extractColors(content) {
  return [...new Set(String(content).match(/#[0-9a-fA-F]{3,8}\b/g) || [])].slice(0, 12);
}

function extractFonts(content) {
  const fonts = new Set();
  for (const match of String(content).matchAll(/(?:font|typeface|family|primary font|heading font)[^:\n]*:\s*([^\n]+)/gi)) {
    const cleaned = match[1]
      .replace(/[`*_]/g, '')
      .split(/[;,]/)
      .map(item => item.trim())
      .filter(item => item && item.length <= 80);
    cleaned.forEach(item => fonts.add(item));
  }
  return [...fonts].slice(0, 8);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const tree = JSON.parse(await fetchText(SOURCE_TREE_URL));
  const designFiles = (tree.tree || [])
    .filter(entry => /^design-systems\/[^/]+\/DESIGN\.md$/.test(entry.path))
    .sort((a, b) => a.path.localeCompare(b.path));

  if (designFiles.length < MIN_EXPECTED) {
    throw new Error(`Expected at least ${MIN_EXPECTED} DESIGN.md files from ${SOURCE_REPO}, found ${designFiles.length}`);
  }

  const systems = [];

  for (const entry of designFiles) {
    const slug = entry.path.split('/')[1];
    const id = normaliseSystemId(slug);
    const content = await fetchText(`${RAW_BASE}/${entry.path}`);
    const systemDir = path.join(OUT_DIR, id);
    fs.mkdirSync(systemDir, { recursive: true });
    fs.writeFileSync(path.join(systemDir, 'DESIGN.md'), content, 'utf8');

    systems.push({
      id,
      name: extractDesignSystemName(content, id),
      path: `design-systems/${id}/DESIGN.md`,
      source: 'open-design',
      origin: `https://github.com/${SOURCE_REPO}/tree/${SOURCE_REF}/design-systems/${slug}`,
      sha: entry.sha,
      colors: extractColors(content),
      fonts: extractFonts(content),
    });
  }

  const catalog = {
    schemaVersion: 1,
    source: `https://github.com/${SOURCE_REPO}`,
    sourceRef: SOURCE_REF,
    importedAt: new Date().toISOString(),
    count: systems.length,
    systems,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'LICENSE-OPEN-DESIGN.txt'), await fetchText(`${RAW_BASE}/LICENSE`), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'NOTICE.md'), [
    '# Design Systems Notice',
    '',
    `The DESIGN.md files in this directory were imported from https://github.com/${SOURCE_REPO}.`,
    '',
    'Open Design is licensed under the Apache License 2.0. A copy is included at `design-systems/LICENSE-OPEN-DESIGN.txt`. Keep this notice with the imported catalog and refresh with `node scripts/import-design-systems.js` when updating the catalog.',
    '',
    `Imported source ref: ${SOURCE_REF}`,
    `Imported systems: ${systems.length}`,
  ].join('\n') + '\n', 'utf8');

  console.log(`Imported ${systems.length} design systems from ${SOURCE_REPO}@${SOURCE_REF}`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
