import { initTRPC } from '@trpc/server'
import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { z } from 'zod'
import { type BenchInput, benchInputSchema, computeBench } from './scenarios/payloads/payload-generators'
import { createMetricsCollector } from './utils/metrics'

type BaseContext = {}

const t = initTRPC.context<BaseContext>().create()

const noopMiddleware = t.middleware(async ({ next }) => next())

function withNoopMiddlewares<TProc>(proc: TProc, count: number): TProc {
  let p: any = proc
  for (let i = 0; i < count; i++) {
    p = p.use(noopMiddleware)
  }
  return p as TProc
}

const heavy = t.procedure.input(benchInputSchema).query(({ input }) => {
  return computeBench(input)
})

const heavyNoValidate = t.procedure.input(z.any()).query(({ input }) => {
  const unsafeInput = input as BenchInput
  return computeBench(unsafeInput)
})

const heavyWithMiddleware0 = withNoopMiddlewares(t.procedure.input(benchInputSchema), 0).query(({ input }: any) => {
  return computeBench(input)
})

const heavyWithMiddleware1 = withNoopMiddlewares(t.procedure.input(benchInputSchema), 1).query(({ input }: any) => {
  return computeBench(input)
})

const heavyWithMiddleware3 = withNoopMiddlewares(t.procedure.input(benchInputSchema), 3).query(({ input }: any) => {
  return computeBench(input)
})

const heavyWithMiddleware5 = withNoopMiddlewares(t.procedure.input(benchInputSchema), 5).query(({ input }: any) => {
  return computeBench(input)
})

const heavyWithMetadata = t.procedure
  .input(benchInputSchema)
  .meta({ bench: true })
  .query(({ input }) => {
    return computeBench(input)
  })

const appRouter = t.router({
  heavy,
  heavyNoValidate,
  heavyWithMiddleware0,
  heavyWithMiddleware1,
  heavyWithMiddleware3,
  heavyWithMiddleware5,
  heavyWithMetadata,
})

const port = Number.parseInt(process.env.PORT ?? '4002', 10)
const metrics = createMetricsCollector()

const server = createHTTPServer({
  router: appRouter,
  createContext: () => ({}),
  basePath: '/trpc/',
  allowMethodOverride: true,
  maxBodySize: 1_000_000,
})

server.listen(port, () => {
  if (!process.send) {
    console.log(`tRPC benchmark server listening on ${port}`)
  }
  process.send?.({ type: 'ready', port })
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
