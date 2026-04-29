const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');

const repoRoot = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-smoke-'));
const PORT = 3399;
const OLLAMA_PORT = 3419;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { res, body };
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
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      requests.push(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        response: `Sure, here is the JSON:\n{\n  "questions": [\n    { "id": "target-users", "label": "Who is this actually for?", "why": "Clarifies audience and scope." },\n    { "label": "What is the one workflow version one must nail?", "why": "Prevents feature soup." }\n  ],\n  "assumptions": ["This is likely a web app."],\n  "redFlags": ["Payments are mentioned but trust is not."],\n  "suggestedScope": ["Start with one user role."]\n}\nNo really, that's it.`
      }));
    });
  });

  return new Promise(resolve => {
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

  let output = '';
  child.stdout.on('data', d => output += d.toString());
  child.stderr.on('data', d => output += d.toString());

  try {
    await waitForHealth();

    let r = await request('/api/drafts');
    assert.equal(r.res.status, 200);
    assert.deepEqual(r.body.drafts, []);

    r = await request('/api/drafts', {
      method: 'POST',
      body: JSON.stringify({
        projectName: 'Smoke Test App',
        brainDump: 'A tiny app for smoke testing',
        blueprint: '# Project Blueprint\n\n## PRD\n- Smoke test',
        designReference: 'none',
        generationMode: 'test',
        modelUsed: 'smoke-model',
      }),
    });
    assert.equal(r.res.status, 200);
    assert.equal(r.body.success, true);
    assert.ok(Number.isInteger(r.body.draftId));
    const id = r.body.draftId;

    r = await request(`/api/drafts/${id}`);
    assert.equal(r.res.status, 200);
    assert.equal(r.body.success, true);
    assert.equal(r.body.draft.project_name, 'Smoke Test App');
    assert.match(r.body.draft.blueprint, /Project Blueprint/);

    r = await request(`/api/drafts/${id}/export.md`);
    assert.equal(r.res.status, 200);
    assert.match(r.body.raw || '', /Project Blueprint/);

    r = await request('/api/history');
    assert.equal(r.res.status, 200);
    assert.equal(r.body.success, true);
    assert.ok(r.body.sessions.length >= 1);

    r = await request('/api/stats');
    assert.equal(r.res.status, 200);
    assert.equal(r.body.stats.totalDrafts, 1);

    r = await request('/api/clarify', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'A tiny app for neighbours to share tools and avoid buying more landfill.',
        model: 'qwen3.5:9b',
        projectType: 'app',
      }),
    });
    assert.equal(r.res.status, 200);
    assert.equal(r.body.success, true);
    assert.equal(r.body.questions.length, 2);
    assert.equal(r.body.questions[0].id, 'target-users');
    assert.equal(r.body.questions[1].id, 'question-2');
    assert.match(r.body.questions[0].label, /Who is this actually for/);
    assert.deepEqual(r.body.assumptions, ['This is likely a web app.']);
    assert.deepEqual(r.body.redFlags, ['Payments are mentioned but trust is not.']);
    assert.deepEqual(r.body.suggestedScope, ['Start with one user role.']);
    assert.equal(fakeOllama.requests.at(-1).model, 'qwen3.5:9b');
    assert.match(fakeOllama.requests.at(-1).system, /blunt senior product manager/);
    assert.match(fakeOllama.requests.at(-1).prompt, /Ask the project-manager questions/);

    r = await request('/api/clarify', {
      method: 'POST',
      body: JSON.stringify({ prompt: '   ', model: 'qwen3.5:9b' }),
    });
    assert.equal(r.res.status, 400);
    assert.match(r.body.error, /Prompt required/);

    r = await request(`/api/drafts/${id}`, { method: 'DELETE' });
    assert.equal(r.res.status, 200);
    assert.equal(r.body.success, true);

    r = await request(`/api/drafts/${id}`);
    assert.equal(r.res.status, 404);

    console.log('Cauldron smoke tests passed');
  } catch (err) {
    console.error(output);
    throw err;
  } finally {
    child.kill('SIGTERM');
    fakeOllama.server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})();
