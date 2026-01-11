import type { MiddlewareFn } from './server/core'

/** Base context shape used by the example app. */
export type BaseContext = {
  req: Request
  requestId: string
}

/** Context shape after auth middleware adds the user object. */
export type AuthedContext = BaseContext & {
  user: { id: string; role: 'user' | 'admin' }
}

/** Example auth middleware that refines the context type. */
export function authMiddleware(): MiddlewareFn<BaseContext, AuthedContext> {
  return async ({ ctx, next }) => {
    // Example: read header
    // const token = ctx.req.headers.get('authorization') ?? ''
    // if (!token.startsWith('Bearer ')) {
    //   return { ok: false, error: createRPCError({ code: 'RPC_UNAUTHORIZED', message: 'Missing auth' }) }
    // }

    // You would verify token here
    const user = { id: 'u1', role: 'user' as const }

    return next({ ctx: { ...ctx, user } })
  }
}
