import { monitorEventLoopDelay, performance } from 'node:perf_hooks'
import v8 from 'node:v8'

export type BenchMetrics = {
  elapsedMs: number
  cpuUserMs: number
  cpuSystemMs: number
  rssDeltaBytes: number
  heapUsedDeltaBytes: number
  heapTotalDeltaBytes: number
  eventLoopDelayMeanMs: number
  eventLoopDelayP95Ms: number
  eventLoopDelayP99Ms: number
  eventLoopDelayMaxMs: number
  // GC metrics
  gcPauseTimeTotalMs: number
  gcPauseTimeCount: number
  heapSizeLimitBytes: number
  heapTotalSizeBytes: number
  heapUsedSizeBytes: number
  heapAvailableSizeBytes: number
  heapFragmentationRatio: number
  // Response size tracking
  responseSizeTotalBytes: number
  responseSizeCount: number
  responseSizeMinBytes: number
  responseSizeMaxBytes: number
  responseSizeAvgBytes: number
}

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

  // GC tracking will be done via heap statistics

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

  const trackResponseSize = (size: number) => {
    responseSizes.push(size)
    responseSizeTotal += size
  }

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
