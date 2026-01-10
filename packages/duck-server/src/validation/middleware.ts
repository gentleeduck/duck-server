import type { RPCError } from './rpc-res'

export type MiddlewareResult<DData> = { ok: true; data: DData } | { ok: false; error: RPCError }

export type MiddlewareFn<DCtxIn, DCtxOut> = (opts: {
  ctx: DCtxIn
  next: (opts?: { ctx?: DCtxOut }) => Promise<MiddlewareResult<any>>
}) => Promise<MiddlewareResult<any>>
