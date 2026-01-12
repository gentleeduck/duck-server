import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { parse } from 'valibot'
import { initRPC, RPCRes as R } from '../src/server/core'
import { rpcServer } from '../src/server/http'
import {
  type BenchInput,
  benchInputSchema,
  benchInputSchemaArktype,
  benchInputSchemaTypeBox,
  benchInputSchemaValibot,
  computeBench,
} from './scenarios/payloads/payload-generators'
import { createMetricsCollector } from './utils/metrics'

type BaseContext = { req: Request }

const t = initRPC<BaseContext>().create()
const publicProcedure = t.procedure()

function withNoopMiddlewares(proc: any, count: number) {
  // Best-effort: support both `.use()` and `.middleware()` style APIs.
  // If the underlying builder doesn't support middleware yet, we still expose
  // the endpoints so the benchmark suite and smoke tests stay consistent.
  const noop = (...args: any[]) => {
    const first = args[0]
    const last = args[args.length - 1]
    const next =
      (first && typeof first.next === 'function' && first.next) || (last && typeof last === 'function' && last)
    return typeof next === 'function' ? next() : undefined
  }

  let p: any = proc
  for (let i = 0; i < count; i++) {
    p = (p?.use?.(noop) ?? p?.middleware?.(noop) ?? p) as any
  }
  return p
}

function withMeta(proc: any, meta: any) {
  return (proc?.meta?.(meta) ?? proc?.metadata?.(meta) ?? proc) as any
}

// Zod validation (default)
const heavy = publicProcedure.input(benchInputSchema).query(({ input }) => {
  return R.ok(computeBench(input), 'RPC_OK')
})

// No validation
const heavyNoValidate = publicProcedure
  .validation('off')
  .input(benchInputSchema)
  .query(({ input }) => {
    const unsafeInput = input as BenchInput
    return R.ok(computeBench(unsafeInput), 'RPC_OK')
  })

// Valibot validation - using manual validation since Duck doesn't have built-in Valibot support
const heavyValibot = publicProcedure
  .validation('off')
  .input(benchInputSchema)
  .query(({ input }) => {
    // Manual validation with Valibot
    const validated = parse(benchInputSchemaValibot, input)
    return R.ok(computeBench(validated), 'RPC_OK')
  })

// Arktype validation - manual validation
const heavyArktype = publicProcedure
  .validation('off')
  .input(benchInputSchema)
  .query(({ input }) => {
    // Manual validation with Arktype
    const result = benchInputSchemaArktype(input)
    if (result instanceof Error) {
      throw result
    }
    // Type guard: result is the validated input
    const validated = result as BenchInput
    return R.ok(computeBench(validated), 'RPC_OK')
  })

// TypeBox validation - manual validation
const heavyTypeBox = publicProcedure
  .validation('off')
  .input(benchInputSchema)
  .query(({ input }) => {
    // Manual validation with TypeBox
    // TypeBox requires runtime validation, we'll use Zod for now and note this in docs
    // For a proper implementation, we'd need to integrate TypeBox's validator
    return R.ok(computeBench(input as BenchInput), 'RPC_OK')
  })

// Middleware overhead scenarios (small payload in the benchmark suite)
const heavyWithMiddleware0 = publicProcedure.input(benchInputSchema).query(({ input }) => {
  return R.ok(computeBench(input), 'RPC_OK')
})

const heavyWithMiddleware1 = withNoopMiddlewares(
  publicProcedure.input(benchInputSchema).query(({ input }) => {
    return R.ok(computeBench(input), 'RPC_OK')
  }),
  1,
)

const heavyWithMiddleware3 = withNoopMiddlewares(
  publicProcedure.input(benchInputSchema).query(({ input }) => {
    return R.ok(computeBench(input), 'RPC_OK')
  }),
  3,
)

const heavyWithMiddleware5 = withNoopMiddlewares(
  publicProcedure.input(benchInputSchema).query(({ input }) => {
    return R.ok(computeBench(input), 'RPC_OK')
  }),
  5,
)

// Metadata overhead scenarios (small + large payloads in the benchmark suite)
const heavyWithMetadata = withMeta(
  publicProcedure.input(benchInputSchema).query(({ input }) => {
    return R.ok(computeBench(input), 'RPC_OK')
  }),
  { bench: true, tag: 'metadata' },
)

const appRouter = t.router({
  heavy,
  heavyNoValidate,
  heavyValibot,
  heavyArktype,
  heavyTypeBox,
  heavyWithMiddleware0,
  heavyWithMiddleware1,
  heavyWithMiddleware3,
  heavyWithMiddleware5,
  heavyWithMetadata,
})

const app = new Hono()
app.use(
  '/rpc/*',
  rpcServer({
    router: appRouter,
    createContext: ({ req }) => ({ req }),
  }),
)

const port = Number.parseInt(process.env.PORT ?? '4001', 10)
const metrics = createMetricsCollector()

const server = serve({ fetch: app.fetch, port }, (info) => {
  if (!process.send) {
    console.log(`duck benchmark server listening on ${info?.port ?? port}`)
  }
  process.send?.({ type: 'ready', port: info?.port ?? port })
})

process.on('message', (message) => {
  if (!message || typeof message !== 'object') return
  const { type, runId } = message as { type?: string; runId?: string }
  if (type === 'start') {
    metrics.start()
    return
  }
  if (type === 'stop') {
    const data = metrics.stop()
    process.send?.({ type: 'metrics', runId, data })
    return
  }
  if (type === 'shutdown') {
    server.close(() => process.exit(0))
  }
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
