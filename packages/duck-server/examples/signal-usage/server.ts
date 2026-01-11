import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { z } from 'zod'
import { initDuckRPC, RPCRes as R } from '../../src/server/core'
import { rpcServer } from '../../src/server/http'

type BaseContext = { req: Request; requestId: string }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const t = initDuckRPC<BaseContext>().create()
const publicProcedure = t.procedure()

const appRouter = t.router({
  greeting: publicProcedure.input(z.object({ name: z.string() })).query(async ({ input }) => {
    await sleep(1000)
    return R.ok({ greeting: `Hello ${input.name}` }, 'RPC_OK')
  }),
})

export type AppRouter = typeof appRouter

const app = new Hono()

app.use(
  '/rpc/*',
  rpcServer({
    router: appRouter,
    createContext: ({ req }) => ({ req, requestId: crypto.randomUUID() }),
  }),
)

serve(app, () => console.log('signal-usage server listening on 3000'))
