/**
 * Tests for low-level RPC client.
 *
 * Covers:
 * - Client creation
 * - Query calls
 * - Mutation calls
 * - Format handling
 * - Error handling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRPCClient } from '../low-level-client'

describe('createRPCClient', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
  })

  it('should create a client', () => {
    const client = createRPCClient({
      baseUrl: 'http://localhost',
      fetch: mockFetch as never as typeof fetch,
    })

    expect(client).toHaveProperty('call')
    expect(client).toHaveProperty('query')
    expect(client).toHaveProperty('mutation')
  })

  it('should make query calls', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { result: 'test' }, code: 'RPC_OK' }), {
        headers: { 'content-type': 'application/json' },
      }),
    )

    const client = createRPCClient({
      baseUrl: 'http://localhost',
      fetch: mockFetch as never as typeof fetch,
    })

    const result = await client.query('test.path', { input: 'value' })

    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/rpc/test.path'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('should make mutation calls', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { result: 'test' }, code: 'RPC_OK' }), {
        headers: { 'content-type': 'application/json' },
      }),
    )

    const client = createRPCClient({
      baseUrl: 'http://localhost',
      fetch: mockFetch as never as typeof fetch,
    })

    const result = await client.mutation('test.path', { input: 'value' })

    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/rpc/test.path'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('should handle CBOR format', async () => {
    // Create a proper CBOR-encoded response
    const { encode } = await import('cbor-x')
    const responseData = { ok: true, data: { result: 'test' }, code: 'RPC_OK' }
    const cborData = encode(responseData)

    mockFetch.mockResolvedValue(
      new Response(cborData, {
        headers: { 'content-type': 'application/cbor' },
      }),
    )

    const client = createRPCClient({
      baseUrl: 'http://localhost',
      format: 'cbor',
      fetch: mockFetch as never as typeof fetch,
    })

    const result = await client.query('test.path')

    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: 'application/cbor',
        }),
      }),
    )
  })

  it('should handle errors', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: 'RPC_ERROR', message: 'Test' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const client = createRPCClient({
      baseUrl: 'http://localhost',
      fetch: mockFetch as never as typeof fetch,
    })

    const result = await client.query('test.path')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('RPC_ERROR')
    }
  })
})
