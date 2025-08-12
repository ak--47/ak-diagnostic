/**
 * ESM test for ak-diagnostic
 */

import assert from 'assert';
import { Diagnostics } from '../index.mjs';

console.log('Running ak-diagnostic ESM tests...\n');

// Test ESM import
console.log('Test: ESM import');
assert.ok(Diagnostics, 'Diagnostics should be imported');
console.log('✓ ESM import works correctly');

// Test basic functionality with ESM
console.log('\nTest: ESM functionality');
const diagnostics = new Diagnostics({
  name: 'ESMTest',
  interval: 100
});

diagnostics.start();
assert.strictEqual(diagnostics.status().running, true);
console.log('✓ ESM module functions correctly');

// Wait and test report
await new Promise(resolve => setTimeout(resolve, 300));

diagnostics.stop();
const report = diagnostics.report();

assert.ok(report.memory);
assert.ok(report.cpu);
assert.ok(report.analysis.numSamples > 0);
console.log('✓ ESM module generates reports correctly');

console.log('\n' + '='.repeat(50));
console.log('ESM tests passed! ✅');
console.log('='.repeat(50));

process.exit(0);