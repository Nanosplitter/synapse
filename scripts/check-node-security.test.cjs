const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'check-node-security.cjs'), 'utf8');
function check(version) {
  vm.runInNewContext(source, { process: { versions: { node: version } }, console: { log() {} } });
}
test('rejects unsupported releases and versions immediately before each security fix', () => {
  for (const version of ['18.20.8', '20.20.2', '22.23.3', '24.22.0', '26.12.0']) {
    assert.throws(() => check(version), /outside the approved patched runtime/);
  }
});
test('accepts the patched supported releases and their later patch/minor versions', () => {
  for (const version of ['22.23.4', '24.22.1', '26.12.1', '24.23.0']) {
    assert.doesNotThrow(() => check(version));
  }
});
