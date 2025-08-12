/**
 * Stress test example for ak-diagnostic
 * This simulates a memory-intensive application with CPU spikes
 */

const { Diagnostics } = require('../index.js');
const crypto = require('crypto');

// Create diagnostics with aggressive monitoring
const diagnostics = new Diagnostics({
  name: 'StressTest',
  interval: 500, // Sample every 500ms for detailed monitoring
  threshold: 200_000_000, // Alert at 200MB
  target: 100_000_000, // Target 100MB
  alert: info => {
    console.log(`\n🚨 ALERT at ${new Date().toISOString()}`);
    console.log(
      `   Memory: ${info.memory.formatted.current} (threshold: ${info.memory.formatted.threshold})`
    );
  },
  monitorEventLoop: true
});

console.log('🚀 Starting stress test...');
console.log('This will simulate memory leaks and CPU spikes.\n');

diagnostics.start();

let leakedData = [];
let phase = 1;
let startTime = Date.now();

// Phase 1: Memory leak simulation
console.log('📊 Phase 1: Memory Leak Simulation');
const memoryLeakInterval = setInterval(() => {
  // Allocate memory that won't be freed
  const leak = Buffer.alloc(5_000_000); // 5MB
  leak.fill('x');
  leakedData.push(leak);

  const elapsed = Date.now() - startTime;
  if (elapsed > 5000) {
    clearInterval(memoryLeakInterval);
    phase2();
  }
}, 100);

// Phase 2: CPU intensive operations
function phase2() {
  console.log('\n📊 Phase 2: CPU Intensive Operations');
  phase = 2;
  console.log(`Phase ${phase} starting...`);
  startTime = Date.now();

  const cpuInterval = setInterval(() => {
    // Perform CPU intensive operation
    for (let i = 0; i < 5; i++) {
      crypto.pbkdf2Sync('password', 'salt', 1000, 64, 'sha512');
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 5000) {
      clearInterval(cpuInterval);
      phase3();
    }
  }, 200);
}

// Phase 3: Event loop blocking
function phase3() {
  console.log('\n📊 Phase 3: Event Loop Blocking');
  phase = 3;
  console.log(`Phase ${phase} starting...`);
  startTime = Date.now();

  const blockingInterval = setInterval(() => {
    // Block event loop with synchronous operation
    const start = Date.now();
    while (Date.now() - start < 50) {
      // Busy wait for 50ms
      Math.sqrt(Math.random());
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 5000) {
      clearInterval(blockingInterval);
      phase4();
    }
  }, 100);
}

// Phase 4: Mixed load
function phase4() {
  console.log('\n📊 Phase 4: Mixed Load (Memory + CPU)');
  phase = 4;
  console.log(`Phase ${phase} starting...`);
  startTime = Date.now();

  const mixedInterval = setInterval(() => {
    // Memory allocation
    const data = Buffer.alloc(2_000_000);
    leakedData.push(data);

    // CPU work
    crypto.pbkdf2Sync('test', 'salt', 500, 32, 'sha256');

    // Occasionally free some memory
    if (Math.random() > 0.7) {
      leakedData = leakedData.slice(-10);
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 5000) {
      clearInterval(mixedInterval);
      complete();
    }
  }, 100);
}

// Complete and show report
function complete() {
  console.log('\n📊 Phase 5: Completing stress test...\n');

  diagnostics.stop();
  const report = diagnostics.report();

  console.log('═'.repeat(70));
  console.log('                    STRESS TEST COMPLETE');
  console.log('═'.repeat(70));

  console.log('\n🎯 EXECUTIVE SUMMARY:');
  console.log('├─ Duration:', report.summary.duration);
  console.log('├─ Peak Memory:', report.summary.peakMemory);
  console.log('├─ Average Memory:', report.summary.averageMemory);
  console.log('├─ Peak CPU:', report.summary.peakCPU);
  console.log('├─ Average CPU:', report.summary.averageCPU);
  console.log('├─ Total Samples:', report.summary.samples);
  console.log('└─ Memory Alerts:', report.summary.alerts);

  console.log('\n💾 MEMORY ANALYSIS:');
  console.log('├─ Heap Memory:');
  console.log('│  ├─ Peak:', report.memory.heap.peak.human);
  console.log('│  ├─ Average:', report.memory.heap.average.human);
  console.log('│  └─ Low:', report.memory.heap.low.human);
  console.log('└─ RSS (Total):');
  console.log('   ├─ Peak:', report.memory.rss.peak.human);
  console.log('   ├─ Average:', report.memory.rss.average.human);
  console.log('   └─ Low:', report.memory.rss.low.human);

  console.log('\n🖥️  CPU ANALYSIS:');
  console.log('├─ Peak Usage:', report.cpu.peak.human);
  console.log('├─ Average Usage:', report.cpu.average.human);
  console.log('└─ Minimum Usage:', report.cpu.low.human);

  console.log('\n⏱️  EVENT LOOP ANALYSIS:');
  console.log('├─ Average Lag:', report.eventLoop.lag.average.ms.toFixed(2) + 'ms');
  console.log('├─ Maximum Lag:', report.eventLoop.lag.max.ms.toFixed(2) + 'ms');
  console.log('└─ Minimum Lag:', report.eventLoop.lag.min.ms.toFixed(2) + 'ms');

  console.log('\n📈 TARGET ANALYSIS:');
  if (report.analysis.target) {
    const totalTime = report.clock.duration;
    const overTargetPercent = ((report.analysis.timeOverTarget / totalTime) * 100).toFixed(2);
    const underTargetPercent = ((report.analysis.timeUnderTarget / totalTime) * 100).toFixed(2);

    console.log('├─ Target Memory:', report.analysis.target.human);
    console.log(
      '├─ Time Over Target:',
      report.analysis.timeOverTargetHuman,
      `(${overTargetPercent}%)`
    );
    console.log(
      '└─ Time Under Target:',
      report.analysis.timeUnderTargetHuman,
      `(${underTargetPercent}%)`
    );
  }

  if (report.analysis.threshold) {
    console.log('\n🚨 THRESHOLD ANALYSIS:');
    console.log('├─ Threshold:', report.analysis.threshold.human);
    console.log('└─ Times Exceeded:', report.analysis.numOfAlertTriggers);
  }

  console.log('\n🔍 DETAILED METRICS:');
  console.log('├─ Start Time:', new Date(report.clock.startTime).toISOString());
  console.log('├─ End Time:', new Date(report.clock.endTime).toISOString());
  console.log('├─ Total Duration:', report.clock.human);
  console.log('├─ Sampling Interval:', report.analysis.samplingInterval + 'ms');
  console.log('└─ Samples Collected:', report.analysis.numSamples);

  // Performance grade
  console.log('\n🏆 PERFORMANCE GRADE:');
  const avgMemoryMB = report.memory.average.bytes / 1_000_000;
  const avgCPU = report.cpu.average.percentage;
  const maxLag = report.eventLoop.lag.max.ms;

  let grade = 'A';
  const issues = [];

  if (avgMemoryMB > 150) {
    grade = 'B';
    issues.push('High average memory usage');
  }
  if (avgCPU > 50) {
    grade = grade === 'B' ? 'C' : 'B';
    issues.push('High CPU usage');
  }
  if (maxLag > 100) {
    grade = grade === 'C' ? 'D' : 'C';
    issues.push('Significant event loop blocking');
  }
  if (report.analysis.numOfAlertTriggers > 5) {
    grade = 'D';
    issues.push('Frequent memory threshold violations');
  }

  console.log(`├─ Grade: ${grade}`);
  if (issues.length > 0) {
    console.log('└─ Issues Found:');
    issues.forEach((issue, i) => {
      const prefix = i === issues.length - 1 ? '   └─' : '   ├─';
      console.log(`${prefix} ${issue}`);
    });
  } else {
    console.log('└─ Status: Excellent performance!');
  }

  console.log('\n' + '═'.repeat(70));
  console.log('Stress test completed successfully!');
  console.log('═'.repeat(70) + '\n');

  // Clean up
  leakedData = null;
  global.gc && global.gc(); // Force garbage collection if available

  process.exit(0);
}

// Handle unexpected exit
process.on('SIGINT', () => {
  console.log('\n\nInterrupted! Generating final report...\n');
  complete();
});
