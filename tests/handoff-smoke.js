/**
 * tests/handoff-smoke.js
 * Thorough smoke test for POST /api/handoff.
 *
 * Tests:
 * 1. Basic handoff with blueprint only — verifies response
 * 2. Verifies files created on disk at the path returned by server
 * 3. Verifies draft record created in DB
 * 4. Verifies prototype.html extraction from fenced HTML blocks
 * 5. Verifies error handling (missing fields, duplicate project names)
 * 6. Handoff with multiple HTML blocks (only first used)
 * 7. Handoff without HTML blocks (no prototype.html created)
 * 8. Verifies v0.30 handoff package files and manifest
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
const { spawn } = require('child_process');

const PORT = 3410;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cauldron-handoff-test-'));

process.env.PORT = String(PORT);
process.env.CAULDRON_DATA_DIR = DATA_DIR;
process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:3419';

let serverProcess = null;
let output = '';

function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', d => { output += d.toString(); });
    serverProcess.stderr.on('data', d => { output += d.toString(); });

    let started = false;
    const checkOutput = () => {
      if (output.includes('Server running') && !started) {
        started = true;
        resolve();
      }
    };
    serverProcess.stdout.on('data', checkOutput);
    serverProcess.stderr.on('data', checkOutput);

    setTimeout(() => {
      if (!started) reject(new Error('Server did not start within 15s'));
    }, 15000);
  });
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return async () => {
      try {
        await fn();
        console.log(`  ✓ ${name}`);
        passed++;
      } catch (err) {
        console.log(`  ✗ ${name}`);
        console.log(`    ${err.message}`);
        failed++;
      }
    };
  }

  console.log('\nStarting handoff smoke tests...\n');
  await startServer();
  console.log('  Server started on port', PORT, '\n');

  const testBlueprint = `# My Test Project

## Project Overview
A test project for smoke testing handoff.

## Core Features
1. Feature one
2. Feature two

## Visual Design
\`\`\`html
<div class="hero">
  <h1>Hello World</h1>
  <p>This is a test prototype.</p>
</div>
<style>
  .hero { background: #000; color: #fff; padding: 2rem; }
  h1 { font-size: 2rem; }
</style>
\`\`\`
`;

  // ── Test 1: Basic handoff with blueprint ──
  let handoffResponse = null;
  await test('Basic handoff with blueprint', async () => {
    const r = await request('POST', '/api/handoff', {
      projectName: 'handoff-test-1',
      blueprint: testBlueprint,
    });

    assert.equal(r.status, 200, `Expected 200, got ${r.status}`);
    assert.equal(r.body.success, true, 'Expected success=true');
    assert(r.body.projectPath, 'Expected projectPath in response');
    assert(r.body.draftId, 'Expected draftId in response');
    handoffResponse = r.body;
  })();

  // ── Test 2: Verify files created at the path the server returned ──
  await test('Files created at server-returned projectPath', async () => {
    const projectPath = handoffResponse.projectPath;

    assert(fs.existsSync(projectPath), `Project dir not found: ${projectPath}`);
    assert(fs.existsSync(path.join(projectPath, 'blueprint.md')), 'blueprint.md not found');
    assert(fs.existsSync(path.join(projectPath, 'prototype.html')), 'prototype.html not found');
    assert(fs.existsSync(path.join(projectPath, 'cauldron.project.json')), 'cauldron.project.json not found');
    assert(fs.existsSync(path.join(projectPath, 'design-system.md')), 'design-system.md not found');
    assert(fs.existsSync(path.join(projectPath, 'README.md')), 'README.md not found');
    assert(fs.existsSync(path.join(projectPath, '.cursorrules')), '.cursorrules not found');
    assert(fs.existsSync(path.join(projectPath, '.opencode', 'config.md')), '.opencode/config.md not found');

    // Verify blueprint content
    const blueprint = fs.readFileSync(path.join(projectPath, 'blueprint.md'), 'utf8');
    assert(blueprint.includes('My Test Project'), 'blueprint.md missing project name');

    // Verify prototype.html has the HTML from the fenced block
    const prototype = fs.readFileSync(path.join(projectPath, 'prototype.html'), 'utf8');
    assert(prototype.includes('Hello World'), 'prototype.html missing expected content');
    assert(prototype.includes('<!DOCTYPE html>'), 'prototype.html missing DOCTYPE');
    // AlpineJS CDN is only added when HTML uses Alpine directives (x-data, @click, etc.)
    // This test's sample HTML doesn't use Alpine, so no CDN expected

    // Verify opencode config
    const config = fs.readFileSync(path.join(projectPath, '.opencode', 'config.md'), 'utf8');
    assert(config.includes('handoff-test-1'), 'config.md missing project name');
    assert(config.includes('blueprint.md'), 'config.md missing blueprint reference');

    const manifest = JSON.parse(fs.readFileSync(path.join(projectPath, 'cauldron.project.json'), 'utf8'));
    assert.equal(manifest.schemaVersion, 1, 'manifest schemaVersion should be 1');
    assert.equal(manifest.projectName, 'handoff-test-1', 'manifest missing safe project name');
    assert.equal(manifest.agent.mode, 'handoff-only', 'manifest should distinguish package-only mode');
    assert.equal(manifest.files.blueprint, 'blueprint.md', 'manifest missing blueprint file');
    assert.equal(manifest.files.prototype, 'prototype.html', 'manifest missing prototype file');
    assert.equal(manifest.files.designSystem, 'design-system.md', 'manifest missing design-system file');
    assert.equal(manifest.files.readme, 'README.md', 'manifest missing README file');
    assert.equal(manifest.scaffold.templateId, 'html-alpine', 'manifest missing scaffold template id');
    assert.equal(manifest.scaffold.entrypoint, 'index.html', 'manifest missing scaffold entrypoint');
    assert(manifest.scaffold.files.some(file => file.path === 'index.html' && file.role === 'entry'), 'manifest missing scaffold index metadata');

    const readme = fs.readFileSync(path.join(projectPath, 'README.md'), 'utf8');
    assert(readme.includes('handoff package'), 'README should describe package creation');
    assert(!readme.includes('launched'), 'README should not imply an agent was launched');
  })();

  // ── Test 3: Verify draft record ──
  await test('Draft record created with correct data', async () => {
    const r = await request('GET', '/api/drafts');
    assert.equal(r.status, 200);
    assert(Array.isArray(r.body.drafts), `Expected drafts array, got: ${JSON.stringify(r.body).slice(0, 200)}`);

    const draft = r.body.drafts.find(d => d.project_name === 'handoff-test-1');
    assert(draft, `Draft 'handoff-test-1' not found. Available: ${JSON.stringify(r.body.drafts.map(d => ({name: d.project_name, id: d.id, mode: d.generation_mode})))}`);
    assert(draft.id, 'Draft missing id');
    assert.equal(draft.generation_mode, 'handoff', 'Expected generation_mode=handoff');

    // Verify blueprint content by fetching full draft by ID
    const fullR = await request('GET', `/api/drafts/${draft.id}`);
    assert.equal(fullR.status, 200);
    assert(fullR.body.draft.blueprint && fullR.body.draft.blueprint.includes('My Test Project'),
      `Full draft missing blueprint content. Got keys: ${Object.keys(fullR.body)}`);
  })();

  // ── Test 4: Duplicate project name returns 409 ──
  await test('Duplicate project name rejected with 409', async () => {
    const r = await request('POST', '/api/handoff', {
      projectName: 'handoff-test-1',
      blueprint: testBlueprint,
    });

    assert.equal(r.status, 409, `Expected 409 for duplicate, got ${r.status}`);
    assert(r.body.error, 'Expected error message');
    assert(r.body.error.includes('already exists'), `Expected 'already exists' error, got: ${r.body.error}`);
  })();

  // ── Test 5: Missing required fields return 400 ──
  await test('Missing projectName returns 400', async () => {
    const r = await request('POST', '/api/handoff', {
      blueprint: testBlueprint,
    });
    assert.equal(r.status, 400, `Expected 400, got ${r.status}`);
  })();

  await test('Missing both blueprint and sessionId returns 400', async () => {
    const r = await request('POST', '/api/handoff', {
      projectName: 'test-missing-both',
    });
    assert.equal(r.status, 400, `Expected 400, got ${r.status}`);
  })();

  // ── Test 6: Handoff with multiple HTML blocks (uses first only) ──
  await test('Handoff with multiple HTML blocks (uses first)', async () => {
    const multiHtml = `# Multi Block Test

## Section 1
\`\`\`html
<div class="block1">First block</div>
\`\`\`

## Section 2
\`\`\`html
<div class="block2">Second block</div>
\`\`\`
`;

    const r = await request('POST', '/api/handoff', {
      projectName: 'handoff-test-multi',
      blueprint: multiHtml,
    });

    assert.equal(r.status, 200);

    // prototype.html should contain only the first fenced HTML block
    const protoPath = path.join(r.body.projectPath, 'prototype.html');
    const prototype = fs.readFileSync(protoPath, 'utf8');
    assert(prototype.includes('First block'), 'Missing first HTML block');
    assert(!prototype.includes('Second block'), 'Should only contain first HTML block, not second');
  })();

  // ── Test 7: Handoff without HTML blocks creates no prototype ──
  await test('Handoff without HTML blocks (no prototype.html)', async () => {
    const noHtml = `# No HTML Test\n\nJust text, no fenced blocks.`;

    const r = await request('POST', '/api/handoff', {
      projectName: 'handoff-test-notext',
      blueprint: noHtml,
    });

    assert.equal(r.status, 200);

    const bpPath = path.join(r.body.projectPath, 'blueprint.md');
    const protoPath = path.join(r.body.projectPath, 'prototype.html');

    assert(fs.existsSync(bpPath), 'blueprint.md should exist');
    assert(!fs.existsSync(protoPath), 'prototype.html should not exist without HTML fenced block');
  })();

  // ── Test 8: Health check still works after handoff operations ──
  await test('Health check still works', async () => {
    const r = await request('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
  })();

  // Cleanup
  serverProcess.kill();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  // Clean up test projects left in project root
  const projectRoot = path.join(__dirname, '..', 'projects');
  for (const dir of ['handoff-test-1', 'handoff-test-multi', 'handoff-test-notext']) {
    const p = path.join(projectRoot, dir);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err.message);
  if (serverProcess) serverProcess.kill();
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
