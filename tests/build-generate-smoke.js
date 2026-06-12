const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');

const repoRoot = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-build-generate-smoke-'));
const PORT = 3420;
const OLLAMA_PORT = 3421;

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
  return res;
}

function createFakeOllamaServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch {}
      requests.push(body);

      if (req.url === '/api/chat') {
        // Stream a single NDJSON chunk that finishes immediately with no actions.
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        res.write(JSON.stringify({ message: { content: 'Done.' }, done: false }) + '\n');
        res.write(JSON.stringify({ message: { content: '' }, done: true }) + '\n');
        res.end();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response: 'ok' }));
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
  let stderr = '';
  child.stdout.on('data', d => output += d.toString());
  child.stderr.on('data', d => { output += d.toString(); stderr += d.toString(); });

  try {
    await waitForHealth();

    let r = await request('/api/build/start', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'hi',
        model: 'llama3.2',
        sessionId: 'build-generate-smoke',
        projectType: 'site',
      }),
    });
    assert.equal(r.status, 200);
    const startBody = await r.json();
    assert.equal(startBody.success, true);

    r = await request('/api/build/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'hi',
        model: 'llama3.2',
        sessionId: 'build-generate-smoke',
        systemPrompt: 'test',
      }),
    });
    assert.equal(r.status, 200);
    const text = await r.text();
    assert.match(text, /data:/);

    // The original bug threw ReferenceError because generateWithTools /
    // buildSystemPrompt / _runCloudAgentBuild were not wired into deps.
    assert.doesNotMatch(stderr, /generateWithTools is not defined/);
    assert.doesNotMatch(stderr, /_runCloudAgentBuild is not defined/);
    assert.doesNotMatch(stderr, /buildSystemPrompt is not defined/);
    assert.doesNotMatch(stderr, /ReferenceError/);

    console.log('Build generate smoke test passed');
  } catch (err) {
    console.error(output);
    throw err;
  } finally {
    child.kill('SIGTERM');
    fakeOllama.server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})();
