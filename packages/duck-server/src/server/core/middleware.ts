import type { RPCError } from './error'

/** Result envelope returned from a middleware step. */
export type MiddlewareResult<DData> = { ok: true; data: DData } | { ok: false; error: RPCError }

/** Middleware function signature for context refinement and control flow. */
export type MiddlewareFn<DCtxIn, DCtxOut> = (opts: {
  ctx: DCtxIn
  next: (opts?: { ctx?: DCtxOut }) => Promise<MiddlewareResult<any>>
}) => Promise<MiddlewareResult<any>>
