import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import autocannon from 'autocannon'
import { buildAllOptimizationScenarios } from './scenarios/optimization-scenarios'
import { type BenchInput, generateStandardPayloads } from './scenarios/payloads/payload-generators'
import { type BenchmarkScenario, buildScenarios, LOAD_PATTERNS, type LoadPattern } from './scenarios/scenario-builder'
import { validateBenchmarkRun, validateComparison } from './utils/benchmark-validator'
import type { BenchMetrics } from './utils/metrics'
import { smokeTest } from './utils/smoke-test'
import { coefficientOfVariation, confidenceInterval95, mean } from './utils/statistics'
import { runValidatedLoadTest } from './utils/validated-load-test'

type Scenario = BenchmarkScenario

export type Framework = {
  name: 'duck' | 'trpc'
  port: number
  entry: string
  supportsCbor: boolean
}

type RunResult = {
  framework: string
  scenario: string
  loadPattern: string
  connections: number
  pipelining: number
  autocannon: autocannon.Result
  server: BenchMetrics
  responseSizeBytes?: number
  validity: {
    valid: boolean
    totalRequests: number
    successCount: number
    failCount: number
    failRate: number // percentage
    errorBreakdown: Map<string, number> // error signature -> count
    httpStatusBreakdown: Map<number, number> // status code -> count
    topErrors: Array<{ signature: string; count: number }> // Top 5
    responseSizeBytesAvg?: number
  }
  metrics: {
    reqsPerSec: number // Only successful requests
    latencyP50: number
    latencyP99: number
    latencyP50CI?: [number, number]
    latencyP99CI?: [number, number]
    reqsPerSecCI?: [number, number]
    reqsPerSecCV?: number
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Configuration
const defaultConnections = readNumber('BENCH_CONNECTIONS', 64)
const defaultDuration = readNumber('BENCH_DURATION', 20)
const defaultPipelining = readNumber('BENCH_PIPELINING', 1)
const defaultWarmup = readNumber('BENCH_WARMUP', 5)
const defaultLoadPattern = readString('BENCH_LOAD_PATTERN', 'sustained')
const defaultIterations = readNumber('BENCH_ITERATIONS', 3) // Multiple runs for statistical validity

const argMap = readArgs(process.argv.slice(2))
const connections = readArgNumber(argMap, 'connections', defaultConnections)
const duration = readArgNumber(argMap, 'duration', defaultDuration)
const pipelining = readArgNumber(argMap, 'pipelining', defaultPipelining)
const warmup = readArgNumber(argMap, 'warmup', defaultWarmup)
const iterations = readArgNumber(argMap, 'iterations', defaultIterations)
const outputPath = argMap.get('output')
const loadPatternName = argMap.get('load-pattern') ?? defaultLoadPattern
const skipValidation = argMap.has('skip-validation')

const scenarioFilter = parseFilter(argMap.get('scenario'))
const frameworkFilter = parseFilter(argMap.get('framework'))
const formatFilter = parseFilter(argMap.get('format'))
const validationFilter = parseFilter(argMap.get('validation'))

// Generate payloads and build scenarios
const payloads = generateStandardPayloads()
const baseScenarios = buildScenarios(payloads)
const optimizationScenarios = buildAllOptimizationScenarios()
const allScenarios = [...baseScenarios, ...optimizationScenarios]

const scenarios = allScenarios.filter((scenario) => {
  if (scenarioFilter && !matchesFilter(scenarioFilter, scenario.name)) return false
  if (formatFilter && scenario.format && !matchesFilter(formatFilter, scenario.format)) return false
  if (validationFilter && scenario.validation && !matchesFilter(validationFilter, scenario.validation)) return false
  return true
})

// Load patterns - use pre-defined patterns, override with custom values if provided
const selectedLoadPattern: LoadPattern =
  loadPatternName && LOAD_PATTERNS[loadPatternName]
    ? {
        ...LOAD_PATTERNS[loadPatternName],
        connections: connections !== defaultConnections ? [connections] : LOAD_PATTERNS[loadPatternName].connections,
        pipelining: pipelining !== defaultPipelining ? [pipelining] : LOAD_PATTERNS[loadPatternName].pipelining,
        duration: duration !== defaultDuration ? duration : LOAD_PATTERNS[loadPatternName].duration,
      }
    : {
        name: 'sustained',
        connections: [connections],
        pipelining: [pipelining],
        duration,
      }

// Frameworks
const frameworks = [
  {
    name: 'duck' as const,
    port: readNumber('DUCK_PORT', 4001),
    entry: path.join(__dirname, 'duck-server.ts'),
    supportsCbor: true,
  },
  {
    name: 'trpc' as const,
    port: readNumber('TRPC_PORT', 4002),
    entry: path.join(__dirname, 'trpc-server.ts'),
    supportsCbor: false,
  },
].filter((framework) => {
  if (frameworkFilter && !matchesFilter(frameworkFilter, framework.name)) return false
  return true
}) as Framework[]

// Filter scenarios based on framework capabilities
const validScenarios = scenarios.filter((scenario) => {
  if (scenario.format === 'cbor' && !frameworks.some((f) => f.supportsCbor && f.name === 'duck')) {
    // Only include CBOR scenarios if Duck is being tested
    return frameworks.some((f) => f.name === 'duck')
  }
  // tRPC doesn't support custom validation libraries in the same way
  if (scenario.validation && scenario.validation !== 'zod' && scenario.validation !== 'none') {
    // Only test custom validators with Duck
    return frameworks.some((f) => f.name === 'duck')
  }
  return true
})

if (!frameworks.length) {
  console.error('No frameworks selected. Check --framework or BENCH_FRAMEWORKS.')
  process.exit(1)
}

if (!validScenarios.length) {
  console.error('No scenarios selected. Check --scenario, --format, or --validation filters.')
  process.exit(1)
}

const runIdPrefix = Date.now().toString(36)
const results: RunResult[] = []

console.log(`\n🚀 Starting comprehensive benchmarks`)
console.log(`   Frameworks: ${frameworks.map((f) => f.name).join(', ')}`)
console.log(`   Scenarios: ${validScenarios.length}`)
console.log(`   Load Pattern: ${selectedLoadPattern.name}`)
console.log(`   Connections: ${selectedLoadPattern.connections.join(', ')}`)
console.log(`   Pipelining: ${selectedLoadPattern.pipelining.join(', ')}`)
console.log(`   Duration: ${selectedLoadPattern.duration}s`)
console.log(`   Iterations: ${iterations} (for statistical validity)`)
console.log(`   Warmup: ${warmup}s\n`)

for (const framework of frameworks) {
  const server = await spawnServer(framework)
  try {
    for (const scenario of validScenarios) {
      // Skip CBOR for tRPC
      if (scenario.format === 'cbor' && framework.name === 'trpc') continue
      // Skip custom validators for tRPC
      if (
        scenario.validation &&
        scenario.validation !== 'zod' &&
        scenario.validation !== 'none' &&
        framework.name === 'trpc'
      )
        continue

      for (const connCount of selectedLoadPattern.connections) {
        for (const pipeCount of selectedLoadPattern.pipelining) {
          const baseUrl = `http://127.0.0.1:${framework.port}`

          // Smoke test: validate request works before load testing
          const smokeResult = await smokeTest(framework, scenario, baseUrl)
          if (!smokeResult.passed) {
            console.error(`\n❌ Smoke test failed for ${framework.name}/${scenario.name}`)
            console.error(`   Error: ${smokeResult.error?.signature}`)
            console.error(`   Preview: ${smokeResult.error?.preview}`)
            continue // Skip this scenario
          }

          if (warmup > 0) {
            // Warmup with validated load test
            await runValidatedLoadTest({
              framework: framework.name,
              scenario,
              baseUrl,
              connections: Math.min(connCount, 16),
              pipelining: pipeCount,
              duration: warmup,
            })
            await delay(500)
          }

          // Run multiple iterations for statistical validity
          const iterationResults: Array<{
            autocannon: autocannon.Result
            validity: RunResult['validity']
          }> = []
          const iterationMetrics: BenchMetrics[] = []

          for (let iter = 0; iter < iterations; iter++) {
            const runId = `${runIdPrefix}:${framework.name}:${scenario.name}:${connCount}:${pipeCount}:${iter}`
            server.child.send({ type: 'start', runId })

            const validatedResult = await runValidatedLoadTest({
              framework: framework.name,
              scenario,
              baseUrl,
              connections: connCount,
              pipelining: pipeCount,
              duration: selectedLoadPattern.duration,
            })

            server.child.send({ type: 'stop', runId })
            const metrics = await waitForMessage<BenchMetrics>(server.child, 'metrics', runId)

            iterationResults.push({
              autocannon: validatedResult.autocannon,
              validity: validatedResult.validity,
            })
            iterationMetrics.push(metrics)

            // Cool down between iterations
            if (iter < iterations - 1) {
              await delay(250)
            }
          }

          // Aggregate validity metrics across iterations
          const totalRequests = iterationResults.reduce((sum, r) => sum + r.validity.totalRequests, 0)
          const successCount = iterationResults.reduce((sum, r) => sum + r.validity.successCount, 0)
          const failCount = iterationResults.reduce((sum, r) => sum + r.validity.failCount, 0)
          const failRate = totalRequests > 0 ? (failCount / totalRequests) * 100 : 0

          // Aggregate error breakdown
          const errorBreakdown = new Map<string, number>()
          const httpStatusBreakdown = new Map<number, number>()
          for (const result of iterationResults) {
            for (const [signature, count] of result.validity.errorBreakdown.entries()) {
              const current = errorBreakdown.get(signature) ?? 0
              errorBreakdown.set(signature, current + count)
            }
            for (const [status, count] of result.validity.httpStatusBreakdown.entries()) {
              const current = httpStatusBreakdown.get(status) ?? 0
              httpStatusBreakdown.set(status, current + count)
            }
          }

          // Get top 5 errors across all iterations
          const topErrors = Array.from(errorBreakdown.entries())
            .map(([signature, count]) => ({ signature, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)

          // Calculate average response size
          const responseSizes = iterationResults
            .map((r) => r.validity.responseSizeBytesAvg)
            .filter((size): size is number => size !== undefined)
          const responseSizeBytesAvg = responseSizes.length > 0 ? mean(responseSizes) : undefined

          // Calculate req/s from successful requests only
          const successReqPerSecValues = iterationResults.map((r) => {
            // NOTE: autocannon's `duration` is already in seconds.
            // Dividing by 1000 would inflate req/s by 1000x and break validation.
            const duration = r.autocannon.duration
            return duration > 0 ? r.validity.successCount / duration : 0
          })

          // Calculate latency metrics (only from autocannon, which tracks all requests)
          const latencyP50Values = iterationResults.map((r) => r.autocannon.latency.p50)
          const latencyP99Values = iterationResults.map((r) => r.autocannon.latency.p99)

          // Validate results
          if (!skipValidation) {
            const reqsValidation = validateBenchmarkRun(
              successReqPerSecValues,
              'reqsPerSec',
              [0, 1_000_000], // Reasonable range
            )
            const latencyValidation = validateBenchmarkRun(
              latencyP99Values,
              'latencyP99',
              [0, 10_000], // Reasonable range
            )

            if (!reqsValidation.valid || !latencyValidation.valid) {
              console.warn(`\n⚠️  Validation warnings for ${scenario.name}:`)
              reqsValidation.warnings.forEach((w) => console.warn(`  ${w}`))
              reqsValidation.errors.forEach((e) => console.error(`  ❌ ${e}`))
              latencyValidation.warnings.forEach((w) => console.warn(`  ${w}`))
              latencyValidation.errors.forEach((e) => console.error(`  ❌ ${e}`))
            }
          }

          // Use mean of iterations for final result
          const avgResult = calculateAverageResult(iterationResults.map((r) => r.autocannon))
          const avgMetrics = calculateAverageMetrics(iterationMetrics)

          // Calculate confidence intervals
          const reqsCI = confidenceInterval95(successReqPerSecValues)
          const latencyP50CI = confidenceInterval95(latencyP50Values)
          const latencyP99CI = confidenceInterval95(latencyP99Values)

          const valid = failCount === 0

          results.push({
            framework: framework.name,
            scenario: scenario.name,
            loadPattern: selectedLoadPattern.name,
            connections: connCount,
            pipelining: pipeCount,
            autocannon: {
              ...avgResult,
              // Add statistical metadata
              _statistics: {
                iterations,
                reqsPerSecCI: reqsCI,
                latencyP50CI,
                latencyP99CI,
                reqsPerSecCV: coefficientOfVariation(successReqPerSecValues),
              },
            } as any,
            server: avgMetrics,
            responseSizeBytes: responseSizeBytesAvg,
            validity: {
              valid,
              totalRequests,
              successCount,
              failCount,
              failRate,
              errorBreakdown,
              httpStatusBreakdown,
              topErrors,
              responseSizeBytesAvg,
            },
            metrics: {
              reqsPerSec: mean(successReqPerSecValues),
              latencyP50: mean(latencyP50Values),
              latencyP99: mean(latencyP99Values),
              latencyP50CI,
              latencyP99CI,
              reqsPerSecCI: reqsCI,
              reqsPerSecCV: coefficientOfVariation(successReqPerSecValues),
            },
          })

          printScenarioSummary(scenario.name, results, selectedLoadPattern.name)
        }
      }
    }
  } finally {
    await stopServer(server.child)
  }
}

// Print comprehensive summary
printComprehensiveSummary(results)

if (outputPath) {
  await writeFile(outputPath, JSON.stringify(results, null, 2))
  console.log(`\n✅ Wrote benchmark results to ${outputPath}`)
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readString(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

function readArgNumber(args: Map<string, string>, name: string, fallback: number): number {
  const raw = args.get(name)
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args.set(key, 'true')
      continue
    }
    args.set(key, next)
    i += 1
  }
  return args
}

function parseFilter(value: string | undefined): Set<string> | null {
  if (!value) return null
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return entries.length ? new Set(entries) : null
}

function matchesFilter(filter: Set<string> | null, value: string): boolean {
  if (!filter) return true
  return filter.has(value)
}

async function runAutocannon(options: autocannon.Options): Promise<autocannon.Result> {
  return await new Promise((resolve, reject) => {
    autocannon(options, (err, result) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result)
    })
  })
}

type ServerHandle = {
  child: ReturnType<typeof spawn>
}

async function spawnServer(framework: Framework): Promise<ServerHandle> {
  const child = spawn(process.execPath, ['--import', 'tsx', framework.entry], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(framework.port),
    },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  })

  await waitForMessage(child, 'ready')
  return { child }
}

async function stopServer(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null) return

  const exitPromise = new Promise<void>((resolve) => {
    child.once('exit', () => resolve())
  })

  if (child.connected) {
    child.send({ type: 'shutdown' })
  } else {
    child.kill('SIGTERM')
  }

  const timeout = setTimeout(() => {
    if (child.exitCode === null) child.kill('SIGTERM')
  }, 2000)

  await exitPromise
  clearTimeout(timeout)
}

async function waitForMessage<T>(child: ReturnType<typeof spawn>, type: string, runId?: string): Promise<T> {
  return await new Promise((resolve, reject) => {
    const onMessage = (message: any) => {
      if (!message || message.type !== type) return
      if (runId && message.runId !== runId) return
      cleanup()
      resolve(message.data ?? message)
    }

    const onExit = (code: number | null) => {
      cleanup()
      reject(new Error(`Server exited before sending ${type} (${code ?? 'unknown'})`))
    }

    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }

    const cleanup = () => {
      child.off('message', onMessage)
      child.off('exit', onExit)
      child.off('error', onError)
    }

    child.on('message', onMessage)
    child.once('exit', onExit)
    child.once('error', onError)
  })
}

function printScenarioSummary(scenarioName: string, results: RunResult[], loadPattern: string) {
  const relevant = results.filter((r) => r.scenario === scenarioName && r.loadPattern === loadPattern)
  if (relevant.length === 0) return

  const rows = relevant.map((result) => {
    const stats = (result.autocannon as any)._statistics

    return {
      framework: result.framework,
      conn: result.connections,
      pipe: result.pipelining,
      successReqPerSec: round(result.metrics.reqsPerSec),
      reqsPerSecCI: result.metrics.reqsPerSecCI
        ? `[${round(result.metrics.reqsPerSecCI[0])}, ${round(result.metrics.reqsPerSecCI[1])}]`
        : 'N/A',
      latencyP50Ms: round(result.metrics.latencyP50),
      latencyP99Ms: round(result.metrics.latencyP99),
      latencyP99CI: result.metrics.latencyP99CI
        ? `[${round(result.metrics.latencyP99CI[0])}, ${round(result.metrics.latencyP99CI[1])}]`
        : 'N/A',
      valid: result.validity.valid ? '✅' : '❌',
      failRate: `${round(result.validity.failRate)}%`,
      totalRequests: result.validity.totalRequests,
      successCount: result.validity.successCount,
      failCount: result.validity.failCount,
      cpuUserMs: round(result.server.cpuUserMs),
      rssDeltaMb: round(result.server.rssDeltaBytes / (1024 * 1024)),
      elP95Ms: round(result.server.eventLoopDelayP95Ms),
      heapFrag: round(result.server.heapFragmentationRatio * 100),
      respSizeKb: result.validity.responseSizeBytesAvg ? round(result.validity.responseSizeBytesAvg / 1024) : 'N/A',
      cv: result.metrics.reqsPerSecCV ? `${round(result.metrics.reqsPerSecCV)}%` : 'N/A',
    }
  })

  if (rows.length) {
    console.log(`\n📊 Scenario: ${scenarioName} (${loadPattern})`)
    console.table(rows)

    // Show error breakdown for invalid results
    for (const result of relevant) {
      if (!result.validity.valid && result.validity.topErrors.length > 0) {
        console.log(`\n  ❌ ${result.framework} errors (top 5):`)
        result.validity.topErrors.forEach((err) => {
          console.log(`     ${err.count}x: ${err.signature}`)
        })
      }
    }
  }
}

function printComprehensiveSummary(results: RunResult[]) {
  if (results.length === 0) return

  console.log(`\n${'='.repeat(80)}`)
  console.log('📈 COMPREHENSIVE BENCHMARK SUMMARY')
  console.log('='.repeat(80))

  // Group by scenario
  const byScenario = new Map<string, RunResult[]>()
  for (const result of results) {
    const key = result.scenario
    if (!byScenario.has(key)) {
      byScenario.set(key, [])
    }
    byScenario.get(key)!.push(result)
  }

  // Calculate speedup ratios
  for (const [scenario, scenarioResults] of byScenario.entries()) {
    const duckResults = scenarioResults.filter((r) => r.framework === 'duck')
    const trpcResults = scenarioResults.filter((r) => r.framework === 'trpc')

    if (duckResults.length > 0 && trpcResults.length > 0) {
      // Compare similar configurations
      const duckAvg = duckResults.reduce((sum, r) => sum + r.autocannon.requests.average, 0) / duckResults.length
      const trpcAvg = trpcResults.reduce((sum, r) => sum + r.autocannon.requests.average, 0) / trpcResults.length

      if (trpcAvg > 0) {
        const speedup = duckAvg / trpcAvg
        const improvement = ((duckAvg - trpcAvg) / trpcAvg) * 100
        console.log(`\n${scenario}:`)
        console.log(`  Duck: ${round(duckAvg)} req/s | tRPC: ${round(trpcAvg)} req/s`)
        console.log(`  Speedup: ${round(speedup)}x (${improvement > 0 ? '+' : ''}${round(improvement)}%)`)
      }
    }
  }

  // Best and worst cases
  const allDuck = results.filter((r) => r.framework === 'duck')
  const allTrpc = results.filter((r) => r.framework === 'trpc')

  if (allDuck.length > 0) {
    const bestDuck = allDuck.reduce((best, curr) =>
      curr.autocannon.requests.average > best.autocannon.requests.average ? curr : best,
    )
    console.log(
      `\n🏆 Best Duck Performance: ${bestDuck.scenario} - ${round(bestDuck.autocannon.requests.average)} req/s`,
    )
  }

  if (allTrpc.length > 0) {
    const bestTrpc = allTrpc.reduce((best, curr) =>
      curr.autocannon.requests.average > best.autocannon.requests.average ? curr : best,
    )
    console.log(`🏆 Best tRPC Performance: ${bestTrpc.scenario} - ${round(bestTrpc.autocannon.requests.average)} req/s`)
  }

  // Memory efficiency (only for valid results)
  console.log(`\n💾 Memory Efficiency:`)
  const validDuck = allDuck.filter((r) => r.validity.valid)
  const validTrpc = allTrpc.filter((r) => r.validity.valid)

  const duckMem = validDuck.map((r) => {
    // autocannon's `duration` is already in seconds.
    const duration = r.autocannon.duration
    return {
      scenario: r.scenario,
      reqsPerMb:
        r.server.rssDeltaBytes > 0 ? (r.metrics.reqsPerSec * duration) / (r.server.rssDeltaBytes / (1024 * 1024)) : 0,
    }
  })
  const trpcMem = validTrpc.map((r) => {
    // autocannon's `duration` is already in seconds.
    const duration = r.autocannon.duration
    return {
      scenario: r.scenario,
      reqsPerMb:
        r.server.rssDeltaBytes > 0 ? (r.metrics.reqsPerSec * duration) / (r.server.rssDeltaBytes / (1024 * 1024)) : 0,
    }
  })

  if (duckMem.length > 0) {
    const avgDuckMem = duckMem.reduce((sum, m) => sum + m.reqsPerMb, 0) / duckMem.length
    console.log(`  Duck: ${round(avgDuckMem)} requests per MB (valid results only)`)
  }
  if (trpcMem.length > 0) {
    const avgTrpcMem = trpcMem.reduce((sum, m) => sum + m.reqsPerMb, 0) / trpcMem.length
    console.log(`  tRPC: ${round(avgTrpcMem)} requests per MB (valid results only)`)
  }

  console.log(`\n${'='.repeat(80)}\n`)
}

/**
 * Calculate average result from multiple autocannon runs.
 * Ensures we're using real, averaged data, not single measurements.
 */
function calculateAverageResult(results: autocannon.Result[]): autocannon.Result {
  if (results.length === 0) {
    throw new Error('Cannot calculate average of empty results')
  }

  if (results.length === 1) {
    return results[0]!
  }

  // Calculate averages for all metrics
  const avgRequests = {
    average: mean(results.map((r) => r.requests.average)),
    mean: mean(results.map((r) => r.requests.mean ?? r.requests.average)),
    stddev: mean(results.map((r) => r.requests.stddev ?? 0)),
    min: Math.min(...results.map((r) => r.requests.min)),
    max: Math.max(...results.map((r) => r.requests.max)),
    total: results.reduce((sum, r) => sum + r.requests.total, 0),
  }

  const avgLatency = {
    average: mean(results.map((r) => r.latency.average)),
    mean: mean(results.map((r) => r.latency.mean ?? r.latency.average)),
    stddev: mean(results.map((r) => r.latency.stddev ?? 0)),
    min: Math.min(...results.map((r) => r.latency.min)),
    max: Math.max(...results.map((r) => r.latency.max)),
    p1: mean(results.map((r) => r.latency.p1)),
    p2_5: mean(results.map((r) => r.latency.p2_5)),
    p10: mean(results.map((r) => r.latency.p10)),
    p25: mean(results.map((r) => r.latency.p25)),
    p50: mean(results.map((r) => r.latency.p50)),
    p75: mean(results.map((r) => r.latency.p75)),
    p90: mean(results.map((r) => r.latency.p90)),
    p97_5: mean(results.map((r) => r.latency.p97_5)),
    p99: mean(results.map((r) => r.latency.p99)),
    p99_9: mean(results.map((r) => r.latency.p99_9)),
    p99_99: mean(results.map((r) => r.latency.p99_99)),
    p99_999: mean(results.map((r) => r.latency.p99_999)),
  }

  const avgThroughput = {
    average: mean(results.map((r) => r.throughput.average)),
    mean: mean(results.map((r) => r.throughput.mean ?? r.throughput.average)),
    stddev: mean(results.map((r) => r.throughput.stddev ?? 0)),
    min: Math.min(...results.map((r) => r.throughput.min)),
    max: Math.max(...results.map((r) => r.throughput.max)),
    total: results.reduce((sum, r) => sum + r.throughput.total, 0),
  }

  // Use first result as template, replace with averages
  const template = results[0]!
  return {
    ...template,
    requests: avgRequests,
    latency: avgLatency,
    throughput: avgThroughput,
    errors: mean(results.map((r) => r.errors)),
    timeouts: mean(results.map((r) => r.timeouts)),
    duration: mean(results.map((r) => r.duration)),
    start: Math.min(...results.map((r) => r.start)),
    finish: Math.max(...results.map((r) => r.finish)),
  }
}

/**
 * Calculate average metrics from multiple runs.
 */
function calculateAverageMetrics(metrics: BenchMetrics[]): BenchMetrics {
  if (metrics.length === 0) {
    throw new Error('Cannot calculate average of empty metrics')
  }

  if (metrics.length === 1) {
    return metrics[0]!
  }

  return {
    elapsedMs: mean(metrics.map((m) => m.elapsedMs)),
    cpuUserMs: mean(metrics.map((m) => m.cpuUserMs)),
    cpuSystemMs: mean(metrics.map((m) => m.cpuSystemMs)),
    rssDeltaBytes: mean(metrics.map((m) => m.rssDeltaBytes)),
    heapUsedDeltaBytes: mean(metrics.map((m) => m.heapUsedDeltaBytes)),
    heapTotalDeltaBytes: mean(metrics.map((m) => m.heapTotalDeltaBytes)),
    eventLoopDelayMeanMs: mean(metrics.map((m) => m.eventLoopDelayMeanMs)),
    eventLoopDelayP95Ms: mean(metrics.map((m) => m.eventLoopDelayP95Ms)),
    eventLoopDelayP99Ms: mean(metrics.map((m) => m.eventLoopDelayP99Ms)),
    eventLoopDelayMaxMs: mean(metrics.map((m) => m.eventLoopDelayMaxMs)),
    gcPauseTimeTotalMs: mean(metrics.map((m) => m.gcPauseTimeTotalMs)),
    gcPauseTimeCount: mean(metrics.map((m) => m.gcPauseTimeCount)),
    heapSizeLimitBytes: mean(metrics.map((m) => m.heapSizeLimitBytes)),
    heapTotalSizeBytes: mean(metrics.map((m) => m.heapTotalSizeBytes)),
    heapUsedSizeBytes: mean(metrics.map((m) => m.heapUsedSizeBytes)),
    heapAvailableSizeBytes: mean(metrics.map((m) => m.heapAvailableSizeBytes)),
    heapFragmentationRatio: mean(metrics.map((m) => m.heapFragmentationRatio)),
    responseSizeTotalBytes: mean(metrics.map((m) => m.responseSizeTotalBytes)),
    responseSizeCount: mean(metrics.map((m) => m.responseSizeCount)),
    responseSizeMinBytes: mean(metrics.map((m) => m.responseSizeMinBytes)),
    responseSizeMaxBytes: mean(metrics.map((m) => m.responseSizeMaxBytes)),
    responseSizeAvgBytes: mean(metrics.map((m) => m.responseSizeAvgBytes)),
  }
}

function round(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : value
}
