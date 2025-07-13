export class PerformanceUtils {
  private static measurements: Map<string, PerformanceMeasurement[]> = new Map()

  /**
   * Start performance measurement
   */
  public static startMeasurement(name: string): PerformanceTimer {
    const timer: PerformanceTimer = {
      name,
      startTime: performance.now(),
      startMemory: this.getMemoryUsage()
    }
    
    return timer
  }

  /**
   * End performance measurement
   */
  public static endMeasurement(timer: PerformanceTimer): PerformanceMeasurement {
    const endTime = performance.now()
    const endMemory = this.getMemoryUsage()
    
    const measurement: PerformanceMeasurement = {
      name: timer.name,
      duration: endTime - timer.startTime,
      memoryDelta: endMemory - timer.startMemory,
      timestamp: new Date()
    }
    
    // Store measurement
    const measurements = this.measurements.get(timer.name) || []
    measurements.push(measurement)
    this.measurements.set(timer.name, measurements.slice(-100)) // Keep last 100
    
    return measurement
  }

  /**
   * Get performance statistics
   */
  public static getStats(name?: string): PerformanceStats | Map<string, PerformanceStats> {
    if (name) {
      const measurements = this.measurements.get(name) || []
      return this.calculateStats(measurements)
    }
    
    const allStats = new Map<string, PerformanceStats>()
    for (const [measurementName, measurements] of this.measurements.entries()) {
      allStats.set(measurementName, this.calculateStats(measurements))
    }
    
    return allStats
  }

  /**
   * Clear performance data
   */
  public static clearStats(name?: string): void {
    if (name) {
      this.measurements.delete(name)
    } else {
      this.measurements.clear()
    }
  }

  /**
   * Benchmark a function
   */
  public static async benchmark<T>(
    name: string,
    fn: () => Promise<T> | T,
    iterations = 1
  ): Promise<BenchmarkResult<T>> {
    const results: T[] = []
    const durations: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const timer = this.startMeasurement(`${name}_iteration_${i}`)
      const result = await fn()
      const measurement = this.endMeasurement(timer)
      
      results.push(result)
      durations.push(measurement.duration)
    }
    
    return {
      name,
      iterations,
      results,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration: durations.reduce((a, b) => a + b, 0)
    }
  }

  private static calculateStats(measurements: PerformanceMeasurement[]): PerformanceStats {
    if (measurements.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        totalDuration: 0,
        avgMemoryDelta: 0
      }
    }
    
    const durations = measurements.map(m => m.duration)
    const memoryDeltas = measurements.map(m => m.memoryDelta)
    
    return {
      count: measurements.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration: durations.reduce((a, b) => a + b, 0),
      avgMemoryDelta: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length
    }
  }

  private static getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  }
}

interface PerformanceTimer {
  name: string
  startTime: number
  startMemory: number
}

interface PerformanceMeasurement {
  name: string
  duration: number
  memoryDelta: number
  timestamp: Date
}

interface PerformanceStats {
  count: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  totalDuration: number
  avgMemoryDelta: number
}

interface BenchmarkResult<T> {
  name: string
  iterations: number
  results: T[]
  avgDuration: number
  minDuration: number
  maxDuration: number
  totalDuration: number
}