/**
 * ak-diagnostic - Runtime diagnostic information collector for Node.js
 * @module ak-diagnostic
 */

const os = require('os');
const v8 = require('v8');
const { performance } = require('perf_hooks');

/**
 * Formats bytes to human readable string
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Formats milliseconds to human readable duration
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else if (seconds > 0) {
    return `${seconds}s`;
  } else {
    return `${ms}ms`;
  }
}

/**
 * Safely executes a function and returns null on error
 * @param {Function} fn
 * @param {*} defaultValue
 * @returns {*}
 */
function safeExecute(fn, defaultValue = null) {
  try {
    return fn();
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Memory snapshot data structure
 */
class MemorySnapshot {
  constructor() {
    const memUsage = process.memoryUsage();
    this.timestamp = Date.now();
    this.rss = memUsage.rss;
    this.heapTotal = memUsage.heapTotal;
    this.heapUsed = memUsage.heapUsed;
    this.external = memUsage.external;
    this.arrayBuffers = memUsage.arrayBuffers || 0;
  }

  get total() {
    return this.heapUsed;
  }
}

/**
 * CPU snapshot data structure
 */
class CPUSnapshot {
  constructor(previousUsage = null) {
    this.timestamp = Date.now();
    this.usage = process.cpuUsage();
    this.percentage = 0;

    if (previousUsage) {
      const timeDelta = this.timestamp - previousUsage.timestamp;
      const userDelta = this.usage.user - previousUsage.usage.user;
      const systemDelta = this.usage.system - previousUsage.usage.system;
      const totalDelta = userDelta + systemDelta;
      
      // CPU usage percentage calculation
      // totalDelta is in microseconds, timeDelta is in milliseconds
      this.percentage = (totalDelta / (timeDelta * 1000)) * 100;
    }
  }
}

/**
 * Event loop lag monitor
 */
class EventLoopMonitor {
  constructor() {
    this.samples = [];
    this.checkInterval = null;
  }

  start(interval = 100) {
    if (this.checkInterval) return;
    
    let lastCheck = performance.now();
    this.checkInterval = setInterval(() => {
      const now = performance.now();
      const actualDelay = now - lastCheck;
      const expectedDelay = interval;
      const lag = Math.max(0, actualDelay - expectedDelay);
      
      this.samples.push(lag);
      lastCheck = now;
    }, interval);
    
    // Don't block the process from exiting
    if (this.checkInterval.unref) {
      this.checkInterval.unref();
    }
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  getStats() {
    if (this.samples.length === 0) {
      return { average: 0, max: 0, min: 0 };
    }

    const sum = this.samples.reduce((a, b) => a + b, 0);
    return {
      average: sum / this.samples.length,
      max: Math.max(...this.samples),
      min: Math.min(...this.samples)
    };
  }
}

/**
 * Main Diagnostics class
 */
class Diagnostics {
  constructor(options = {}) {
    // Validate required options
    if (!options.name) {
      throw new Error('Diagnostics requires a "name" option');
    }

    // Set options with defaults
    this.name = options.name;
    this.interval = options.interval || 5000;
    this.threshold = options.threshold || null;
    this.alert = options.alert || (() => {});
    this.target = options.target || null;
    this.monitorEventLoop = options.monitorEventLoop !== false;

    // Internal state
    this.running = false;
    this.startTime = null;
    this.endTime = null;
    this.intervalHandle = null;
    this.memorySamples = [];
    this.cpuSamples = [];
    this.alertTriggerCount = 0;
    this.timeOverTarget = 0;
    this.lastTargetCheck = null;
    this.eventLoopMonitor = new EventLoopMonitor();
    
    // Collect initial system info
    this.systemInfo = this._collectSystemInfo();
  }

  /**
   * Collects static system information
   */
  _collectSystemInfo() {
    return safeExecute(() => ({
      // OS Information
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      cpus: os.cpus().map(cpu => ({
        model: cpu.model,
        speed: cpu.speed
      })),
      totalMemory: os.totalmem(),
      
      // Node.js Information
      nodeVersion: process.version,
      v8Version: process.versions.v8,
      modules: process.versions.modules,
      
      // Process Information
      pid: process.pid,
      ppid: process.ppid,
      execPath: process.execPath,
      argv: process.argv,
      execArgv: process.execArgv,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        NODE_OPTIONS: process.env.NODE_OPTIONS
      },
      
      // V8 Heap Statistics
      heapStatistics: v8.getHeapStatistics(),
      
      // Resource Limits (if available)
      resourceLimits: safeExecute(() => ({
        maxOldSpaceSize: v8.getHeapStatistics().heap_size_limit,
        maxSemiSpaceSize: v8.getHeapStatistics().malloced_memory,
        maxExecutableSize: v8.getHeapStatistics().peak_malloced_memory
      }), {})
    }), {});
  }

  /**
   * Takes a single sample of memory and CPU
   */
  _takeSample() {
    try {
      // Memory sample
      const memSample = new MemorySnapshot();
      this.memorySamples.push(memSample);

      // CPU sample
      const lastCpuSample = this.cpuSamples[this.cpuSamples.length - 1] || null;
      const cpuSample = new CPUSnapshot(lastCpuSample);
      this.cpuSamples.push(cpuSample);

      // Check threshold
      if (this.threshold && memSample.total > this.threshold) {
        this.alertTriggerCount++;
        safeExecute(() => {
          this.alert({
            type: 'threshold_exceeded',
            timestamp: Date.now(),
            memory: {
              current: memSample.total,
              threshold: this.threshold,
              formatted: {
                current: formatBytes(memSample.total),
                threshold: formatBytes(this.threshold)
              }
            },
            name: this.name
          });
        });
      }

      // Track time over/under target
      if (this.target) {
        const now = Date.now();
        if (this.lastTargetCheck) {
          const timeDelta = now - this.lastTargetCheck;
          if (memSample.total > this.target) {
            this.timeOverTarget += timeDelta;
          }
        }
        this.lastTargetCheck = now;
      }
    } catch (error) {
      // Silently ignore errors to not affect the host application
    }
  }

  /**
   * Starts the diagnostic collection
   */
  start() {
    if (this.running) {
      return this;
    }

    this.running = true;
    this.startTime = Date.now();
    this.memorySamples = [];
    this.cpuSamples = [];
    this.alertTriggerCount = 0;
    this.timeOverTarget = 0;
    this.lastTargetCheck = Date.now();

    // Take initial sample
    this._takeSample();

    // Start event loop monitoring
    if (this.monitorEventLoop) {
      this.eventLoopMonitor.start();
    }

    // Set up interval for periodic sampling
    this.intervalHandle = setInterval(() => {
      this._takeSample();
    }, this.interval);

    // Don't prevent the process from exiting
    if (this.intervalHandle.unref) {
      this.intervalHandle.unref();
    }

    return this;
  }

  /**
   * Stops the diagnostic collection
   */
  stop() {
    if (!this.running) {
      return this;
    }

    this.running = false;
    this.endTime = Date.now();

    // Take final sample
    this._takeSample();

    // Clear interval
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    // Stop event loop monitoring
    this.eventLoopMonitor.stop();

    return this;
  }

  /**
   * Calculates statistics from samples
   */
  _calculateStats(samples, accessor = (s) => s) {
    if (samples.length === 0) {
      return { peak: 0, average: 0, low: 0 };
    }

    const values = samples.map(accessor);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      peak: Math.max(...values),
      average: sum / values.length,
      low: Math.min(...values)
    };
  }

  /**
   * Generates the diagnostic report
   */
  report() {
    // Ensure we have stopped collecting
    if (this.running) {
      this.stop();
    }

    const duration = (this.endTime || Date.now()) - (this.startTime || Date.now());
    const timeUnderTarget = Math.max(0, duration - this.timeOverTarget);

    // Calculate memory statistics
    const memoryStats = this._calculateStats(this.memorySamples, s => s.total);
    const heapStats = this._calculateStats(this.memorySamples, s => s.heapUsed);
    const rssStats = this._calculateStats(this.memorySamples, s => s.rss);

    // Calculate CPU statistics
    const cpuStats = this._calculateStats(this.cpuSamples.slice(1), s => s.percentage);

    // Get event loop statistics
    const eventLoopStats = this.eventLoopMonitor.getStats();

    // Build the report object
    const report = {
      name: this.name,
      
      memory: {
        peak: {
          bytes: memoryStats.peak,
          human: formatBytes(memoryStats.peak)
        },
        average: {
          bytes: memoryStats.average,
          human: formatBytes(memoryStats.average)
        },
        low: {
          bytes: memoryStats.low,
          human: formatBytes(memoryStats.low)
        },
        heap: {
          peak: {
            bytes: heapStats.peak,
            human: formatBytes(heapStats.peak)
          },
          average: {
            bytes: heapStats.average,
            human: formatBytes(heapStats.average)
          },
          low: {
            bytes: heapStats.low,
            human: formatBytes(heapStats.low)
          }
        },
        rss: {
          peak: {
            bytes: rssStats.peak,
            human: formatBytes(rssStats.peak)
          },
          average: {
            bytes: rssStats.average,
            human: formatBytes(rssStats.average)
          },
          low: {
            bytes: rssStats.low,
            human: formatBytes(rssStats.low)
          }
        }
      },

      cpu: {
        peak: {
          percentage: cpuStats.peak,
          human: `${cpuStats.peak.toFixed(2)}%`
        },
        average: {
          percentage: cpuStats.average,
          human: `${cpuStats.average.toFixed(2)}%`
        },
        low: {
          percentage: cpuStats.low,
          human: `${cpuStats.low.toFixed(2)}%`
        }
      },

      eventLoop: {
        lag: {
          average: {
            ms: eventLoopStats.average,
            human: formatDuration(eventLoopStats.average)
          },
          max: {
            ms: eventLoopStats.max,
            human: formatDuration(eventLoopStats.max)
          },
          min: {
            ms: eventLoopStats.min,
            human: formatDuration(eventLoopStats.min)
          }
        }
      },

      infos: this.systemInfo,

      clock: {
        startTime: this.startTime,
        endTime: this.endTime,
        duration: duration,
        human: formatDuration(duration)
      },

      analysis: {
        numSamples: this.memorySamples.length,
        numOfAlertTriggers: this.alertTriggerCount,
        timeOverTarget: this.timeOverTarget,
        timeOverTargetHuman: formatDuration(this.timeOverTarget),
        timeUnderTarget: timeUnderTarget,
        timeUnderTargetHuman: formatDuration(timeUnderTarget),
        samplingInterval: this.interval,
        threshold: this.threshold ? {
          bytes: this.threshold,
          human: formatBytes(this.threshold)
        } : null,
        target: this.target ? {
          bytes: this.target,
          human: formatBytes(this.target)
        } : null
      },

      // Summary for quick overview
      summary: {
        duration: formatDuration(duration),
        peakMemory: formatBytes(memoryStats.peak),
        averageMemory: formatBytes(memoryStats.average),
        peakCPU: `${cpuStats.peak.toFixed(2)}%`,
        averageCPU: `${cpuStats.average.toFixed(2)}%`,
        samples: this.memorySamples.length,
        alerts: this.alertTriggerCount
      }
    };

    return report;
  }

  /**
   * Resets all collected data
   */
  reset() {
    this.stop();
    this.memorySamples = [];
    this.cpuSamples = [];
    this.alertTriggerCount = 0;
    this.timeOverTarget = 0;
    this.lastTargetCheck = null;
    this.startTime = null;
    this.endTime = null;
    return this;
  }

  /**
   * Gets current status
   */
  status() {
    return {
      running: this.running,
      name: this.name,
      samplesCollected: this.memorySamples.length,
      uptime: this.running ? Date.now() - this.startTime : 0
    };
  }
}

// ESM export wrapper
const exportObj = { Diagnostics };

// Support both CommonJS and ESM
if (typeof module !== 'undefined' && module.exports) {
  module.exports = exportObj;
  module.exports.Diagnostics = Diagnostics;
  module.exports.default = exportObj;
}

// For ESM environments
if (typeof exports !== 'undefined') {
  exports.Diagnostics = Diagnostics;
  exports.default = exportObj;
}