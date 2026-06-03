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
assert.match(html, /Critique this prototype/, 'Prototype critique textarea should exist');
assert.match(html, /Prototype iterations/, 'Prototype iteration timeline should exist');
assert.match(html, /Apply critique/, 'Prototype critique submit button should exist');
assert.match(html, /Keyboard shortcuts/, 'Keyboard shortcuts should be discoverable');
assert.match(html, /Test connection/, 'API key connection test should exist');
assert.match(html, /pipeline-progress-track/, 'Pipeline progress bar should exist');
assert.match(html, /pipelineEmptyMessage/, 'Pipeline empty log message should be bound');
assert.match(html, /stageProgressLabel\(stage\)/, 'Stage tabs should expose progress labels');
assert.match(html, /dismissToast\(toast\.id\)/, 'Toasts should be dismissible');
assert.match(html, /toast\.type === 'error' \? 'alert' : 'status'/, 'Toast roles should be accessible');
assert.match(html, /pipelineView === 'preview' && previewMode === 'blueprint' && blueprint/, 'Blueprint preview should be gated to preview mode');
assert.match(html, /stageModels/, 'Stage model routing should be configured');
assert.match(html, /Brain dump →/, 'Pipeline subtitle should reference brain dump');
assert.match(html, /selectedBuildAgentId/, 'Build agent selection state should be wired');

const appJs = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'scripts', 'app.js'), 'utf8');
assert.match(appJs, /\/api\/build-agents/, 'Build agent detection API should be called');
assert.match(appJs, /\/api\/build-agents\/run/, 'Build agent run API should be called');
assert.match(appJs, /submitCritique/, 'Critique submit handler should be wired');
assert.match(appJs, /prototypeIterations/, 'Prototype iteration state should be wired');
assert.match(appJs, /testApiKey/, 'API key test handler should be wired');
assert.match(appJs, /handleShortcut/, 'Keyboard shortcut handler should be wired');
assert.match(appJs, /pipelineProgress/, 'Pipeline progress state should be wired');
assert.match(appJs, /loadRecentDraft/, 'Latest draft empty-state action should fetch full draft');
assert.match(appJs, /previousStep >= 0/, 'Pipeline entries should replace same-step rows');
assert.match(appJs, /this\.toasts = \[\.\.\.this\.toasts/, 'Toast stack should be capped through reassignment');
assert.match(appJs, /data\.providers \|\| data/, 'Cloud model response should normalize providers');

console.log('Frontend static smoke tests passed');
