const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-scaffold-export-'));
const createdProjects = [];

function waitForServer(url, timeoutMs = 30000) {
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

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function assertProjectFiles(projectPath, files) {
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(projectPath, file)), `${file} should exist in ${projectPath}`);
  }
}

(async () => {
  const probe = http.createServer((req, res) => res.end('ok'));
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const appPort = probe.address().port + 1;
  await new Promise(resolve => probe.close(resolve));

  const app = spawn(process.execPath, ['server.js'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(appPort), CAULDRON_DATA_DIR: tmp },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(`http://127.0.0.1:${appPort}/api/health`);

    const expectations = {
      'static-html': ['index.html', 'styles.css', 'README.md', 'blueprint.md', 'design-system.md', 'cauldron.project.json'],
      'html-alpine': ['index.html', 'styles.css', 'app.js', 'README.md', 'blueprint.md', 'design-system.md', 'cauldron.project.json'],
      nextjs: ['package.json', 'app/page.tsx', 'app/layout.tsx', 'app/globals.css', 'README.md', 'blueprint.md', 'design-system.md', 'cauldron.project.json'],
      astro: ['package.json', 'astro.config.mjs', 'src/pages/index.astro', 'src/styles/global.css', 'README.md', 'blueprint.md', 'design-system.md', 'cauldron.project.json'],
    };

    for (const [templateId, files] of Object.entries(expectations)) {
      const projectName = `scaffold-export-${templateId}`;
      const { res, data } = await postJson(`http://127.0.0.1:${appPort}/api/build-agents/run`, {
        projectName,
        agentId: 'handoff',
        blueprint: `# ${templateId}\n\nBuild a scaffold export smoke project.`,
        prototypeHtml: '<main><h1>Scaffold Export</h1></main>',
        designReference: 'none',
        templateId,
        projectType: templateId === 'nextjs' ? 'app' : 'site',
      });

      assert.equal(res.status, 200, data.error || `${templateId} export should succeed`);
      createdProjects.push(data.projectPath);
      assertProjectFiles(data.projectPath, files);

      const manifest = JSON.parse(fs.readFileSync(data.manifestPath, 'utf8'));
      assert.equal(manifest.scaffold.templateId, templateId);
      assert.equal(manifest.scaffold.scaffold, templateId);
      assert.ok(manifest.scaffold.entrypoint, `${templateId} should expose an entrypoint`);
      assert.deepEqual(manifest.scaffold.files.map(file => file.path), data.files.scaffold);
      assertProjectFiles(data.projectPath, manifest.scaffold.files.map(file => file.path));
      assert.ok(!fs.existsSync(path.join(data.projectPath, 'node_modules')), 'scaffold export should not run npm install');
    }

    const duplicate = await postJson(`http://127.0.0.1:${appPort}/api/build-agents/run`, {
      projectName: 'scaffold-export-static-html',
      agentId: 'handoff',
      blueprint: '# Duplicate\\n\\nDo not overwrite.',
      templateId: 'static-html',
    });
    assert.equal(duplicate.res.status, 409, 'duplicate scaffold export should be rejected');

    // Test bootstrap mode for nextjs scaffold
    const bootstrapResult = await postJson(`http://127.0.0.1:${appPort}/api/build-agents/run`, {
      projectName: 'scaffold-export-nextjs-bootstrap',
      agentId: 'handoff',
      blueprint: '# Next.js Bootstrap\\n\\nInstall dependencies automatically.',
      prototypeHtml: '<main><h1>Bootstrap Test</h1></main>',
      designReference: 'none',
      templateId: 'nextjs',
      projectType: 'app',
      bootstrap: true,
    });
    assert.equal(bootstrapResult.res.status, 200, bootstrapResult.data.error || 'bootstrap export should succeed');
    createdProjects.push(bootstrapResult.data.projectPath);
    assert.ok(bootstrapResult.data.bootstrap !== null, 'bootstrap result should be present');
    assertProjectFiles(bootstrapResult.data.projectPath, ['package.json', 'app/page.tsx', 'node_modules']);

    console.log('Scaffold export smoke tests passed');
  } finally {
    app.kill('SIGTERM');
    fs.rmSync(tmp, { recursive: true, force: true });
    for (const projectPath of createdProjects) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
