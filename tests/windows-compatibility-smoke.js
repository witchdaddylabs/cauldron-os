const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { npmExecutable, npmSpawnOptions } = require('../lib/scaffold-generator');

const repoRoot = path.resolve(__dirname, '..');
const batch = fs.readFileSync(path.join(repoRoot, 'start-cauldron.bat'), 'utf8');
const powershell = fs.readFileSync(path.join(repoRoot, 'start-cauldron.ps1'), 'utf8');
const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
const ciWorkflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');

assert.equal(npmExecutable('win32'), 'npm.cmd', 'Windows scaffold bootstrap should launch npm.cmd');
assert.equal(npmExecutable('darwin'), 'npm', 'macOS scaffold bootstrap should launch npm');
assert.equal(npmExecutable('linux'), 'npm', 'Linux scaffold bootstrap should launch npm');
assert.equal(npmSpawnOptions('C:\\cauldron-project', 'win32').shell, true, 'Windows npm.cmd should run through the command shell');
assert.equal(npmSpawnOptions('/tmp/cauldron-project', 'linux').shell, false, 'Unix npm should not require shell execution');

for (const [name, script] of [['batch', batch], ['PowerShell', powershell]]) {
  assert.match(script, /package\.json/, `${name} launcher should read the current package version`);
  assert.match(script, /npm (?:ls|install|start)|npmCommand/, `${name} launcher should use the npm package contract`);
  assert.doesNotMatch(script, /2\.3\.0|OLLAMA_MODEL/, `${name} launcher should not contain stale version or model defaults`);
}

assert.match(batch, /cd \/d "%~dp0"/, 'batch launcher should run from its own directory');
assert.match(batch, /NODE_MAJOR/, 'batch launcher should enforce the supported Node major version');
assert.match(powershell, /Set-Location \$PSScriptRoot/, 'PowerShell launcher should run from its own directory');
assert.match(powershell, /\$nodeMajor -lt 18/, 'PowerShell launcher should enforce the supported Node major version');
assert.match(readme, /Windows \(easiest\)/, 'README should identify the simplest Windows path');
assert.match(readme, /double-click `start-cauldron\.bat`/, 'README should expose the double-click Windows launcher');
assert.match(ciWorkflow, /windows-smoke-test:[\s\S]*runs-on: windows-latest[\s\S]*npm test/, 'CI should run the full smoke suite on Windows');

console.log('Windows compatibility smoke tests passed');
