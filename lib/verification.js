const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { isInsideRoot } = require('./path-safety');
const { scorePrototypeHtml } = require('./quality-scorer');
const { SCAFFOLD_METADATA } = require('./scaffold-generator');

const execAsync = promisify(exec);
const PLACEHOLDER_PATTERN = /\b(lorem ipsum|placeholder|todo|replace me|coming soon)\b/i;
const LOCAL_ASSET_PATTERN = /(?:src|href)=["']([^"']+)["']/gi;

function normalizeCheckResult(check = {}) {
  return {
    id: check.id || 'unknown',
    label: check.label || check.id || 'Unknown check',
    category: check.category || 'static',
    status: check.status || 'skipped',
    command: check.command || null,
    stdout: check.stdout || '',
    stderr: check.stderr || '',
    exitCode: check.exitCode ?? null,
    durationMs: Number(check.durationMs || 0),
    details: check.details || null,
  };
}

function computeOverallResult(checks = []) {
  const normalized = checks.map(normalizeCheckResult);
  if (normalized.some((check) => check.status === 'failed')) return 'BLOCKED';
  if (normalized.some((check) => check.status === 'passed' || check.status === 'skipped')) {
    if (
      normalized.some((check) => check.status === 'skipped' || check.status === 'not_configured')
    ) {
      return 'PASS_WITH_WARNINGS';
    }
    const accessibilityCheck = normalized.find((check) => check.id === 'accessibility');
    if (
      accessibilityCheck?.details?.quality?.grade &&
      ['C', 'D'].includes(accessibilityCheck.details.quality.grade)
    ) {
      return 'PASS_WITH_WARNINGS';
    }
    return 'PASS';
  }
  return 'PASS_WITH_WARNINGS';
}

function safeResolve(targetDir, relativePath = '') {
  const root = path.resolve(targetDir);
  const resolved = path.resolve(root, relativePath);
  if (!isInsideRoot(root, resolved)) {
    throw new Error(`Verification path escaped target directory: ${relativePath}`);
  }
  return resolved;
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readJsonIfExists(filePath) {
  if (!fileExists(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function inferScaffold({ manifest = null, templateId = '' } = {}) {
  const manifestScaffold = manifest?.scaffold || null;
  if (manifestScaffold?.entrypoint) return manifestScaffold;

  const key = templateId && SCAFFOLD_METADATA[templateId] ? templateId : 'html-alpine';
  const metadata = SCAFFOLD_METADATA[key] || SCAFFOLD_METADATA['html-alpine'];
  return {
    id: key,
    templateId: key,
    entrypoint: metadata.entrypoint,
    packageManager: metadata.packageManager,
    commands: metadata.commands || {},
    files: Object.keys(metadata.roles || {}).map((filePath) => ({
      path: filePath,
      role: metadata.roles[filePath],
    })),
  };
}

function summarizeChecks(checks = []) {
  return checks.reduce(
    (summary, check) => {
      summary[check.status] = (summary[check.status] || 0) + 1;
      return summary;
    },
    {
      passed: 0,
      failed: 0,
      skipped: 0,
      not_configured: 0,
    }
  );
}

async function runCommand(command, cwd, timeoutMs = 60000) {
  const startedAt = Date.now();
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: 0,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
      exitCode: typeof error.code === 'number' ? error.code : 1,
      durationMs: Date.now() - startedAt,
    };
  }
}

function collectLocalReferences(html = '') {
  const refs = [];
  for (const match of String(html).matchAll(LOCAL_ASSET_PATTERN)) {
    const ref = String(match[1] || '').trim();
    if (
      !ref ||
      ref.startsWith('http://') ||
      ref.startsWith('https://') ||
      ref.startsWith('mailto:') ||
      ref.startsWith('#') ||
      ref.startsWith('data:')
    ) {
      continue;
    }
    refs.push(ref.replace(/^\.\//, ''));
  }
  return Array.from(new Set(refs));
}

function buildManifestChecks({ targetDir, manifest, scaffold }) {
  const manifestPath = path.join(targetDir, 'cauldron.project.json');
  const checks = [];
  checks.push(
    normalizeCheckResult({
      id: 'manifest-file',
      label: 'Manifest file exists',
      category: 'manifest',
      status: fileExists(manifestPath) ? 'passed' : 'not_configured',
      details: { path: 'cauldron.project.json' },
    })
  );

  const entrypointPath = scaffold?.entrypoint ? safeResolve(targetDir, scaffold.entrypoint) : null;
  checks.push(
    normalizeCheckResult({
      id: 'entrypoint',
      label: 'Entrypoint exists',
      category: 'manifest',
      status: entrypointPath && fileExists(entrypointPath) ? 'passed' : 'failed',
      details: { entrypoint: scaffold?.entrypoint || null },
    })
  );

  const missingFiles = (scaffold?.files || [])
    .map((file) => file.path)
    .filter(Boolean)
    .filter((filePath) => !fileExists(safeResolve(targetDir, filePath)));

  checks.push(
    normalizeCheckResult({
      id: 'scaffold-files',
      label: 'Scaffold files present',
      category: 'manifest',
      status: missingFiles.length ? 'failed' : 'passed',
      details: { missingFiles },
    })
  );

  if (manifest) {
    checks.push(
      normalizeCheckResult({
        id: 'manifest-json',
        label: 'Manifest JSON parsed',
        category: 'manifest',
        status: 'passed',
        details: {
          templateId: manifest.templateId || scaffold?.templateId || null,
          source: manifest.source || null,
        },
      })
    );
  }

  return checks;
}

function buildStaticChecks({ targetDir, scaffold }) {
  const entrypoint = scaffold?.entrypoint ? safeResolve(targetDir, scaffold.entrypoint) : null;
  if (!entrypoint || !fileExists(entrypoint) || !entrypoint.endsWith('.html')) {
    return [
      normalizeCheckResult({
        id: 'static-refs',
        label: 'Local references resolve',
        category: 'static',
        status: 'not_configured',
      }),
      normalizeCheckResult({
        id: 'placeholder-copy',
        label: 'Placeholder copy removed',
        category: 'static',
        status: 'not_configured',
      }),
    ];
  }

  const html = fs.readFileSync(entrypoint, 'utf8');
  const refs = collectLocalReferences(html);
  const missingRefs = refs.filter((ref) => !fileExists(safeResolve(path.dirname(entrypoint), ref)));
  const hasHtmlShell = /<html[\s>]/i.test(html) && /<body[\s>]/i.test(html);
  const hasPlaceholderCopy = PLACEHOLDER_PATTERN.test(html);

  return [
    normalizeCheckResult({
      id: 'html-shell',
      label: 'HTML shell is present',
      category: 'static',
      status: hasHtmlShell ? 'passed' : 'failed',
      details: { entrypoint: scaffold.entrypoint },
    }),
    normalizeCheckResult({
      id: 'static-refs',
      label: 'Local references resolve',
      category: 'static',
      status: missingRefs.length ? 'failed' : 'passed',
      details: { missingRefs },
    }),
    normalizeCheckResult({
      id: 'placeholder-copy',
      label: 'Placeholder copy removed',
      category: 'static',
      status: hasPlaceholderCopy ? 'failed' : 'passed',
      details: hasPlaceholderCopy ? { pattern: PLACEHOLDER_PATTERN.source } : null,
    }),
  ];
}

function buildAccessibilityCheck({ targetDir, scaffold }) {
  const entrypoint = scaffold?.entrypoint ? safeResolve(targetDir, scaffold.entrypoint) : null;
  if (!entrypoint || !fileExists(entrypoint) || !entrypoint.endsWith('.html')) {
    return normalizeCheckResult({
      id: 'accessibility',
      label: 'Accessibility heuristics',
      category: 'accessibility',
      status: 'not_configured',
    });
  }

  const html = fs.readFileSync(entrypoint, 'utf8');
  const quality = scorePrototypeHtml(html);
  return normalizeCheckResult({
    id: 'accessibility',
    label: 'Accessibility heuristics',
    category: 'accessibility',
    status: quality.grade === 'D' ? 'failed' : quality.grade === 'C' ? 'skipped' : 'passed',
    details: { quality },
  });
}

async function buildCommandChecks({ targetDir, scaffold, options = {} }) {
  const packageJsonPath = path.join(targetDir, 'package.json');
  const packageJson = readJsonIfExists(packageJsonPath);
  const checks = [];
  const timeoutMs = Number(options.commandTimeoutMs || 60000);

  if (!scaffold?.packageManager || !packageJson) {
    checks.push(
      normalizeCheckResult({
        id: 'install-command',
        label: 'Install command',
        category: 'command',
        status: 'not_configured',
        details: { packageManager: scaffold?.packageManager || null },
      })
    );
  } else {
    const installCommand =
      scaffold.packageManager === 'npm' ? 'npm install' : `${scaffold.packageManager} install`;
    const installResult = await runCommand(installCommand, targetDir, timeoutMs);
    checks.push(
      normalizeCheckResult({
        id: 'install-command',
        label: 'Install command',
        category: 'command',
        status: installResult.exitCode === 0 ? 'passed' : 'failed',
        command: installCommand,
        ...installResult,
      })
    );
  }

  const commandDefinitions = [
    { id: 'build-command', label: 'Build command', command: scaffold?.commands?.build || null },
    {
      id: 'test-command',
      label: 'Test command',
      command: packageJson?.scripts?.test ? 'npm test' : null,
    },
  ];

  for (const definition of commandDefinitions) {
    if (!definition.command) {
      checks.push(
        normalizeCheckResult({
          id: definition.id,
          label: definition.label,
          category: 'command',
          status: 'not_configured',
        })
      );
      continue;
    }

    const result = await runCommand(definition.command, targetDir, timeoutMs);
    checks.push(
      normalizeCheckResult({
        id: definition.id,
        label: definition.label,
        category: 'command',
        status: result.exitCode === 0 ? 'passed' : 'failed',
        command: definition.command,
        ...result,
      })
    );
  }

  return checks;
}

async function runVerification({ targetDir, manifest = null, options = {} }) {
  if (!targetDir) {
    throw new Error('targetDir is required for verification');
  }

  const resolvedTargetDir = path.resolve(targetDir);
  if (!fileExists(resolvedTargetDir)) {
    throw new Error(`Verification target does not exist: ${resolvedTargetDir}`);
  }

  const existingManifest =
    manifest || readJsonIfExists(path.join(resolvedTargetDir, 'cauldron.project.json'));
  const scaffold = inferScaffold({
    manifest: existingManifest,
    templateId: options.templateId || existingManifest?.templateId || '',
  });

  const checks = [
    ...buildManifestChecks({ targetDir: resolvedTargetDir, manifest: existingManifest, scaffold }),
    ...buildStaticChecks({ targetDir: resolvedTargetDir, scaffold }),
    buildAccessibilityCheck({ targetDir: resolvedTargetDir, scaffold }),
    ...(await buildCommandChecks({ targetDir: resolvedTargetDir, scaffold, options })),
  ].map(normalizeCheckResult);

  return {
    targetDir: resolvedTargetDir,
    targetType: options.targetType || (existingManifest ? 'project' : 'workspace'),
    ranAt: new Date().toISOString(),
    scaffold: {
      id: scaffold.id || scaffold.templateId || options.templateId || null,
      entrypoint: scaffold.entrypoint || null,
      packageManager: scaffold.packageManager || null,
      commands: scaffold.commands || {},
    },
    overall: computeOverallResult(checks),
    summary: summarizeChecks(checks),
    checks,
  };
}

module.exports = {
  normalizeCheckResult,
  computeOverallResult,
  runVerification,
};
