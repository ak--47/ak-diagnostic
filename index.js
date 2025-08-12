/**
 * ak-diagnostic - Runtime diagnostic information collector for Node.js
 * @module ak-diagnostic
 */

const os = require('os');
const v8 = require('v8');
const { performance } = require('perf_hooks');

/**
 * Formats bytes to human readable string with appropriate units
 * @param {number} bytes - The number of bytes to format
 * @returns {string} Human-readable string with units (B, KB, MB, GB, TB)
 * @example
 * formatBytes(1024) // Returns "1.00 KB"
 * formatBytes(1536) // Returns "1.50 KB"
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Formats milliseconds to human readable duration string
 * @param {number} ms - The number of milliseconds to format
 * @returns {string} Human-readable duration string (e.g., "1m 30s", "2h 15m")
 * @example
 * formatDuration(90000) // Returns "1m 30s"
 * formatDuration(3661000) // Returns "1h 1m 1s"
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
 * Safely executes a function and returns a default value on error
 * @param {Function} fn - The function to execute safely
 * @param {*} [defaultValue=null] - The value to return if execution fails
 * @returns {*} The result of the function or the default value
 * @example
 * safeExecute(() => JSON.parse('{'), {}) // Returns {} instead of throwing
 */
function safeExecute(fn, defaultValue = null) {
  try {
    return fn();
  } catch {
    return defaultValue;
  }
}

/**
 * Captures a point-in-time snapshot of memory usage
 * @class MemorySnapshot
 */
class MemorySnapshot {
  /**
   * Creates a new memory snapshot with current memory usage
   * @constructor
   */
  constructor() {
    const memUsage = process.memoryUsage();
    /** @type {number} Timestamp when snapshot was taken */
    this.timestamp = Date.now();
    /** @type {number} Resident Set Size - total memory allocated */
    this.rss = memUsage.rss;
    /** @type {number} Total heap size allocated */
    this.heapTotal = memUsage.heapTotal;
    /** @type {number} Heap memory currently used */
    this.heapUsed = memUsage.heapUsed;
    /** @type {number} Memory used by C++ objects bound to JavaScript */
    this.external = memUsage.external;
    /** @type {number} Memory used by ArrayBuffer and SharedArrayBuffer */
    this.arrayBuffers = memUsage.arrayBuffers || 0;
  }

  /**
   * Gets the total memory used (alias for heapUsed)
   * @returns {number} The total memory used in bytes
   */
  get total() {
    return this.heapUsed;
  }
}

/**
 * Captures CPU usage metrics and calculates percentage usage
 * @class CPUSnapshot
 */
class CPUSnapshot {
  /**
   * Creates a new CPU usage snapshot and calculates percentage if previous snapshot provided
   * @constructor
   * @param {CPUSnapshot|null} [previousUsage=null] - Previous CPU snapshot for calculating percentage
   */
  constructor(previousUsage = null) {
    /** @type {number} Timestamp when snapshot was taken */
    this.timestamp = Date.now();
    /** @type {object} Raw CPU usage from process.cpuUsage() */
    this.usage = process.cpuUsage();
    /** @type {number} CPU usage percentage (0-100+) */
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
 * Monitors and tracks event loop lag to detect blocking operations
 * @class EventLoopMonitor
 */
class EventLoopMonitor {
  /**
   * Creates a new event loop monitor
   * @constructor
   */
  constructor() {
    /** @type {number[]} Array of lag measurements in milliseconds */
    this.samples = [];
    /** @type {NodeJS.Timeout|null} Interval handle for monitoring */
    this.checkInterval = null;
  }

  /**
   * Starts monitoring event loop lag
   * @param {number} [interval=100] - Check interval in milliseconds
   */
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

  /**
   * Stops monitoring event loop lag
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Calculates statistics from collected lag samples
   * @returns {{average: number, max: number, min: number}} Lag statistics in milliseconds
   */
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
 * Main Diagnostics class for collecting runtime performance metrics
 * @class Diagnostics
 */
class Diagnostics {
  /**
   * Creates a new Diagnostics instance for monitoring runtime performance
   * @constructor
   * @param {object} [options={}] - Configuration options
   * @param {string} options.name - Required label/identifier for this diagnostic session
   * @param {number} [options.interval=5000] - Sampling interval in milliseconds
   * @param {number} [options.threshold] - Memory threshold in bytes for triggering alerts
   * @param {function} [options.alert] - Callback function when threshold is exceeded
   * @param {number} [options.target] - Target memory consumption in bytes for tracking
   * @param {boolean} [options.monitorEventLoop=true] - Whether to monitor event loop lag
   * @throws {Error} When name option is not provided
   * @example
   * const diagnostics = new Diagnostics({
   *   name: 'MyApp',
   *   interval: 3000,
   *   threshold: 500_000_000,
   *   alert: (info) => console.log('Memory alert!', info)
   * });
   */
  constructor(options = {}) {
    // Validate required options
    if (!options.name) {
      throw new Error('Diagnostics requires a "name" option');
    }

    // Set options with defaults
    /** @type {string} Label for this diagnostic session */
    this.name = options.name;
    /** @type {number} Sampling interval in milliseconds */
    this.interval = options.interval || 5000;
    /** @type {number|null} Memory threshold in bytes for alerts */
    this.threshold = options.threshold || null;
    /** @type {function} Alert callback function */
    this.alert = options.alert || (() => {});
    /** @type {number|null} Target memory consumption in bytes */
    this.target = options.target || null;
    /** @type {boolean} Whether to monitor event loop lag */
    this.monitorEventLoop = options.monitorEventLoop !== false;

    // Internal state
    /** @type {boolean} Whether diagnostics collection is currently running */
    this.running = false;
    /** @type {number|null} Timestamp when collection started */
    this.startTime = null;
    /** @type {number|null} Timestamp when collection ended */
    this.endTime = null;
    /** @type {NodeJS.Timeout|null} Interval handle for periodic sampling */
    this.intervalHandle = null;
    /** @type {MemorySnapshot[]} Array of collected memory snapshots */
    this.memorySamples = [];
    /** @type {CPUSnapshot[]} Array of collected CPU snapshots */
    this.cpuSamples = [];
    /** @type {number} Count of times threshold alert was triggered */
    this.alertTriggerCount = 0;
    /** @type {number} Total time spent over target memory */
    this.timeOverTarget = 0;
    /** @type {number|null} Last timestamp for target tracking */
    this.lastTargetCheck = null;
    /** @type {EventLoopMonitor} Event loop lag monitor instance */
    this.eventLoopMonitor = new EventLoopMonitor();

    // Collect initial system info
    /** @type {object} Static system information */
    this.systemInfo = this._collectSystemInfo();
  }

  /**
   * Collects static system information including OS, Node.js, and process details
   * @private
   * @returns {object} System information object
   */
  _collectSystemInfo() {
    return safeExecute(
      () => ({
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
        resourceLimits: safeExecute(
          () => ({
            maxOldSpaceSize: v8.getHeapStatistics().heap_size_limit,
            maxSemiSpaceSize: v8.getHeapStatistics().malloced_memory,
            maxExecutableSize: v8.getHeapStatistics().peak_malloced_memory
          }),
          {}
        )
      }),
      {}
    );
  }

  /**
   * Takes a single sample of memory and CPU usage, checks thresholds and tracks targets
   * @private
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
    } catch {
      // Silently ignore errors to not affect the host application
    }
  }

  /**
   * Starts the diagnostic collection process
   * @returns {Diagnostics} Returns this instance for method chaining
   * @example
   * diagnostics.start();
   * // Collection begins immediately
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
   * Stops the diagnostic collection process
   * @returns {Diagnostics} Returns this instance for method chaining
   * @example
   * diagnostics.stop();
   * // Collection ends, ready for report generation
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
   * Calculates statistical metrics (peak, average, low) from sample arrays
   * @private
   * @param {Array} samples - Array of sample objects
   * @param {function(any): number} [accessor] - Function to extract value from each sample
   * @returns {{peak: number, average: number, low: number}} Statistical metrics
   */
  _calculateStats(samples, accessor = s => s) {
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
   * Generates a comprehensive diagnostic report with all collected metrics
   * Automatically stops collection if still running
   * @returns {object} Complete diagnostic report with memory, CPU, timing, and analysis data
   * @example
   * const report = diagnostics.report();
   * console.log(`Peak memory: ${report.memory.peak.human}`);
   * console.log(`Duration: ${report.clock.human}`);
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
        threshold: this.threshold
          ? {
              bytes: this.threshold,
              human: formatBytes(this.threshold)
            }
          : null,
        target: this.target
          ? {
              bytes: this.target,
              human: formatBytes(this.target)
            }
          : null
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
   * Resets all collected data and stops collection if running
   * @returns {Diagnostics} Returns this instance for method chaining
   * @example
   * diagnostics.reset().start(); // Reset and start fresh collection
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
   * Gets current status information about the diagnostics collection
   * @returns {{running: boolean, name: string, samplesCollected: number, uptime: number}} Status object
   * @example
   * const status = diagnostics.status();
   * console.log(`Running: ${status.running}, Samples: ${status.samplesCollected}`);
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
