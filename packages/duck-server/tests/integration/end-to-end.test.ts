/**
 * End-to-end integration tests.
 *
 * Tests the full request/response cycle including:
 * - Server setup
 * - Request handling
 * - Response serialization
 * - Error handling
 * - Multiple procedures
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { initRPC } from '../../src/server/core/init'
import { RPCRes as R } from '../../src/server/core/response'
import { fetchRequestHandler } from '../../src/server/http/fetch'

describe('End-to-End Integration', () => {
  it('should handle complete request/response cycle', async () => {
    const t = initRPC<{ userId?: number }>().create()
    const publicProcedure = t.procedure()

    const hello = publicProcedure.input(z.object({ name: z.string() })).query(async ({ input }) => {
      return R.ok({ greeting: `Hello ${input.name}` }, 'RPC_OK')
    })

    const router = t.router({ hello })

    const req = new Request('http://localhost/rpc/hello', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'query', input: { name: 'World' } }),
    })

    const res = await fetchRequestHandler({
      router,
      createContext: () => ({}),
      req,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    if (data.ok) {
      expect(data.data.greeting).toBe('Hello World')
    }
  })

  it('should handle middleware in full flow', async () => {
    const t = initRPC<{ user?: { id: number } }>().create()
    const publicProcedure = t.procedure()
    const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
      if (!ctx.user) {
        return {
          ok: false,
          error: { code: 'RPC_UNAUTHORIZED', message: 'Unauthorized', issues: [], name: 'NotAuthorizedError' },
        }
      }
      return next({ ctx })
    })

    const getUser = protectedProcedure.query(async ({ ctx }) => {
      return R.ok({ userId: ctx.user!.id }, 'RPC_OK')
    })

    const router = t.router({ getUser })

    // Test without user (should fail)
    const req1 = new Request('http://localhost/rpc/getUser', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'query', input: {} }),
    })

    const res1 = await fetchRequestHandler({
      router,
      createContext: () => ({}),
      req: req1,
    })

    expect(res1.status).toBe(401)

    // Test with user (should succeed)
    const req2 = new Request('http://localhost/rpc/getUser', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'query', input: {} }),
    })

    const res2 = await fetchRequestHandler({
      router,
      createContext: () => ({ user: { id: 123 } }),
      req: req2,
    })

    expect(res2.status).toBe(200)
    const data = await res2.json()
    if (data.ok) {
      expect(data.data.userId).toBe(123)
    }
  })

  it('should handle nested routers', async () => {
    const t = initRPC().create()
    const publicProcedure = t.procedure()

    const userRouter = t.router({
      profile: publicProcedure.query(async () => R.ok({ name: 'John' }, 'RPC_OK')),
      settings: publicProcedure.query(async () => R.ok({ theme: 'dark' }, 'RPC_OK')),
    })

    const appRouter = t.router({
      user: userRouter,
    })

    const req = new Request('http://localhost/rpc/user.profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'query', input: {} }),
    })

    const res = await fetchRequestHandler({
      router: appRouter,
      createContext: () => ({}),
      req,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    if (data.ok) {
      expect(data.data.name).toBe('John')
    }
  })
})
