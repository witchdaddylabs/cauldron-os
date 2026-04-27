const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-smoke-'));
const PORT = 3399;

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
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})();
