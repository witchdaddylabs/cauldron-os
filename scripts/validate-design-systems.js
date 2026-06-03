#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  normaliseSystemId,
} = require('../lib/design-system-catalog');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'design-systems', 'catalog.json');
const MIN_EXPECTED = Number(process.env.CAULDRON_MIN_DESIGN_SYSTEMS || 150);

function fail(message, errors) {
  errors.push(message);
}

function main() {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(CATALOG_PATH)) {
    fail('Missing design-systems/catalog.json. Run node scripts/import-design-systems.js.', errors);
  }

  const catalog = fs.existsSync(CATALOG_PATH)
    ? JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'))
    : { systems: [] };

  if (!Array.isArray(catalog.systems)) {
    fail('catalog.systems must be an array.', errors);
  }

  if ((catalog.systems || []).length < MIN_EXPECTED) {
    fail(`Expected at least ${MIN_EXPECTED} design systems, found ${(catalog.systems || []).length}.`, errors);
  }

  const seen = new Set();

  for (const system of catalog.systems || []) {
    if (!system.id) fail('Catalog entry missing id.', errors);
    if (!system.name) fail(`Catalog entry ${system.id || '<unknown>'} missing name.`, errors);
    if (!system.path) fail(`Catalog entry ${system.id || '<unknown>'} missing path.`, errors);

    const normalised = normaliseSystemId(system.id);
    if (system.id !== normalised) fail(`Catalog id "${system.id}" should be "${normalised}".`, errors);
    if (seen.has(system.id)) fail(`Duplicate design-system id: ${system.id}`, errors);
    seen.add(system.id);

    const designPath = path.join(ROOT, system.path || '');
    if (!fs.existsSync(designPath)) {
      fail(`Missing DESIGN.md for ${system.id}: ${system.path}`, errors);
      continue;
    }

    const content = fs.readFileSync(designPath, 'utf8');
    if (content.trim().length < 200) fail(`DESIGN.md for ${system.id} is suspiciously short.`, errors);
    if (!/^#|\n##\s+/m.test(content)) warnings.push(`DESIGN.md for ${system.id} has no obvious markdown heading.`);
  }

  if (errors.length) {
    console.error('\nDesign system validation failed:\n');
    errors.forEach(error => console.error(`- ${error}`));
    if (warnings.length) {
      console.error('\nWarnings:');
      warnings.forEach(warning => console.error(`- ${warning}`));
    }
    process.exit(1);
  }

  console.log(`Design system validation passed (${catalog.systems.length} systems).`);
  if (warnings.length) {
    console.log(`Warnings: ${warnings.length}`);
  }
}

main();
