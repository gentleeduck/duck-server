import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type BaseContext } from './context'
import { initDuckRPC, RPCRes as R } from './server/core'
import { rpcServer } from './server/http'

const r = initDuckRPC<BaseContext>().create()

export const publicProcedure = r.procedure()
export const protectedProcedure = publicProcedure.use(authMiddleware())

/** Example delete action used by the upload router. */
async function deleteBucket(input: { bucketId: string; bucket: string }) {
  // throw new Error('Not implemented')
  return { deleted: input.bucketId, bucket: input.bucket }
}

export const uploadRouter = r.router({
  deleteBucket: protectedProcedure
    .input(
      z.object({
        bucketId: z.string().min(1),
        bucket: z.string().min(1),
      }),
    )
    .output(z.object({ deleted: z.string(), bucket: z.string() }))
    .mutation(async ({ input }) => {
      try {
        let data = await deleteBucket(input)
        return R.ok(data as any, 'RPC_OK')
      } catch (error) {
        return R.err('RPC_DELETE_BUCKET_FAILED')
      }
    }),
})

// optional nesting with nested routers
export const appRouter = r.router({
  upload: uploadRouter,
})
/** App-level router type for server and client inference. */
export type AppRouter = typeof appRouter

const app = new Hono()

app.use(
  '/rpc/*',
  rpcServer({
    router: appRouter,
    endpoint: '/rpc',
    createContext: ({ req }) => ({
      req,
      requestId: crypto.randomUUID(),
    }),
  }),
)

// Optional: Add other Hono routes
app.get('/', (c) => c.text('Hono server running'))

serve(app, () => console.log('Listening on port 3000'))

export default app
