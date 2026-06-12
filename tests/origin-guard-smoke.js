const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-origin-guard-smoke-'));
const PORT = 3401;

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

async function buildStart(sessionId, headers = {}) {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/build/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      prompt: 'Origin guard smoke test',
      model: 'llama3.2',
      sessionId,
      projectType: 'site',
    }),
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { res, body };
}

(async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
      CAULDRON_DATA_DIR: tempDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', d => output += d.toString());
  child.stderr.on('data', d => output += d.toString());

  try {
    await waitForHealth();

    // Same-origin request is allowed.
    let { res, body } = await buildStart('origin-guard-same', { Origin: `http://localhost:${PORT}` });
    assert.equal(res.status, 200, 'same-origin request should be allowed');
    assert.equal(body.success, true, 'same-origin request should succeed');

    // Foreign-origin request is blocked.
    ({ res, body } = await buildStart('origin-guard-foreign', { Origin: 'https://evil.example' }));
    assert.equal(res.status, 403, 'foreign-origin request should be blocked');
    assert.equal(body.error, 'Cross-origin request blocked');

    // No-Origin request (same-origin navigations, server-to-server) is allowed.
    ({ res, body } = await buildStart('origin-guard-none'));
    assert.equal(res.status, 200, 'no-origin request should be allowed');
    assert.equal(body.success, true, 'no-origin request should succeed');

    console.log('Origin guard smoke tests passed');
  } catch (err) {
    console.error(output);
    throw err;
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})();
