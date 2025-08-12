/**
 * ESM-specific test for ak-diagnostic with Vitest
 */

import { describe, test, expect } from 'vitest';
import { Diagnostics } from '../index.mjs';

describe('ak-diagnostic ESM', () => {
  test('should import Diagnostics from ESM module', () => {
    expect(Diagnostics).toBeDefined();
    expect(typeof Diagnostics).toBe('function');
  });

  test('should work correctly with ESM imports', async () => {
    const diagnostics = new Diagnostics({
      name: 'ESMTest',
      interval: 100
    });

    expect(diagnostics.status().running).toBe(false);

    diagnostics.start();
    expect(diagnostics.status().running).toBe(true);

    // Wait for some samples
    await new Promise(resolve => setTimeout(resolve, 300));

    diagnostics.stop();
    const report = diagnostics.report();

    expect(report.memory).toBeDefined();
    expect(report.cpu).toBeDefined();
    expect(report.analysis.numSamples).toBeGreaterThan(0);
    expect(report.name).toBe('ESMTest');
  });

  test('should provide same functionality as CommonJS version', async () => {
    let alertTriggered = false;

    const diagnostics = new Diagnostics({
      name: 'ESMAlertTest',
      interval: 50,
      threshold: 1, // Very low threshold
      alert: () => {
        alertTriggered = true;
      }
    });

    diagnostics.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    diagnostics.stop();

    const report = diagnostics.report();

    expect(alertTriggered).toBe(true);
    expect(report.analysis.numOfAlertTriggers).toBeGreaterThan(0);
  });
});
