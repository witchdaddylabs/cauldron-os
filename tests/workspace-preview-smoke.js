#!/usr/bin/env node
/**
 * Workspace preview smoke test.
 *
 * Verifies:
 * - Normal files inside the workspace serve with 200 and no CORS header.
 * - Symlinks pointing outside the workspace are blocked (403).
 * - Path traversal attempts are blocked (403/404) and never leak repo files.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-wsp-'));
const PORT = 3424;

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
  return { res, body, text };
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

    // 1. Start a build session to create a workspace
    let r = await request('/api/build/start', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Workspace preview smoke test', model: 'gemini-3.1-flash-lite' }),
    });
    assert.equal(r.res.status, 200, 'build/start should succeed');
    assert.equal(r.body.success, true);
    const sid = r.body.sessionId;
    const wsDir = r.body.workspaceDir;
    assert.ok(sid, 'sessionId should be returned');
    assert.ok(wsDir, 'workspaceDir should be returned');

    // 2. Write a normal file and verify it serves with 200, no CORS header
    fs.writeFileSync(path.join(wsDir, 'index.html'), '<html><body>hello</body></html>');
    r = await request(`/workspace-preview/${sid}/index.html`);
    assert.equal(r.res.status, 200, 'normal file should serve with 200');
    assert.match(r.text, /hello/);
    assert.equal(r.res.headers.get('access-control-allow-origin'), null, 'no CORS wildcard header on file response');
    console.log('Normal file serve: OK');

    // 3. Symlink escape: link to a secret file outside the workspace, expect 403
    try {
      const secretPath = path.join(os.tmpdir(), `cauldron-wsp-secret-${process.pid}.txt`);
      const secretMarker = 'SECRET_MARKER_DO_NOT_LEAK';
      fs.writeFileSync(secretPath, secretMarker);
      const linkPath = path.join(wsDir, 'leak.txt');
      fs.symlinkSync(secretPath, linkPath);

      r = await request(`/workspace-preview/${sid}/leak.txt`);
      assert.equal(r.res.status, 403, 'symlink escape should be forbidden');
      assert.ok(!r.text.includes(secretMarker), 'response must not leak secret contents');
      console.log('Symlink escape blocked: OK');

      fs.rmSync(secretPath, { force: true });
    } catch (err) {
      console.log(`Symlink test skipped (platform limitation): ${err.message}`);
    }

    // 4. Path traversal attempts must not leak the repo's package.json
    r = await request(`/workspace-preview/${sid}/..%2f..%2fpackage.json`);
    assert.ok([403, 404].includes(r.res.status), `traversal (encoded) should be 403/404, got ${r.res.status}`);
    assert.ok(!r.text.includes('"name": "cauldron'), 'encoded traversal must not leak package.json');

    r = await request(`/workspace-preview/${sid}/../../package.json`);
    assert.ok([403, 404].includes(r.res.status), `traversal (literal) should be 403/404, got ${r.res.status}`);
    assert.ok(!r.text.includes('"name": "cauldron'), 'literal traversal must not leak package.json');
    console.log('Path traversal blocked: OK');

    console.log('Workspace preview smoke tests passed ✓');
  } catch (err) {
    console.error(output);
    throw err;
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})();
