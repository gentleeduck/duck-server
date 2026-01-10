import type { MiddlewareFn } from './validation/middleware'
import { RPCRes as R, RPCError } from './validation/rpc-res'

// FIRST OF ALL MAKE YOUR OWN CONTEXT TYPE
export type BaseContext = {
  req: Request
  requestId: string
}

export type AuthedContext = BaseContext & {
  user: { id: string; role: 'user' | 'admin' }
}

// Middleware that refines ctx type
export function authMiddleware(): MiddlewareFn<BaseContext, AuthedContext> {
  return async ({ ctx, next }) => {
    // Example: read header
    // const token = ctx.req.headers.get('authorization') ?? ''
    // if (!token.startsWith('Bearer ')) {
    //   return { ok: false, error: new RPCError({ code: 'RPC_UNAUTHORIZED', message: 'Missing auth' }) }
    //   // return R.err('RPC_UNAUTHORIZED')
    // }

    // You would verify token here
    const user = { id: 'u1', role: 'user' as const }

    return next({ ctx: { ...ctx, user } })
  }
}
