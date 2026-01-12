/**
 * Tests for middleware composition.
 *
 * Covers:
 * - Middleware execution order
 * - Context mutation
 * - Error handling in middleware
 * - Next() call validation
 */

import { describe, expect, it } from 'vitest'
import { composeMiddlewares, type MiddlewareFn } from '../middleware'
import { RPCRes as R } from '../response'

describe('composeMiddlewares', () => {
  it('should execute middleware in order', async () => {
    const order: number[] = []
    const middlewares: MiddlewareFn<any, any>[] = [
      async ({ ctx, next }) => {
        order.push(1)
        return next({ ctx: { ...ctx, step: 1 } })
      },
      async ({ ctx, next }) => {
        order.push(2)
        expect(ctx).toHaveProperty('step', 1)
        return next({ ctx: { ...ctx, step: 2 } })
      },
    ]

    const resolver = async (ctx: any) => {
      order.push(3)
      expect(ctx.step).toBe(2)
      return R.ok({}, 'RPC_OK')
    }

    const run = composeMiddlewares(middlewares)
    const result = await run({}, resolver)

    expect(result.ok).toBe(true)
    expect(order).toEqual([1, 2, 3])
  })

  it('should handle empty middleware array', async () => {
    const resolver = async () => R.ok({}, 'RPC_OK')
    const run = composeMiddlewares([])
    const result = await run({}, resolver)

    expect(result.ok).toBe(true)
  })

  it('should prevent multiple next() calls', async () => {
    const middlewares: MiddlewareFn<any, any>[] = [
      async ({ next }) => {
        await next()
        // Try to call next again - should throw
        await next()
        return { ok: true, data: { ok: true, data: R.ok({}, 'RPC_OK') } }
      },
    ]

    const resolver = async () => R.ok({}, 'RPC_OK')
    const run = composeMiddlewares(middlewares)

    await expect(run({}, resolver)).rejects.toThrow('next() called multiple times')
  })

  it('should handle middleware errors', async () => {
    const middlewares: MiddlewareFn<any, any>[] = [
      async () => {
        return {
          ok: false,
          error: { code: 'RPC_UNAUTHORIZED', name: 'RPCError', message: 'Unauthorized', issues: [] },
        }
      },
    ]

    const resolver = async () => R.ok({}, 'RPC_OK')
    const run = composeMiddlewares(middlewares)
    const result = await run({}, resolver)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('RPC_UNAUTHORIZED')
    }
  })

  it('should allow context mutation', async () => {
    const middlewares: MiddlewareFn<any, any>[] = [
      async ({ ctx, next }) => {
        return next({ ctx: { ...ctx, user: { id: 1, name: 'Test' } } })
      },
    ]

    const resolver = async (ctx: any) => {
      expect(ctx.user).toEqual({ id: 1, name: 'Test' })
      return R.ok({ userId: ctx.user.id }, 'RPC_OK')
    }

    const run = composeMiddlewares(middlewares)
    const result = await run({}, resolver)

    expect(result.ok).toBe(true)
    if (result.ok) {
      // @ts-ignore
      expect(result.data.userId).toBe(1)
    }
  })
})
