const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { stopProcess } = require('./_process-cleanup');

const repoRoot = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-critique-'));
const PORT = 3422;
const OLLAMA_PORT = 3423;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (res.ok) return;
    } catch {}
    await wait(250);
  }
  throw new Error('Server did not become healthy');
}

async function request(pathname, options = {}) {
  const res = await fetch(`http://127.0.0.1:${PORT}${pathname}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { res, body, text };
}

function parseNdjson(text) {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function createFakeOllamaServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/api/generate') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      requests.push(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          response:
            '```html\n<main><h1>Critiqued Prototype</h1><button>Primary action</button></main>\n```',
        })
      );
    });
  });

  return new Promise((resolve) => {
    server.listen(OLLAMA_PORT, '127.0.0.1', () => resolve({ server, requests }));
  });
}

(async () => {
  const fakeOllama = await createFakeOllamaServer();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
      CAULDRON_DATA_DIR: tempDir,
      OLLAMA_BASE_URL: `http://127.0.0.1:${OLLAMA_PORT}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});

  try {
    await waitForHealth();

    const critique = await request('/api/generate-prototype', {
      method: 'POST',
      body: JSON.stringify({
        blueprint: '# Project Blueprint\n\nBuild a clean product dashboard.',
        previousPrototypeHtml: '<main><h1>Old Prototype</h1></main>',
        critique: 'Make the header clearer and the call to action more obvious.',
        model: 'qwen3.5:9b',
        projectType: 'site',
      }),
    });

    assert.equal(critique.res.status, 200);
    const events = parseNdjson(critique.text);
    assert.ok(
      events.some(
        (event) => event.type === 'progress' && /Scoring output quality/.test(event.label)
      ),
      'quality scoring progress should be emitted'
    );
    const prototypeEvent = events.find((event) => event.type === 'prototype');
    assert(prototypeEvent, 'prototype event should be emitted');
    assert.equal(prototypeEvent.steps, 3);
    assert.match(prototypeEvent.data.html, /Critiqued Prototype/);
    assert.equal(
      prototypeEvent.data.critique,
      'Make the header clearer and the call to action more obvious.'
    );
    assert.ok(prototypeEvent.data.quality, 'prototype event should include a quality score');
    assert.match(prototypeEvent.data.quality.grade, /^[ABCD]$/);
    assert.equal(prototypeEvent.data.quality.categories.length, 5);
    assert.equal(prototypeEvent.data.quality.showSuggestions, true);
    assert.ok(prototypeEvent.data.quality.suggestions.length >= 1);

    assert.equal(fakeOllama.requests.length, 1);
    assert.match(fakeOllama.requests[0].prompt, /Previous Prototype HTML/);
    assert.match(fakeOllama.requests[0].prompt, /Old Prototype/);
    assert.match(fakeOllama.requests[0].prompt, /Requested Critique/);
    assert.match(fakeOllama.requests[0].prompt, /Make the header clearer/);

    const save = await request('/api/drafts', {
      method: 'POST',
      body: JSON.stringify({
        projectName: 'Critique Roundtrip',
        brainDump: 'A dashboard',
        blueprint: '# Project Blueprint\n\nDashboard spec',
        designReference: 'none',
        generationMode: 'critique-smoke',
        modelUsed: 'qwen3.5:9b',
        prototypeHtml: '<main>Current prototype</main>',
        prototypeIterations: [
          {
            id: 'iteration-1',
            version: 1,
            critique: 'Initial prototype',
            summary: 'Baseline snapshot',
            html: '<main>Current prototype</main>',
            previousHtml: '',
            createdAt: '2026-06-03T00:00:00.000Z',
          },
        ],
      }),
    });
    assert.equal(save.res.status, 200);
    assert.equal(save.body.success, true);

    const draft = await request(`/api/drafts/${save.body.draftId}`);
    assert.equal(draft.res.status, 200);
    assert.equal(draft.body.draft.prototype_html, '<main>Current prototype</main>');
    assert.equal(draft.body.draft.prototype_iterations.length, 1);
    assert.equal(draft.body.draft.prototype_iterations[0].critique, 'Initial prototype');

    console.log('Critique loop smoke tests passed');
  } finally {
    await stopProcess(child);
    fakeOllama.server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
