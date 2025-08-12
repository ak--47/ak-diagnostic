/**
 * Basic example of using ak-diagnostic
 */

const { Diagnostics } = require('../index.js');

// Create diagnostics instance
const diagnostics = new Diagnostics({
  name: 'BasicExample',
  interval: 2000, // Sample every 2 seconds
  threshold: 100_000_000, // Alert if memory exceeds 100MB
  target: 50_000_000, // Target 50MB memory usage
  alert: (info) => {
    console.log('\n⚠️  Alert: Memory threshold exceeded!');
    console.log(`   Current: ${info.memory.formatted.current}`);
    console.log(`   Threshold: ${info.memory.formatted.threshold}`);
  }
});

console.log('Starting diagnostics example...\n');

// Start collecting diagnostics
diagnostics.start();

// Simulate some work with varying memory usage
let data = [];
let iteration = 0;

const interval = setInterval(() => {
  iteration++;
  console.log(`Iteration ${iteration}: Allocating memory...`);
  
  // Allocate some memory
  const chunk = Buffer.alloc(10_000_000); // 10MB
  data.push(chunk);
  
  // Sometimes clear memory
  if (iteration % 3 === 0) {
    console.log(`Iteration ${iteration}: Clearing some memory...`);
    data = data.slice(-2); // Keep only last 2 chunks
  }
  
  // Show current status
  const status = diagnostics.status();
  console.log(`  Status: ${status.samplesCollected} samples collected`);
  
  // Stop after 10 iterations
  if (iteration >= 10) {
    clearInterval(interval);
    
    // Stop diagnostics and get report
    diagnostics.stop();
    
    console.log('\n' + '='.repeat(60));
    console.log('DIAGNOSTIC REPORT');
    console.log('='.repeat(60) + '\n');
    
    const report = diagnostics.report();
    
    // Display summary
    console.log('📊 SUMMARY:');
    console.log(`  Duration: ${report.summary.duration}`);
    console.log(`  Peak Memory: ${report.summary.peakMemory}`);
    console.log(`  Average Memory: ${report.summary.averageMemory}`);
    console.log(`  Peak CPU: ${report.summary.peakCPU}`);
    console.log(`  Average CPU: ${report.summary.averageCPU}`);
    console.log(`  Total Samples: ${report.summary.samples}`);
    console.log(`  Alerts Triggered: ${report.summary.alerts}`);
    
    console.log('\n💾 MEMORY DETAILS:');
    console.log(`  Peak: ${report.memory.peak.human}`);
    console.log(`  Average: ${report.memory.average.human}`);
    console.log(`  Low: ${report.memory.low.human}`);
    
    console.log('\n🖥️  CPU DETAILS:');
    console.log(`  Peak: ${report.cpu.peak.human}`);
    console.log(`  Average: ${report.cpu.average.human}`);
    console.log(`  Low: ${report.cpu.low.human}`);
    
    console.log('\n⏱️  EVENT LOOP LAG:');
    console.log(`  Average: ${report.eventLoop.lag.average.human}`);
    console.log(`  Max: ${report.eventLoop.lag.max.human}`);
    
    console.log('\n📈 ANALYSIS:');
    console.log(`  Sampling Interval: ${report.analysis.samplingInterval}ms`);
    console.log(`  Time Over Target: ${report.analysis.timeOverTargetHuman}`);
    console.log(`  Time Under Target: ${report.analysis.timeUnderTargetHuman}`);
    
    if (report.analysis.target) {
      const percentOverTarget = (report.analysis.timeOverTarget / report.clock.duration) * 100;
      console.log(`  Percentage Over Target: ${percentOverTarget.toFixed(2)}%`);
    }
    
    console.log('\n💻 SYSTEM INFO:');
    console.log(`  Platform: ${report.infos.platform}`);
    console.log(`  Architecture: ${report.infos.arch}`);
    console.log(`  Node Version: ${report.infos.nodeVersion}`);
    console.log(`  V8 Version: ${report.infos.v8Version}`);
    console.log(`  CPUs: ${report.infos.cpus.length} cores`);
    console.log(`  Total System Memory: ${formatBytes(report.infos.totalMemory)}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('Example completed!');
    
    // Exit
    process.exit(0);
  }
}, 1000);

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}