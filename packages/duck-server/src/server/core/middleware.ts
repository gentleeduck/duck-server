import type { RPCError } from './error'
import { createRPCError, isRPCError } from './error'
import { type RPCResType, rpcErr, rpcToErr } from './response'

/** Result envelope returned from a middleware step. */
export type MiddlewareResult<DData> = { ok: true; data: DData } | { ok: false; error: RPCError }

/** Middleware function signature for context refinement and control flow. */
export type MiddlewareFn<DCtxIn, DCtxOut> = (opts: {
  ctx: DCtxIn
  next: (opts?: { ctx?: DCtxOut }) => Promise<MiddlewareResult<any>>
}) => Promise<MiddlewareResult<any>>

/**
 * Pre-compose middleware chain to avoid per-request closure allocations.
 * This builds the middleware chain once per procedure instead of on every request.
 * Returns a function that takes both context and resolver, allowing the resolver
 * to vary per request while the middleware chain structure is pre-composed.
 */
export function composeMiddlewares<TCtx, TOut>(
  middlewares: MiddlewareFn<any, any>[],
): (ctx: TCtx, resolver: (ctx: TCtx) => Promise<RPCResType<TOut>>) => Promise<RPCResType<TOut>> {
  // Build once at procedure creation time
  return async (ctx: TCtx, resolver: (ctx: TCtx) => Promise<RPCResType<TOut>>): Promise<RPCResType<TOut>> => {
    let idx = -1

    const dispatch = async (i: number, nextCtx: TCtx): Promise<RPCResType<TOut>> => {
      if (i <= idx) throw new Error('next() called multiple times')
      idx = i

      const mw = middlewares[i]
      if (!mw) return resolver(nextCtx)

      const result = await mw({
        ctx: nextCtx,
        next: async (opts) => {
          const updatedCtx = (opts?.ctx ?? nextCtx) as TCtx
          const data = await dispatch(i + 1, updatedCtx)
          // Wrap the RPCResType in a MiddlewareResult
          return { ok: true, data }
        },
      })

      if (result.ok) {
        // result.data is the RPCResType<TOut> returned from dispatch
        return result.data as RPCResType<TOut>
      }
      // Middleware returned an error directly - preserve the error code
      if (isRPCError(result.error)) {
        return rpcErr(result.error.code, result.error.message, result.error.issues)
      }
      // Handle plain error objects with code property
      const errorObj = result.error as any
      const code = errorObj?.code && typeof errorObj.code === 'string' ? errorObj.code : 'RPC_INTERNAL_SERVER_ERROR'
      const message = errorObj?.message || 'Middleware error'
      const issues = errorObj?.issues || []
      return rpcErr(code, message, issues)
    }

    return dispatch(0, ctx)
  }
}
