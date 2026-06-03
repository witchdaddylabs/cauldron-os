const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'index.html'), 'utf8');

// New unified frontend structure
assert.match(html, /x-data="cauldronApp/, 'AlpineJS app should be wired');
assert.match(html, /Interrogate brief/, 'Interrogate button should exist');
assert.match(html, /Blueprint next/, 'Blueprint button should exist');
assert.match(html, /Build this/, 'Build stage button should exist');
assert.match(html, /Build Agents/, 'Build agent settings tab should exist');
assert.match(html, /Refresh build agents/, 'Build agent refresh button should exist');
assert.match(html, /Create handoff package/, 'Handoff package button should exist');
assert.match(html, /stageModels/, 'Stage model routing should be configured');
assert.match(html, /Brain dump →/, 'Pipeline subtitle should reference brain dump');
assert.match(html, /selectedBuildAgentId/, 'Build agent selection state should be wired');

const appJs = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'scripts', 'app.js'), 'utf8');
assert.match(appJs, /\/api\/build-agents/, 'Build agent detection API should be called');
assert.match(appJs, /\/api\/build-agents\/run/, 'Build agent run API should be called');

console.log('Frontend static smoke tests passed');
