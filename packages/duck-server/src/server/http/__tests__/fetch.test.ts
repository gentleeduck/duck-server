/**
 * Tests for fetch request handler.
 *
 * Covers:
 * - Request routing
 * - Procedure execution
 * - Error handling
 * - Format resolution
 * - Path parsing
 */

import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createProcedure } from '../../core/procedure'
import { RPCRes as R } from '../../core/response'
import { createRouter } from '../../core/router'
import { fetchRequestHandler } from '../fetch'

describe('fetchRequestHandler', () => {
  it('should handle POST query requests', async () => {
    const proc = createProcedure()
      .input(z.object({ name: z.string() }))
      .query(async ({ input }) => {
        return R.ok({ greeting: `Hello ${input.name}` }, 'RPC_OK')
      })

    const router = createRouter({ hello: proc })
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

  it('should handle GET query requests', async () => {
    const proc = createProcedure().query(async () => {
      return R.ok({ message: 'Hello' }, 'RPC_OK')
    })

    const router = createRouter({ hello: proc })
    const req = new Request('http://localhost/rpc/hello?type=query')

    const res = await fetchRequestHandler({
      router,
      createContext: () => ({}),
      req,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it('should return 404 for non-existent procedures', async () => {
    const router = createRouter({})
    const req = new Request('http://localhost/rpc/nonexistent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'query', input: {} }),
    })

    const res = await fetchRequestHandler({
      router,
      createContext: () => ({}),
      req,
    })

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.ok).toBe(false)
  })

  it('should return 400 for invalid method', async () => {
    const router = createRouter({})
    const req = new Request('http://localhost/rpc/hello', {
      method: 'PUT',
    })

    const res = await fetchRequestHandler({
      router,
      createContext: () => ({}),
      req,
    })

    expect(res.status).toBe(400)
  })

  it('should handle procedure type mismatch', async () => {
    const proc = createProcedure().mutation(async () => R.ok({}, 'RPC_OK'))
    const router = createRouter({ hello: proc })
    const req = new Request('http://localhost/rpc/hello', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'query', input: {} }),
    })

    const res = await fetchRequestHandler({
      router,
      createContext: () => ({}),
      req,
    })

    expect(res.status).toBe(400)
  })

  it('should handle validation errors', async () => {
    const proc = createProcedure()
      .input(z.object({ name: z.string() }))
      .query(async () => R.ok({}, 'RPC_OK'))

    const router = createRouter({ hello: proc })
    const req = new Request('http://localhost/rpc/hello', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'query', input: { name: 123 } }),
    })

    const res = await fetchRequestHandler({
      router,
      createContext: () => ({}),
      req,
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.ok).toBe(false)
  })

  it('should resolve CBOR format', async () => {
    const proc = createProcedure().query(async () => R.ok({}, 'RPC_OK'))
    const router = createRouter({ hello: proc })
    const req = new Request('http://localhost/rpc/hello?type=query', {
      headers: { accept: 'application/cbor' },
    })

    const res = await fetchRequestHandler({
      router,
      createContext: () => ({}),
      req,
    })

    expect(res.headers.get('content-type')).toContain('application/cbor')
  })
})
