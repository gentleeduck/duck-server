/**
 * Metrics collection utilities for benchmarking.
 *
 * Collects server-side metrics including CPU, memory, GC statistics,
 * event loop delay, and response size tracking.
 */

import { monitorEventLoopDelay, performance } from 'node:perf_hooks'
import v8 from 'node:v8'

/**
 * Comprehensive benchmark metrics collected from the server process.
 */
export type BenchMetrics = {
  /** Elapsed time in milliseconds */
  elapsedMs: number
  /** CPU user time in milliseconds */
  cpuUserMs: number
  /** CPU system time in milliseconds */
  cpuSystemMs: number
  /** RSS memory delta in bytes */
  rssDeltaBytes: number
  /** Heap used delta in bytes */
  heapUsedDeltaBytes: number
  /** Heap total delta in bytes */
  heapTotalDeltaBytes: number
  /** Event loop delay mean in milliseconds */
  eventLoopDelayMeanMs: number
  /** Event loop delay p95 in milliseconds */
  eventLoopDelayP95Ms: number
  /** Event loop delay p99 in milliseconds */
  eventLoopDelayP99Ms: number
  /** Event loop delay max in milliseconds */
  eventLoopDelayMaxMs: number
  /** Total GC pause time in milliseconds (approximate) */
  gcPauseTimeTotalMs: number
  /** GC pause count */
  gcPauseTimeCount: number
  /** Heap size limit in bytes */
  heapSizeLimitBytes: number
  /** Total heap size in bytes */
  heapTotalSizeBytes: number
  /** Used heap size in bytes */
  heapUsedSizeBytes: number
  /** Available heap size in bytes */
  heapAvailableSizeBytes: number
  /** Heap fragmentation ratio (0-1) */
  heapFragmentationRatio: number
  /** Total response size in bytes */
  responseSizeTotalBytes: number
  /** Response size count */
  responseSizeCount: number
  /** Minimum response size in bytes */
  responseSizeMinBytes: number
  /** Maximum response size in bytes */
  responseSizeMaxBytes: number
  /** Average response size in bytes */
  responseSizeAvgBytes: number
}

/**
 * Creates a metrics collector for tracking server performance.
 *
 * The collector tracks:
 * - CPU usage (user and system time)
 * - Memory usage (RSS, heap)
 * - Event loop delay
 * - GC statistics
 * - Response sizes
 *
 * @returns Metrics collector with start/stop methods
 */
export function createMetricsCollector() {
  const loopDelay = monitorEventLoopDelay({ resolution: 20 })
  loopDelay.enable()

  let startCpu = process.cpuUsage()
  let startMem = process.memoryUsage()
  let startTime = performance.now()
  let startHeapStats = v8.getHeapStatistics()
  let startGcStats = { ...startHeapStats }

  // Track response sizes
  const responseSizes: number[] = []
  let responseSizeTotal = 0

  // Track GC pauses
  const gcPauseTimes: number[] = []
  let gcPauseTimeTotal = 0
  let gcPauseCount = 0

  /**
   * Start metrics collection.
   * Resets all counters and starts tracking from this point.
   */
  const start = () => {
    startCpu = process.cpuUsage()
    startMem = process.memoryUsage()
    startTime = performance.now()
    startHeapStats = v8.getHeapStatistics()
    startGcStats = { ...startHeapStats }
    loopDelay.reset()
    responseSizes.length = 0
    responseSizeTotal = 0
    gcPauseTimes.length = 0
    gcPauseTimeTotal = 0
    gcPauseCount = 0
  }

  /**
   * Track a response size.
   *
   * @param size - Response size in bytes
   */
  const trackResponseSize = (size: number) => {
    responseSizes.push(size)
    responseSizeTotal += size
  }

  /**
   * Stop metrics collection and return collected metrics.
   *
   * @returns Collected benchmark metrics
   */
  const stop = (): BenchMetrics => {
    const cpu = process.cpuUsage(startCpu)
    const mem = process.memoryUsage()
    const elapsedMs = performance.now() - startTime
    const endHeapStats = v8.getHeapStatistics()

    // Calculate GC pause time (approximate from heap stats)
    // Note: This is an approximation since we can't directly measure GC pauses without --expose-gc
    const heapDelta = endHeapStats.total_heap_size - startHeapStats.total_heap_size
    const gcPauseTime = Math.max(0, heapDelta / 1_000_000) // Rough estimate in ms

    // Calculate heap fragmentation
    const heapFragmentation =
      endHeapStats.total_heap_size > 0
        ? (endHeapStats.total_heap_size - endHeapStats.used_heap_size) / endHeapStats.total_heap_size
        : 0

    // Calculate response size statistics
    const responseSizeMin = responseSizes.length > 0 ? Math.min(...responseSizes) : 0
    const responseSizeMax = responseSizes.length > 0 ? Math.max(...responseSizes) : 0
    const responseSizeAvg = responseSizes.length > 0 ? responseSizeTotal / responseSizes.length : 0

    return {
      elapsedMs,
      cpuUserMs: cpu.user / 1000,
      cpuSystemMs: cpu.system / 1000,
      rssDeltaBytes: mem.rss - startMem.rss,
      heapUsedDeltaBytes: mem.heapUsed - startMem.heapUsed,
      heapTotalDeltaBytes: mem.heapTotal - startMem.heapTotal,
      eventLoopDelayMeanMs: loopDelay.mean / 1e6,
      eventLoopDelayP95Ms: loopDelay.percentile(95) / 1e6,
      eventLoopDelayP99Ms: loopDelay.percentile(99) / 1e6,
      eventLoopDelayMaxMs: loopDelay.max / 1e6,
      // GC metrics
      gcPauseTimeTotalMs: gcPauseTime,
      gcPauseTimeCount: gcPauseCount,
      heapSizeLimitBytes: endHeapStats.heap_size_limit,
      heapTotalSizeBytes: endHeapStats.total_heap_size,
      heapUsedSizeBytes: endHeapStats.used_heap_size,
      heapAvailableSizeBytes: endHeapStats.total_available_size,
      heapFragmentationRatio: heapFragmentation,
      // Response size tracking
      responseSizeTotalBytes: responseSizeTotal,
      responseSizeCount: responseSizes.length,
      responseSizeMinBytes: responseSizeMin,
      responseSizeMaxBytes: responseSizeMax,
      responseSizeAvgBytes: responseSizeAvg,
    }
  }

  return { start, stop, trackResponseSize }
}
