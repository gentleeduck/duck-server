import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type BaseContext } from './context'
import { drpcServer } from './validation/hono'
import { initDuckRPC } from './validation/initDRPC'
import { RPCRes as R } from './validation/rpc-res'

const t = initDuckRPC<BaseContext>().create()

export const publicProcedure = t.procedure()
export const protectedProcedure = publicProcedure.use(authMiddleware())

class UploadService {
  static async deleteBucket(input: { bucketId: string }) {
    return { deleted: input.bucketId }
  }
}

export const uploadRouter = t.router({
  deleteBucket: protectedProcedure.input(z.object({ bucketId: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      let data = await UploadService.deleteBucket(input)

      return R.ok(data, 'RPC_OK')
    } catch (error) {
      return R.err('RPC_NOT_FOUND')
    }
  }),
})

// optional nesting like tRPC
export const appRouter = t.router({
  upload: uploadRouter,
})
export type AppRouter = typeof appRouter

const app = new Hono()

app.use(
  '/trpc/*',
  drpcServer({
    router: appRouter,
    endpoint: '/trpc',
    createContext: ({ req }) => ({
      req,
      requestId: crypto.randomUUID(),
    }),
    // onError: ({ error, path }) => { ... },
  }),
)

// Optional: Add other Hono routes
app.get('/', (c) => c.text('Hono server running'))

serve(app, () => console.log('Listening on port 3000'))

export default app
