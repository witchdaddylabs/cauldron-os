/**
 * Security smoke tests: workspace path confinement, research URL SSRF
 * guards, host-header rebinding protection, and build-file local-file
 * disclosure.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { isInsideRoot, parseSessionId } = require('../lib/path-safety');
const {
  assertSafeResearchUrl,
  assertHttpOrHttpsUrl,
  validateHttpUrl,
  createPinnedLookup,
} = require('../lib/url-safety');
const { normaliseOpenAICompatibleChatUrl } = require('../lib/model-client');
const workspace = require('../lib/workspace');
const { stopProcess } = require('./_process-cleanup');

const repoRoot = path.resolve(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-security-'));
const PORT = 3431;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestWithHost(pathname, hostHeader) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: pathname,
        headers: { Host: hostHeader },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on('error', reject);
    req.end();
  });
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

async function jsonRequest(pathname, options = {}) {
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

(async () => {
  assert.equal(isInsideRoot('/tmp/projects', '/tmp/projects/app'), true);
  assert.equal(isInsideRoot('/tmp/projects', '/tmp/projects-evil'), false);
  assert.equal(isInsideRoot('/tmp/projects', '/tmp/projects/../secret'), false);
  assert.equal(parseSessionId('abc-123_ok'), 'abc-123_ok');
  assert.equal(parseSessionId('../escape'), null);
  assert.equal(parseSessionId('has.dot'), null);
  assert.equal(parseSessionId(''), null);
  console.log('  ✓ path-safety helpers');

  const sid = 'security-workspace-test';
  try {
    await assert.rejects(
      () => workspace.wsReadFile(sid, '/etc/passwd'),
      /Absolute paths are not allowed|Path traversal/
    );
    await assert.rejects(
      () => workspace.wsReadFile('../escape', 'readme.txt'),
      /Invalid sessionId/
    );
    await assert.rejects(() => workspace.wsReadFile(sid, '../package.json'), /Path traversal/);
    await workspace.wsWriteFile(sid, 'nested/ok.txt', 'safe');
    const content = await workspace.wsReadFile(sid, 'nested/ok.txt');
    assert.equal(content, 'safe');
    try {
      const wsDir = workspace.workspaceDir(sid);
      const targetPath = path.join(wsDir, 'nested', 'ok.txt');
      const aliasPath = path.join(wsDir, 'alias.txt');
      fs.symlinkSync(targetPath, aliasPath);
      const deleted = await workspace.wsDeleteFile(sid, 'alias.txt');
      assert.equal(deleted.success, true, 'symlink delete should succeed');
      assert.equal(fs.existsSync(aliasPath), false, 'symlink should be removed');
      assert.equal(fs.readFileSync(targetPath, 'utf8'), 'safe', 'symlink target must remain');
    } catch (err) {
      if (err.code === 'EPERM' || /symlink/i.test(err.message)) {
        console.log(`  symlink delete test skipped: ${err.message}`);
      } else {
        throw err;
      }
    }
  } finally {
    await workspace.cleanupWorkspace(sid);
  }
  console.log('  ✓ workspace path confinement');

  await assert.rejects(() => assertSafeResearchUrl('file:///etc/passwd'), /http\/https/);
  await assert.rejects(
    () => assertSafeResearchUrl('http://169.254.169.254/latest/meta-data/'),
    /not allowed/
  );
  await assert.rejects(
    () => assertSafeResearchUrl('http://10.0.0.1/internal'),
    /private or reserved/
  );
  await assert.rejects(
    () => assertSafeResearchUrl('http://metadata.google.internal/'),
    /not allowed/
  );
  await assert.rejects(() => assertSafeResearchUrl('http://user:pass@example.com/'), /credentials/);
  const loopback = await assertSafeResearchUrl('http://127.0.0.1:9/fixture');
  assert.equal(loopback.hostname, '127.0.0.1');
  assert.equal(loopback.address, '127.0.0.1');
  assert.equal(loopback.family, 4);
  const ipv6 = await assertSafeResearchUrl('http://[::1]:5173/fixture');
  assert.equal(ipv6.hostname, '::1');
  assert.equal(ipv6.address, '::1');
  assert.equal(ipv6.family, 6);
  const pinned = createPinnedLookup('203.0.113.8', 4);
  await new Promise((resolve, reject) => {
    pinned('evil.example', { all: true }, (err, records) => {
      if (err) return reject(err);
      try {
        assert.equal(records[0].address, '203.0.113.8');
        assert.equal(records[0].family, 4);
        resolve();
      } catch (assertErr) {
        reject(assertErr);
      }
    });
  });
  validateHttpUrl('https://example.com/');
  assert.equal(
    normaliseOpenAICompatibleChatUrl('https://api.openai.com/v1'),
    'https://api.openai.com/v1/chat/completions'
  );
  assert.throws(
    () => assertHttpOrHttpsUrl('file:///etc/passwd', 'Model base URL'),
    /http or https/
  );
  assert.throws(() => normaliseOpenAICompatibleChatUrl('file:///tmp'), /http or https/);
  console.log('  ✓ research and model URL guards');

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
  child.stdout.on('data', (d) => (output += d.toString()));
  child.stderr.on('data', (d) => (output += d.toString()));

  try {
    await waitForHealth();

    const rebound = await requestWithHost('/api/health', 'evil.example');
    assert.equal(rebound.status, 403, 'foreign Host header should be blocked');
    assert.match(rebound.body, /Invalid host header/);

    const localHost = await requestWithHost('/api/health', `127.0.0.1:${PORT}`);
    assert.equal(localHost.status, 200, 'loopback Host header should be allowed');

    const start = await jsonRequest('/api/build/start', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Security smoke',
        model: 'llama3.2',
        sessionId: 'security-http-session',
      }),
    });
    assert.equal(start.res.status, 200, 'build/start should accept a safe sessionId');

    const traversalStart = await jsonRequest('/api/build/start', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Security smoke',
        model: 'llama3.2',
        sessionId: '../escape',
      }),
    });
    assert.equal(traversalStart.res.status, 400, 'build/start must reject traversal sessionId');

    const leaked = await jsonRequest('/api/build/file/security-http-session?path=/etc/passwd');
    assert.equal(leaked.res.status, 400, 'absolute workspace file path should be rejected');
    assert.equal(Boolean(leaked.text.includes('root:')), false, 'must not leak /etc/passwd');

    const meta = await jsonRequest('/api/research-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data/' }),
    });
    assert.equal(meta.res.status, 400, 'metadata research URL should be rejected');

    const privateNet = await jsonRequest('/api/research-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://192.168.0.1/' }),
    });
    assert.equal(privateNet.res.status, 400, 'private research URL should be rejected');

    console.log('Security smoke tests passed');
  } catch (err) {
    console.error(output);
    throw err;
  } finally {
    await stopProcess(child);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
