/**
 * Vitest test suite for ak-diagnostic
 */

import { describe, test, expect } from 'vitest';
import { Diagnostics } from '../index.js';

describe('ak-diagnostic', () => {
  test('should require name option in constructor', () => {
    // @ts-expect-error - Testing invalid options
    expect(() => new Diagnostics({})).toThrow('Diagnostics requires a "name" option');
  });

  test('should handle basic start/stop functionality', () => {
    const diag = new Diagnostics({
      name: 'TestApp',
      interval: 100
    });

    expect(diag.status().running).toBe(false);

    diag.start();
    expect(diag.status().running).toBe(true);

    diag.stop();
    expect(diag.status().running).toBe(false);
  });

  test('should generate comprehensive reports', async () => {
    const diag = new Diagnostics({
      name: 'ReportTest',
      interval: 50
    });

    diag.start();

    // Let it collect some samples
    await new Promise(resolve => setTimeout(resolve, 200));

    diag.stop();
    const report = diag.report();

    expect(report.name).toBe('ReportTest');

    // Memory statistics
    expect(report.memory).toBeDefined();
    expect(report.memory.peak).toBeDefined();
    expect(report.memory.average).toBeDefined();
    expect(report.memory.low).toBeDefined();

    // CPU statistics
    expect(report.cpu).toBeDefined();
    expect(report.cpu.peak).toBeDefined();

    // Timing information
    expect(report.clock).toBeDefined();
    expect(report.clock.duration).toBeGreaterThanOrEqual(0);

    // Analysis data
    expect(report.analysis).toBeDefined();
    expect(report.analysis.numSamples).toBeGreaterThan(0);

    // Summary
    expect(report.summary).toBeDefined();
  });

  test('should trigger alerts when threshold exceeded', async () => {
    let alertTriggered = false;
    let alertInfo = null;

    const diag = new Diagnostics({
      name: 'AlertTest',
      interval: 50,
      threshold: 1, // Very low threshold to trigger alert
      alert: info => {
        alertTriggered = true;
        alertInfo = info;
      }
    });

    diag.start();

    await new Promise(resolve => setTimeout(resolve, 200));

    diag.stop();

    expect(alertTriggered).toBe(true);
    expect(alertInfo).toBeDefined();
    expect(alertInfo?.memory).toBeDefined();
    expect(alertInfo?.timestamp).toBeDefined();
    expect(alertInfo?.name).toBe('AlertTest');

    const report = diag.report();
    expect(report.analysis.numOfAlertTriggers).toBeGreaterThan(0);
  });

  test('should track time over/under target', async () => {
    const diag = new Diagnostics({
      name: 'TargetTest',
      interval: 50,
      target: 1 // Very low target
    });

    diag.start();

    await new Promise(resolve => setTimeout(resolve, 200));

    diag.stop();
    const report = diag.report();

    expect(report.analysis.timeOverTarget).toBeGreaterThan(0);
    expect(report.analysis.timeOverTargetHuman).toBeDefined();

    // Time calculations should be close (allow for small timing variations)
    const totalTime = report.analysis.timeOverTarget + report.analysis.timeUnderTarget;
    expect(Math.abs(totalTime - report.clock.duration)).toBeLessThanOrEqual(1);
  });

  test('should reset functionality correctly', async () => {
    const diag = new Diagnostics({
      name: 'ResetTest',
      interval: 50
    });

    diag.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    diag.stop();

    diag.report();
    // const samples1 = report1.analysis.numSamples;

    diag.reset();
    expect(diag.status().samplesCollected).toBe(0);

    diag.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    diag.stop();

    const report2 = diag.report();
    const samples2 = report2.analysis.numSamples;

    expect(samples2).toBeGreaterThan(0);
    // After reset, we should be able to collect new samples independently
    // The exact count may be similar since both run for same duration
  });

  test('should provide accurate status information', async () => {
    const diag = new Diagnostics({
      name: 'StatusTest',
      interval: 100
    });

    const status1 = diag.status();
    expect(status1.running).toBe(false);
    expect(status1.name).toBe('StatusTest');
    expect(status1.samplesCollected).toBe(0);

    diag.start();

    await new Promise(resolve => setTimeout(resolve, 200));

    const status2 = diag.status();
    expect(status2.running).toBe(true);
    expect(status2.samplesCollected).toBeGreaterThan(0);
    expect(status2.uptime).toBeGreaterThan(0);

    diag.stop();
  });

  test('should collect system information', async () => {
    const diag = new Diagnostics({
      name: 'SystemTest',
      interval: 50
    });

    diag.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    diag.stop();

    const report = diag.report();

    expect(report.infos).toBeDefined();
    expect(report.infos.platform).toBeDefined();
    expect(report.infos.nodeVersion).toBeDefined();
    expect(report.infos.cpus).toBeDefined();
    expect(Array.isArray(report.infos.cpus)).toBe(true);
  });

  test('should provide human-readable formats', async () => {
    const diag = new Diagnostics({
      name: 'FormatTest',
      interval: 50
    });

    diag.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    diag.stop();

    const report = diag.report();

    expect(report.memory.peak.human).toContain('B'); // Should have byte unit
    expect(report.cpu.peak.human).toContain('%');
    expect(report.clock.human.length).toBeGreaterThan(0);
  });

  test('should handle multiple start/stop cycles', async () => {
    const diag = new Diagnostics({
      name: 'CycleTest',
      interval: 50
    });

    diag.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    diag.stop();

    diag.report();
    // const samples1 = report1.analysis.numSamples;

    // Start again without reset
    diag.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    diag.stop();

    const report2 = diag.report();
    const samples2 = report2.analysis.numSamples;

    // Each start() begins a new collection session, so samples are independent
    expect(samples2).toBeGreaterThan(0);
  });

  test('should handle event loop monitoring', async () => {
    const diag = new Diagnostics({
      name: 'EventLoopTest',
      interval: 50,
      monitorEventLoop: true
    });

    diag.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    diag.stop();

    const report = diag.report();

    expect(report.eventLoop).toBeDefined();
    expect(report.eventLoop.lag).toBeDefined();
    expect(report.eventLoop.lag.average).toBeDefined();
    expect(report.eventLoop.lag.max).toBeDefined();
    expect(report.eventLoop.lag.min).toBeDefined();
  });

  test('should handle disabled event loop monitoring', async () => {
    const diag = new Diagnostics({
      name: 'NoEventLoopTest',
      interval: 50,
      monitorEventLoop: false
    });

    diag.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    diag.stop();

    const report = diag.report();

    // Should still have eventLoop section but with zero stats
    expect(report.eventLoop).toBeDefined();
    expect(report.eventLoop.lag.average.ms).toBe(0);
  });
});
