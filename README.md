# ak-diagnostic

A lightweight, zero-dependency Node.js diagnostic tool for monitoring runtime performance, memory usage, and system metrics with minimal overhead.

## Features

- 🚀 **Zero Dependencies** - Uses only Node.js built-in modules
- 📊 **Comprehensive Metrics** - Memory, CPU, event loop lag, and system information
- 🎯 **Low Overhead** - Designed to add minimal performance impact
- 🔔 **Threshold Alerts** - Get notified when memory usage exceeds limits
- 📈 **Statistical Analysis** - Peak, average, and low values for all metrics
- 🔄 **ESM & CommonJS** - Full support for both module systems
- 📝 **TypeScript Support** - Complete type definitions included
- 🛡️ **Error Resilient** - Won't crash your application

## Installation

```bash
npm install ak-diagnostic
```

## Quick Start

### ESM (ES Modules)

```javascript
import { Diagnostics }
```

## Examples

### Basic Usage

```javascript
import { Diagnostics } from 'ak-diagnostic';

const diagnostics = new Diagnostics({
  name: 'DataProcessor',
  interval: 2000 // Sample every 2 seconds
});

diagnostics.start();

// Simulate some work
const data = await processLargeDataset();
await transformData(data);
await saveResults(data);

const report = diagnostics.report();

console.log('Performance Report:');
console.log(`Duration: ${report.summary.duration}`);
console.log(`Peak Memory: ${report.summary.peakMemory}`);
console.log(`Average CPU: ${report.summary.averageCPU}`);
console.log(`Samples Collected: ${report.summary.samples}`);
```

### Memory Threshold Monitoring

```javascript
import { Diagnostics } from 'ak-diagnostic';

const diagnostics = new Diagnostics({
  name: 'MemoryIntensiveApp',
  interval: 1000,
  threshold: 200_000_000, // Alert if memory exceeds 200MB
  alert: info => {
    console.warn(`⚠️ Memory threshold exceeded!`);
    console.warn(`Current: ${info.memory.formatted.current}`);
    console.warn(`Threshold: ${info.memory.formatted.threshold}`);

    // Could trigger cleanup, send metrics, etc.
    performEmergencyCleanup();
  }
});

diagnostics.start();

// Your memory-intensive operations
await processImages();
await generateReports();

const report = diagnostics.report();
console.log(`Alert triggered ${report.analysis.numOfAlertTriggers} times`);
```

### Target Memory Tracking

```javascript
import { Diagnostics } from 'ak-diagnostic';

const diagnostics = new Diagnostics({
  name: 'OptimizedApp',
  interval: 5000,
  target: 50_000_000 // Target 50MB memory usage
});

diagnostics.start();

// Run your application
await runApplication();

const report = diagnostics.report();

console.log('Memory Target Analysis:');
console.log(`Time over target: ${report.analysis.timeOverTargetHuman}`);
console.log(`Time under target: ${report.analysis.timeUnderTargetHuman}`);

const percentOverTarget = (report.analysis.timeOverTarget / report.clock.duration) * 100;
console.log(`Percentage of time over target: ${percentOverTarget.toFixed(2)}%`);
```

### Production Monitoring

```javascript
import { Diagnostics } from 'ak-diagnostic';
import fs from 'fs/promises';

const diagnostics = new Diagnostics({
  name: 'ProductionAPI',
  interval: 10000, // Sample every 10 seconds
  threshold: 1_000_000_000, // 1GB threshold
  alert: async info => {
    // Log to monitoring service
    await sendToMonitoring({
      event: 'memory_threshold_exceeded',
      timestamp: info.timestamp,
      memory: info.memory.current,
      app: info.name
    });
  }
});

// Start monitoring when server starts
diagnostics.start();

// Periodic reporting
setInterval(async () => {
  const report = diagnostics.report();

  // Save report to file
  await fs.writeFile(`./logs/diagnostics-${Date.now()}.json`, JSON.stringify(report, null, 2));

  // Send summary to monitoring dashboard
  await sendMetrics({
    memory: report.memory.average.bytes,
    cpu: report.cpu.average.percentage,
    eventLoopLag: report.eventLoop.lag.average.ms,
    alerts: report.analysis.numOfAlertTriggers
  });

  // Reset for next period
  diagnostics.reset().start();
}, 3600000); // Every hour
```

### Express.js Middleware

```javascript
import express from 'express';
import { Diagnostics } from 'ak-diagnostic';

const app = express();
const diagnostics = new Diagnostics({
  name: 'ExpressAPI',
  interval: 5000
});

// Start diagnostics when server starts
diagnostics.start();

// Endpoint to get current diagnostics
app.get('/diagnostics', (req, res) => {
  const report = diagnostics.report();
  diagnostics.reset().start(); // Reset after reporting

  res.json({
    status: 'healthy',
    uptime: report.clock.human,
    memory: {
      current: report.memory.average.human,
      peak: report.memory.peak.human
    },
    cpu: {
      average: report.cpu.average.human,
      peak: report.cpu.peak.human
    },
    eventLoop: {
      avgLag: report.eventLoop.lag.average.human,
      maxLag: report.eventLoop.lag.max.human
    },
    samples: report.analysis.numSamples
  });
});

app.listen(3000);
```

## Best Practices

### 1. Sampling Interval

- **Development**: 1-2 seconds for detailed monitoring
- **Production**: 5-10 seconds to minimize overhead
- **Long-running tasks**: 30-60 seconds for extended operations

### 2. Memory Thresholds

Set thresholds based on your application's expected memory usage:

```javascript
// For a typical web server
threshold: 500_000_000; // 500MB

// For data processing applications
threshold: 2_000_000_000; // 2GB

// For microservices
threshold: 200_000_000; // 200MB
```

### 3. Alert Handling

Keep alert handlers lightweight and non-blocking:

```javascript
alert: info => {
  // Good: Quick, non-blocking operations
  console.error('Memory threshold exceeded');
  metrics.increment('memory.alerts');

  // Avoid: Heavy operations in alert handler
  // Don't do: await saveToDatabase(info);
  // Instead, queue it for processing
  alertQueue.push(info);
};
```

### 4. Cleanup

Always stop diagnostics when your application shuts down:

```javascript
process.on('SIGTERM', () => {
  diagnostics.stop();
  const finalReport = diagnostics.report();
  console.log('Final diagnostics:', finalReport.summary);
  process.exit(0);
});
```

## Performance Impact

`ak-diagnostic` is designed for minimal overhead:

- **Memory**: ~1-2KB per sample (depending on system info cached)
- **CPU**: <0.1% for default 5-second sampling
- **Event Loop**: Sampling operations are synchronous and fast
- **No Dependencies**: Zero external packages means minimal footprint

## Requirements

- Node.js >= 12.0.0
- No external dependencies required

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import { Diagnostics, DiagnosticReport, DiagnosticsOptions } from 'ak-diagnostic';

const options: DiagnosticsOptions = {
  name: 'TypedApp',
  interval: 5000,
  threshold: 100_000_000
};

const diagnostics = new Diagnostics(options);
diagnostics.start();

// ... your code ...

const report: DiagnosticReport = diagnostics.report();
```

## Troubleshooting

### Q: The diagnostics seem to be missing samples

**A:** Ensure your application isn't blocking the event loop. Long synchronous operations can prevent sampling intervals from firing.

### Q: Memory measurements seem incorrect

**A:** The tool measures heap memory by default. For total process memory, check `report.memory.rss` values.

### Q: CPU percentages exceed 100%

**A:** On multi-core systems, CPU percentage can exceed 100% if your application uses multiple cores. This is normal behavior.

### Q: Event loop lag is consistently high

**A:** This indicates your application has blocking operations. Consider using worker threads or async operations for CPU-intensive tasks.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

Made with ❤️ for the Node.js community from 'ak-diagnostic';

const diagnostics = new Diagnostics({
name: 'MyApp',
interval: 3000 // Sample every 3 seconds
});

diagnostics.start();

// Your application code here
await someHeavyOperation();

diagnostics.stop();

const report = diagnostics.report();
console.log(report.summary);

````

### CommonJS

```javascript
const { Diagnostics } = require('ak-diagnostic');

const diagnostics = new Diagnostics({
  name: 'MyApp',
  interval: 3000
});

diagnostics.start();

// Your application code here
someHeavyOperation(() => {
  diagnostics.stop();
  const report = diagnostics.report();
  console.log(report.summary);
});
````

## API Reference

### Constructor Options

```javascript
const diagnostics = new Diagnostics({
  name: 'MyApp', // Required: A label for the diagnostic session
  interval: 5000, // Optional: Sampling interval in ms (default: 5000)
  threshold: 500_000_000, // Optional: Memory threshold in bytes for alerts
  target: 100_000_000, // Optional: Target memory consumption in bytes
  alert: info => {
    // Optional: Callback when threshold is exceeded
    console.log('Alert!', info);
  },
  monitorEventLoop: true // Optional: Monitor event loop lag (default: true)
});
```

### Methods

#### `start()`

Begins collecting diagnostic data.

```javascript
diagnostics.start();
```

#### `stop()`

Stops collecting diagnostic data.

```javascript
diagnostics.stop();
```

#### `report()`

Generates a comprehensive diagnostic report with all collected metrics.

```javascript
const report = diagnostics.report();
```

#### `reset()`

Clears all collected data and resets the diagnostics instance.

```javascript
diagnostics.reset();
```

#### `status()`

Returns the current status of the diagnostics collector.

```javascript
const status = diagnostics.status();
// { running: true, name: 'MyApp', samplesCollected: 42, uptime: 126000 }
```

## Report Structure

The `report()` method returns a comprehensive object with the following structure:

```javascript
{
  name: 'MyApp',

  // Memory statistics (heapUsed)
  memory: {
    peak: { bytes: 104857600, human: '100.00 MB' },
    average: { bytes: 52428800, human: '50.00 MB' },
    low: { bytes: 31457280, human: '30.00 MB' },

    // Heap memory details
    heap: {
      peak: { bytes: 104857600, human: '100.00 MB' },
      average: { bytes: 52428800, human: '50.00 MB' },
      low: { bytes: 31457280, human: '30.00 MB' }
    },

    // Resident Set Size (total memory allocated)
    rss: {
      peak: { bytes: 157286400, human: '150.00 MB' },
      average: { bytes: 134217728, human: '128.00 MB' },
      low: { bytes: 104857600, human: '100.00 MB' }
    }
  },

  // CPU usage statistics
  cpu: {
    peak: { percentage: 45.67, human: '45.67%' },
    average: { percentage: 22.34, human: '22.34%' },
    low: { percentage: 5.12, human: '5.12%' }
  },

  // Event loop lag statistics
  eventLoop: {
    lag: {
      average: { ms: 2.5, human: '2ms' },
      max: { ms: 15.3, human: '15ms' },
      min: { ms: 0.1, human: '0ms' }
    }
  },

  // System information
  infos: {
    platform: 'darwin',
    arch: 'arm64',
    nodeVersion: 'v18.17.0',
    v8Version: '10.2.154.26',
    cpus: [...],
    totalMemory: 17179869184,
    // ... more system details
  },

  // Timing information
  clock: {
    startTime: 1699123456789,
    endTime: 1699123556789,
    duration: 100000,
    human: '1m 40s'
  },

  // Analysis metrics
  analysis: {
    numSamples: 20,
    numOfAlertTriggers: 3,
    timeOverTarget: 45000,
    timeOverTargetHuman: '45s',
    timeUnderTarget: 55000,
    timeUnderTargetHuman: '55s',
    samplingInterval: 5000,
    threshold: { bytes: 500000000, human: '476.84 MB' },
    target: { bytes: 100000000, human: '95.37 MB' }
  },

  // Quick summary for overview
  summary: {
    duration: '1m 40s',
    peakMemory: '100.00 MB',
    averageMemory: '50.00 MB',
    peakCPU: '45.67%',
    averageCPU: '22.34%',
    samples: 20,
    alerts: 3
  }
}
```
