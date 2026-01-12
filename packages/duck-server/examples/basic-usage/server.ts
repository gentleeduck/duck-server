import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { z } from 'zod'
import { initRPC, RPCRes as R } from '../../src/server/core'
import { rpcServer } from '../../src/server/http'

type BaseContext = { req: Request; requestId: string }

const r = initRPC<BaseContext>().create()
const publicProcedure = r.procedure()

const appRouter = r.router({
  greeting: publicProcedure.input(z.object({ name: z.string() })).query(async ({ input }) => {
    return R.ok({ greeting: `Hello ${input.name}` }, 'RPC_GREETING_OK')
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

serve(app, () => console.log('basic-usage server listening on 3000'))
