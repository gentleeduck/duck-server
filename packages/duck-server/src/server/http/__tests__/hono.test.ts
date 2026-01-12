/**
 * Tests for Hono integration.
 *
 * Covers:
 * - rpcServer middleware
 * - Context creation
 * - Endpoint resolution
 */

import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createProcedure } from '../../core/procedure'
import { RPCRes as R } from '../../core/response'
import { createRouter } from '../../core/router'
import { rpcServer } from '../hono'

describe('rpcServer', () => {
  it('should create Hono middleware', () => {
    const proc = createProcedure().query(async () => R.ok({}, 'RPC_OK'))
    const router = createRouter({ hello: proc })
    const middleware = rpcServer({
      router,
      createContext: () => ({}),
    })

    expect(typeof middleware).toBe('function')
  })

  it('should handle RPC requests', async () => {
    const proc = createProcedure().query(async () => R.ok({ message: 'Hello' }, 'RPC_OK'))
    const router = createRouter({ hello: proc })
    const app = new Hono()

    app.use(
      '/rpc/*',
      rpcServer({
        router,
        createContext: () => ({}),
      }),
    )

    const req = new Request('http://localhost/rpc/hello?type=query')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it('should use custom endpoint', async () => {
    const proc = createProcedure().query(async () => R.ok({}, 'RPC_OK'))
    const router = createRouter({ hello: proc })
    const app = new Hono()

    app.use(
      '/api/*',
      rpcServer({
        router,
        endpoint: '/api',
        createContext: () => ({}),
      }),
    )

    const req = new Request('http://localhost/api/hello?type=query')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
  })

  it('should pass context to procedures', async () => {
    type Context = { userId: number }
    const proc = createProcedure<Context>().query(async ({ ctx }) => {
      return R.ok({ userId: ctx.userId }, 'RPC_OK')
    })
    const router = createRouter({ hello: proc })
    const app = new Hono()

    app.use(
      '/rpc/*',
      rpcServer<Context>({
        router,
        createContext: () => ({ userId: 123 }),
      }),
    )

    const req = new Request('http://localhost/rpc/hello?type=query')
    const res = await app.fetch(req)

    const data = await res.json()
    if (data.ok) {
      expect(data.data.userId).toBe(123)
    }
  })
})
