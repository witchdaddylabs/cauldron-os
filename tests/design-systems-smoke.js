const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function waitForServer(url, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {}
      if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${url}`));
      setTimeout(tick, 250);
    };
    tick();
  });
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-design-systems-'));
  const probe = http.createServer((req, res) => res.end('ok'));
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const appPort = probe.address().port + 1;
  await new Promise(resolve => probe.close(resolve));

  const app = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(appPort), CAULDRON_DATA_DIR: tmp },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(`http://127.0.0.1:${appPort}/api/health`);

    const listRes = await fetch(`http://127.0.0.1:${appPort}/api/design-systems`);
    const listData = await listRes.json();
    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listData.systems), 'systems response should include systems array');
    assert.ok(listData.systems.length >= 150, `expected 150+ systems, got ${listData.systems.length}`);

    const ids = listData.systems.map(system => system.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'design-system ids should be unique');
    for (const id of ['cursor', 'lovable', 'webflow', 'vercel']) {
      assert.ok(ids.includes(id), `expected ${id} to remain available`);
    }

    const cursor = listData.systems.find(system => system.id === 'cursor');
    assert.ok(cursor.name.includes('Cursor'), 'legacy display name should be preserved for Cursor');
    assert.strictEqual(cursor.source, 'open-design');

    const firstRef = await fetch(`http://127.0.0.1:${appPort}/api/design-reference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: 'cursor' }),
    });
    const firstData = await firstRef.json();
    assert.strictEqual(firstRef.status, 200, firstData.error || 'design-reference should load local catalog content');
    assert.strictEqual(firstData.system, 'cursor');
    assert.strictEqual(firstData.cached, false);
    assert.match(firstData.content, /Cursor/i);
    assert.ok(firstData.content.length > 200, 'local DESIGN.md content should be returned');

    const cachedRef = await fetch(`http://127.0.0.1:${appPort}/api/design-reference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: 'cursor' }),
    });
    const cachedData = await cachedRef.json();
    assert.strictEqual(cachedRef.status, 200);
    assert.strictEqual(cachedData.cached, true);

    const invalidRef = await fetch(`http://127.0.0.1:${appPort}/api/design-reference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: 'missing-system' }),
    });
    assert.strictEqual(invalidRef.status, 400, 'invalid design system should return 400');

    console.log('Design systems smoke tests passed');
  } finally {
    app.kill('SIGTERM');
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
