const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'index.html'), 'utf8');

assert.match(html, /id="clarifyBtn"/);
assert.match(html, /Interrogate Idea/);
assert.match(html, /id="clarifyPanel"/);
assert.match(html, /id="clarifyList"/);
assert.match(html, /currentClarification/);
assert.match(html, /clarificationAnswers/);
assert.match(html, /function interrogateIdea/);
assert.match(html, /fetch\('\/api\/clarify'/);
assert.match(html, /function buildClarifiedPrompt/);
assert.match(html, /Clarifying intake/);
assert.match(html, /buildClarifiedPrompt\(prompt\)/);

console.log('Frontend Annoying PM static smoke tests passed');
