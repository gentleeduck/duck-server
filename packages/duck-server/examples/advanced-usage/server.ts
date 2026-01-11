import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { z } from 'zod'
import { createRPCError, initDuckRPC, type MiddlewareFn, RPCRes as R } from '../../src/server/core'
import { rpcServer } from '../../src/server/http'

type BaseContext = { req: Request; requestId: string }

type AuthedContext = BaseContext & {
  user: { id: string }
}

const authMiddleware = (): MiddlewareFn<BaseContext, AuthedContext> => {
  return async ({ ctx, next }) => {
    const userId = ctx.req.headers.get('x-user-id')
    if (!userId) {
      return { ok: false, error: createRPCError({ code: 'RPC_UNAUTHORIZED', message: 'Missing user id' }) }
    }

    return next({ ctx: { ...ctx, user: { id: userId } } })
  }
}

const t = initDuckRPC<BaseContext>().create()
const publicProcedure = t.procedure()
const protectedProcedure = publicProcedure.use(authMiddleware())

const userRouter = t.router({
  getProfile: protectedProcedure.output(z.object({ id: z.string() })).query(async ({ ctx }) => {
    return R.ok({ id: ctx.user.id }, 'RPC_OK')
  }),
})

const postRouter = t.router({
  create: protectedProcedure
    .input(z.object({ title: z.string().min(1) }))
    .output(z.object({ id: z.string(), title: z.string() }))
    .mutation(async ({ input }) => {
      return R.ok({ id: 'p1', title: input.title }, 'RPC_OK')
    }),
})

const appRouter = t.router({
  user: userRouter,
  post: postRouter,
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

serve(app, () => console.log('advanced-usage server listening on 3000'))
