const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHandoffPackage } = require('../lib/handoff-package');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cauldron-scaffold-'));

function assertFile(root, relativePath) {
  const filePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(filePath), `${relativePath} should exist`);
  return fs.readFileSync(filePath, 'utf8');
}

(async () => {
  try {
    const expected = {
      'static-html': ['index.html', 'styles.css'],
      'html-alpine': ['index.html', 'styles.css', 'app.js'],
      nextjs: ['package.json', 'next.config.mjs', 'tsconfig.json', 'next-env.d.ts', 'app/layout.tsx', 'app/page.tsx', 'app/globals.css'],
      astro: ['package.json', 'astro.config.mjs', 'src/pages/index.astro', 'src/styles/global.css'],
    };

    for (const [templateId, files] of Object.entries(expected)) {
      const projectPath = path.join(tmp, templateId);
      const handoff = await createHandoffPackage({
        projectPath,
        projectName: `Scaffold ${templateId}`,
        safeName: `scaffold-${templateId}`,
        cauldronVersion: 'test',
        blueprint: '# Project Blueprint\n\nBuild a polished scaffold.',
        prototypeHtml: '<main><h1>Prototype Shell</h1><p>Starter content</p></main>',
        designReference: 'none',
        designSystemContent: '# Design System\n\nUse strong contrast.',
        templateId,
        projectType: templateId === 'nextjs' ? 'app' : 'site',
        agentId: 'handoff',
      });

      const manifest = JSON.parse(assertFile(projectPath, 'cauldron.project.json'));
      assert.equal(manifest.scaffold.templateId, templateId);
      assert.equal(manifest.scaffold.scaffold, templateId);
      assert.ok(manifest.scaffold.entrypoint, 'scaffold should include an entrypoint');
      assert.ok(Array.isArray(manifest.scaffold.files), 'scaffold should include file metadata');
      assert.deepEqual(manifest.scaffold.files.map(file => file.path), files);
      assert.deepEqual(handoff.files.scaffold, files);

      for (const file of files) assertFile(projectPath, file);
    }

    const nextPackage = JSON.parse(assertFile(path.join(tmp, 'nextjs'), 'package.json'));
    assert.equal(nextPackage.scripts.dev, 'next dev');
    assert.ok(nextPackage.dependencies.next, 'Next.js scaffold should include next dependency');

    const astroPackage = JSON.parse(assertFile(path.join(tmp, 'astro'), 'package.json'));
    assert.equal(astroPackage.scripts.dev, 'astro dev');
    assert.ok(astroPackage.dependencies.astro, 'Astro scaffold should include astro dependency');

    const alpineIndex = assertFile(path.join(tmp, 'html-alpine'), 'index.html');
    assert.match(alpineIndex, /alpinejs/i);
    assert.match(alpineIndex, /Prototype Shell/);

    console.log('Scaffold smoke tests passed');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
