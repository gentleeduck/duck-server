/**
 * Tests for proxy-based RPC client.
 *
 * Covers:
 * - Proxy client creation
 * - Type-safe calls
 * - Path building
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initRPC } from '../../server/core/init'
import { RPCRes as R } from '../../server/core/response'
import { createRPCProxyClient } from '../proxy-client'

describe('createRPCProxyClient', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let router: ReturnType<typeof initRPC>['create']['router']

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: {}, code: 'RPC_OK' }), {
        headers: { 'content-type': 'application/json' },
      }),
    )

    const t = initRPC().create()
    const proc = t.procedure().query(async () => R.ok({}, 'RPC_OK'))
    router = t.router({ hello: proc })
  })

  it('should create a proxy client', () => {
    const client = createRPCProxyClient({
      baseUrl: 'http://localhost',
      fetch: mockFetch as never as typeof fetch,
    })

    expect(client).toBeDefined()
  })

  it('should build paths correctly', async () => {
    const client = createRPCProxyClient({
      baseUrl: 'http://localhost',
      fetch: mockFetch as never as typeof fetch,
    })

    // @ts-expect-error - proxy client type checking
    await client.hello.query({})

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/rpc/hello'), expect.any(Object))
  })

  it('should handle nested paths', async () => {
    const t = initRPC().create()
    const proc = t.procedure().query(async () => R.ok({}, 'RPC_OK'))
    const nestedRouter = t.router({ nested: proc })
    const router = t.router({ user: nestedRouter })

    const client = createRPCProxyClient({
      baseUrl: 'http://localhost',
      fetch: mockFetch as never as typeof fetch,
    })

    // @ts-expect-error - proxy client type checking
    await client.user.nested.query({})

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/rpc/user.nested'), expect.any(Object))
  })
})
