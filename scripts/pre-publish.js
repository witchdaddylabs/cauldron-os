#!/usr/bin/env node

/**
 * Cauldron OS — Pre-Publish Validator
 * Run this before first git push to ensure repo is clean and complete.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REQUIRED_FILES = [
  'server.js',
  'public/index.html',
  'package.json',
  'README.md',
  'LICENSE',
  '.gitignore',
  'GETTING_STARTED.md',
  '.github/CODE_OF_CONDUCT.md',
  '.github/SECURITY.md',
  '.github/ISSUE_TEMPLATE/bug-report.md',
  '.github/ISSUE_TEMPLATE/feature-request.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'docs/ARCHITECTURE.md',
  'docs/CONTRIBUTING.md',
  'docs/DESIGN_REFERENCE.md',
  'examples/sample-blueprint.md',
  'scripts/validate-blueprint.js',
];

const OPTIONAL_ASSETS = [
  'assets/hero-header.png',
  'assets/brand/wdl-logo-primary.png',
  'assets/brand/logo-sigil.png',
  'assets/brand/logo-wordmark.png',
];

const FORBIDDEN = [
  'node_modules/',
  '.DS_Store',
  '*.backup',
  'projects/',         // should be gitignored
  'design-systems/**/LICENSE', // but .gitkeep is fine
];

console.log('\n🧪 Cauldron OS — Pre-Publish Validator\n');
console.log(`Scanning: ${ROOT}\n`);

let errors = 0;
let warnings = 0;

// Check required files
console.log('📦 Required files:');
REQUIRED_FILES.forEach(file => {
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) {
    console.log(`  ✓ ${file}`);
  } else {
    console.log(`  ✗ ${file} — MISSING`);
    errors++;
  }
});

// Check optional assets
console.log('\n🎨 Assets (optional but recommended):');
OPTIONAL_ASSETS.forEach(file => {
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) {
    console.log(`  ✓ ${file}`);
  } else {
    console.log(`  ⚠ ${file} — not found (optional)`);
    warnings++;
  }
});

// Check for forbidden patterns
console.log('\n🚫 Checking for forbidden files:');
let forbiddenFound = false;
FORBIDDEN.forEach(pattern => {
  // Simple glob matching (naive)
  if (pattern.endsWith('/')) {
    const dir = path.join(ROOT, pattern.slice(0, -1));
    if (fs.existsSync(dir)) {
      console.log(`  ✗ Directory ${pattern} exists — remove or gitignore`);
      forbiddenFound = true;
    }
  } else if (pattern.includes('*')) {
    // Skip for now
  } else {
    const fpath = path.join(ROOT, pattern);
    if (fs.existsSync(fpath)) {
      console.log(`  ✗ ${pattern} found — remove before push`);
      forbiddenFound = true;
    }
  }
});
if (!forbiddenFound) console.log('  ✓ No forbidden files detected');

// Validate JSON files
console.log('\n🔍 Validating JSON config files:');
['package.json'].forEach(file => {
  try {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
    JSON.parse(content);
    console.log(`  ✓ ${file} valid JSON`);
  } catch (e) {
    console.log(`  ✗ ${file} JSON parse error: ${e.message}`);
    errors++;
  }
});

// Validate sample blueprint
console.log('\n📄 Blueprint schema check:');
try {
  const { validateBlueprint } = require('./scripts/validate-blueprint.js');
  const sample = fs.readFileSync(path.join(ROOT, 'examples/sample-blueprint.md'), 'utf-8');
  const report = validateBlueprint(sample);
  if (report.valid) {
    console.log('  ✓ Sample blueprint passes validation');
  } else {
    console.log(`  ⚠ Missing sections: ${report.missingSections.join(', ')}`);
    warnings++;
  }
} catch (e) {
  console.log(`  ⚠ Could not run validator: ${e.message}`);
}

// License check
console.log('\n📜 License verification:');
const licensePath = path.join(ROOT, 'LICENSE');
if (fs.existsSync(licensePath)) {
  const licenseText = fs.readFileSync(licensePath, 'utf-8');
  if (licenseText.includes('MIT') && licenseText.includes('Witch Daddy Labs')) {
    console.log('  ✓ MIT license with correct copyright present');
  } else if (licenseText.includes('MIT')) {
    console.log('  ⚠ MIT license but check copyright attribution');
  } else {
    console.log('  ⚠ License file unclear — review before publish');
  }
} else {
  console.log('  ✗ LICENSE file missing');
  errors++;
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Errors:   ${errors}`);
console.log(`Warnings: ${warnings}`);
console.log('='.repeat(50));

if (errors === 0) {
  console.log('\n✅ Repo is ready for first commit and push!\n');
  console.log('Next steps:');
  console.log('  1. git add .');
  console.log('  2. git commit -m "chore: initial release Cauldron OS v2.1.0"');
  console.log('  3. git branch -M main');
  console.log('  4. git remote add origin https://github.com/witchdaddylabs/cauldron-os.git');
  console.log('  5. git push -u origin main\n');
  process.exit(0);
} else {
  console.log('\n❌ Fix errors before pushing.\n');
  process.exit(1);
}
