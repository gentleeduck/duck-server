import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { z } from 'zod'
import { initRPC, RPCRes as R } from '../../src/server/core'
import { rpcServer } from '../../src/server/http'

type BaseContext = { req: Request; requestId: string }

const t = initRPC<BaseContext>().create()
const publicProcedure = t.procedure()

const appRouter = t.router({
  greeting: publicProcedure.input(z.object({ name: z.string() })).query(async ({ input }) => {
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

serve(app, () => console.log('custom-fetcher server listening on 3000'))
