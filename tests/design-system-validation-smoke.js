const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync(process.execPath, ['scripts/validate-design-systems.js'], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8',
});

assert.strictEqual(result.status, 0, result.stderr || result.stdout);
assert.match(result.stdout, /Design system validation passed \(150 systems\)/);

console.log('Design system validation smoke tests passed');
