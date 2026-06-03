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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-build-agents-'));
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

    const agentsRes = await fetch(`http://127.0.0.1:${appPort}/api/build-agents`);
    const agentsData = await agentsRes.json();
    assert.strictEqual(agentsRes.status, 200);
    assert.strictEqual(agentsData.success, true);
    assert.ok(Array.isArray(agentsData.agents), 'build agents response should include agents array');
    assert.ok(agentsData.agents.find(agent => agent.id === 'handoff' && agent.available), 'handoff agent should always be available');
    assert.ok(agentsData.agents.find(agent => agent.id === 'cursor'), 'cursor detection entry should exist');
    assert.ok(agentsData.agents.find(agent => agent.id === 'opencode'), 'opencode detection entry should exist');

    const runRes = await fetch(`http://127.0.0.1:${appPort}/api/build-agents/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: 'agent-handoff-test',
        agentId: 'handoff',
        blueprint: '# Agent Test\n\n```html\n<div>Agent handoff</div>\n```',
        prototypeHtml: '<main>Prototype from request</main>',
        designReference: 'cursor',
        templateId: 'html-alpine',
        projectType: 'prototype',
      }),
    });
    const runData = await runRes.json();
    assert.strictEqual(runRes.status, 200, runData.error || 'build agent run should succeed');
    assert.strictEqual(runData.success, true);
    assert.strictEqual(runData.mode, 'handoff-only');
    assert.strictEqual(runData.fallback, false);
    assert.ok(runData.projectPath, 'projectPath should be returned');
    assert.ok(runData.manifestPath, 'manifestPath should be returned');

    const manifest = JSON.parse(fs.readFileSync(runData.manifestPath, 'utf8'));
    assert.strictEqual(manifest.templateId, 'html-alpine');
    assert.strictEqual(manifest.projectType, 'prototype');
    assert.strictEqual(manifest.designReference, 'cursor');
    assert.strictEqual(manifest.agent.mode, 'handoff-only');
    assert.strictEqual(manifest.files.agentPrompt, 'agent-prompt.md');
    assert.strictEqual(manifest.scaffold.templateId, 'html-alpine');
    assert.strictEqual(manifest.scaffold.entrypoint, 'index.html');
    assert.ok(manifest.scaffold.files.some(file => file.path === 'index.html' && file.role === 'entry'), 'scaffold should include index.html entry metadata');
    assert.ok(manifest.scaffold.files.some(file => file.path === 'app.js' && file.role === 'script'), 'html-alpine scaffold should include app.js script metadata');

    for (const file of ['blueprint.md', 'prototype.html', 'design-system.md', 'README.md', 'agent-prompt.md', '.cursorrules', 'index.html', 'styles.css', 'app.js']) {
      assert.ok(fs.existsSync(path.join(runData.projectPath, file)), `${file} should be written`);
    }

    console.log('Build agents smoke tests passed');
  } finally {
    app.kill('SIGTERM');
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(path.join(__dirname, '..', 'projects', 'agent-handoff-test'), { recursive: true, force: true });
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
