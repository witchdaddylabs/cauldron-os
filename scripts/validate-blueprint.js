#!/usr/bin/env node

/**
 * Cauldron OS — Blueprint JSON Schema Linter
 * Validates that generated blueprints contain required sections
 */

const fs = require('fs');
const path = require('path');

function validateBlueprint(blueprint) {
  const requiredSections = [
    { name: 'Project Blueprint header', pattern: /^# Project Blueprint/i },
    { name: 'PRD section', pattern: /^## PRD/i },
    { name: 'Database Schema or Content Structure', pattern: /(?:## Database Schema|## Content Structure)/i },
    { name: 'Security Posture', pattern: /^## Security Posture/i },
    { name: 'Architecture Notes', pattern: /^## Architecture Notes/i },
    { name: 'HTML preview block', pattern: /```html/i },
  ];

  const results = requiredSections.map(sec => ({
    ...sec,
    present: sec.pattern.test(blueprint)
  }));

  const missing = results.filter(r => !r.present);

  return {
    valid: missing.length === 0,
    results,
    missingCount: missing.length,
    missingSections: missing.map(m => m.name)
  };
}

// CLI
if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: validate-blueprint.js <blueprint.md>');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const report = validateBlueprint(content);

  console.log(`\nBlueprint Validation Report`);
  console.log(`File: ${filePath}`);
  console.log(`Status: ${report.valid ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Missing: ${report.missingCount} section(s)\n`);

  report.results.forEach(r => {
    console.log(`  ${r.present ? '✓' : '✗'} ${r.name}`);
  });

  if (!report.valid) {
    console.log(`\nMissing sections need to be added:\n  - ${report.missingSections.join('\n  - ')}`);
    process.exit(1);
  }
}

module.exports = { validateBlueprint };
