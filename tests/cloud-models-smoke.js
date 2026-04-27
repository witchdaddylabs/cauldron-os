const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-cloud-models-'));
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

(async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(PORT), CAULDRON_DATA_DIR: tempDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', d => output += d.toString());
  child.stderr.on('data', d => output += d.toString());

  try {
    await waitForHealth();

    const r = await request('/api/cloud-models');
    assert.equal(r.res.status, 200);
    assert.equal(r.body.success, true);
    assert.equal(r.body.providers.gemini.defaultModel, 'gemini-3.1-flash-lite');
    assert.deepEqual(r.body.providers.gemini.models, [
      'gemini-3.1-flash-lite',
      'gemini-3.1-pro-preview',
    ]);
    assert.doesNotMatch(JSON.stringify(r.body), /gemini-2\.5/i);

    console.log('Cloud model routing smoke tests passed');
  } catch (err) {
    console.error(output);
    throw err;
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})();
