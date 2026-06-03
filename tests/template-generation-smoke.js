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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-template-generation-'));
  let ollamaPayload = null;

  const fakeOllama = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      ollamaPayload = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response: '# Project Blueprint\n\nTemplate-aware blueprint.' }));
    });
  });
  await new Promise(resolve => fakeOllama.listen(0, '127.0.0.1', resolve));
  const ollamaPort = fakeOllama.address().port;

  const probe = http.createServer((req, res) => res.end('ok'));
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const appPort = probe.address().port + 1;
  await new Promise(resolve => probe.close(resolve));

  const app = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(appPort),
      CAULDRON_DATA_DIR: tmp,
      OLLAMA_BASE_URL: `http://127.0.0.1:${ollamaPort}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(`http://127.0.0.1:${appPort}/api/health`);
    const res = await fetch(`http://127.0.0.1:${appPort}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Make a tiny interactive habit tracker.',
        model: 'qwen3.5:latest',
        projectType: 'app',
        templateId: 'html-alpine',
      }),
    });
    const text = await res.text();
    assert.strictEqual(res.status, 200, text || 'generate should succeed');
    const events = text.split('\n').filter(Boolean).map(line => JSON.parse(line));
    const blueprintEvent = events.find(event => event.type === 'blueprint');
    assert.ok(blueprintEvent, 'generate should emit a blueprint event');
    assert.strictEqual(blueprintEvent.data.success, true);
    assert.ok(ollamaPayload, 'fake Ollama should receive a generation request');
    assert.ok(ollamaPayload.system.includes('## Project Type: HTML + AlpineJS'), 'system prompt should include selected template heading');
    assert.ok(ollamaPayload.system.includes('AlpineJS state'), 'system prompt should include template prompt bias');
    assert.ok(ollamaPayload.system.includes('index.html'), 'system prompt should include expected file names');

    const historyRes = await fetch(`http://127.0.0.1:${appPort}/api/history`);
    const historyData = await historyRes.json();
    assert.ok(historyData.sessions.length >= 1, 'generation should create session history');
    assert.strictEqual(historyData.sessions[0].generation_mode, 'local', 'session should record local generation mode');

    console.log('Template generation smoke tests passed');
  } finally {
    app.kill('SIGTERM');
    fakeOllama.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
