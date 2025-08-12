declare module 'ak-diagnostic' {
  /**
   * Alert callback function type
   */
  type AlertCallback = (info: AlertInfo) => void;

  /**
   * Alert information passed to the alert callback
   */
  interface AlertInfo {
    type: string;
    timestamp: number;
    memory: {
      current: number;
      threshold: number;
      formatted: {
        current: string;
        threshold: string;
      };
    };
    name: string;
  }

  /**
   * Options for Diagnostics constructor
   */
  interface DiagnosticsOptions {
    /** A label/symbol for the job (required) */
    name: string;
    /** How frequently to take memory snapshots in milliseconds (default: 5000) */
    interval?: number;
    /** Memory threshold in bytes before firing an alert (default: none) */
    threshold?: number;
    /** Function callback when threshold is reached (default: noop) */
    alert?: AlertCallback;
    /** Target memory consumption in bytes (default: none) */
    target?: number;
    /** Whether to monitor event loop lag (default: true) */
    monitorEventLoop?: boolean;
  }

  /**
   * Statistical metric with raw and human-readable values
   */
  interface Metric {
    bytes?: number;
    percentage?: number;
    ms?: number;
    human: string;
  }

  /**
   * Memory statistics
   */
  interface MemoryStats {
    peak: Metric;
    average: Metric;
    low: Metric;
  }

  /**
   * CPU statistics
   */
  interface CPUStats {
    peak: Metric;
    average: Metric;
    low: Metric;
  }

  /**
   * System information
   */
  interface SystemInfo {
    platform: string;
    arch: string;
    release: string;
    hostname: string;
    cpus: Array<{
      model: string;
      speed: number;
    }>;
    totalMemory: number;
    nodeVersion: string;
    v8Version: string;
    modules: string;
    pid: number;
    ppid: number;
    execPath: string;
    argv: string[];
    execArgv: string[];
    env: {
      NODE_ENV?: string;
      NODE_OPTIONS?: string;
    };
    heapStatistics: any;
    resourceLimits: any;
  }

  /**
   * Diagnostic report
   */
  interface DiagnosticReport {
    name: string;
    memory: {
      peak: Metric;
      average: Metric;
      low: Metric;
      heap: MemoryStats;
      rss: MemoryStats;
    };
    cpu: CPUStats;
    eventLoop: {
      lag: {
        average: Metric;
        max: Metric;
        min: Metric;
      };
    };
    infos: SystemInfo;
    clock: {
      startTime: number;
      endTime: number;
      duration: number;
      human: string;
    };
    analysis: {
      numSamples: number;
      numOfAlertTriggers: number;
      timeOverTarget: number;
      timeOverTargetHuman: string;
      timeUnderTarget: number;
      timeUnderTargetHuman: string;
      samplingInterval: number;
      threshold: Metric | null;
      target: Metric | null;
    };
    summary: {
      duration: string;
      peakMemory: string;
      averageMemory: string;
      peakCPU: string;
      averageCPU: string;
      samples: number;
      alerts: number;
    };
  }

  /**
   * Status information
   */
  interface DiagnosticsStatus {
    running: boolean;
    name: string;
    samplesCollected: number;
    uptime: number;
  }

  /**
   * Main Diagnostics class for collecting runtime diagnostic information
   */
  export class Diagnostics {
    constructor(options: DiagnosticsOptions);
    
    /** Starts the diagnostic collection */
    start(): Diagnostics;
    
    /** Stops the diagnostic collection */
    stop(): Diagnostics;
    
    /** Generates the diagnostic report */
    report(): DiagnosticReport;
    
    /** Resets all collected data */
    reset(): Diagnostics;
    
    /** Gets current status */
    status(): DiagnosticsStatus;
  }

  export default { Diagnostics };
}