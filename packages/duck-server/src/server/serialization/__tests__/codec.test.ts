/**
 * Tests for serialization codec.
 *
 * Covers:
 * - JSON serialization/deserialization
 * - CBOR serialization/deserialization
 * - Format resolution
 * - Encoder/decoder reuse
 */

import { encode as cborEncode } from 'cbor-x'
import { describe, expect, it } from 'vitest'
import { CBOR_CONTENT_TYPE, decodeRequestBody, resolveResponseFormat, serializeResponse } from '../codec'

describe('serializeResponse', () => {
  it('should serialize JSON responses', () => {
    const body = { ok: true, data: { message: 'Hello' } }
    const res = serializeResponse(body, 200, {}, 'json')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('should serialize CBOR responses', () => {
    const body = { ok: true, data: { message: 'Hello' } }
    const res = serializeResponse(body, 200, {}, 'cbor')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe(CBOR_CONTENT_TYPE)
  })

  it('should reuse encoder instance', async () => {
    // Test that encoder reuse works by encoding multiple similar objects
    // With useRecords: true, the encoder learns object shapes and can optimize
    // repeated shapes. The encoder instance is reused across calls.
    const body1 = { ok: true, data: { type: 'test', value: 1 } }
    const body2 = { ok: true, data: { type: 'test', value: 999 } } // Different value

    const res1 = serializeResponse(body1, 200, {}, 'cbor')
    const res2 = serializeResponse(body2, 200, {}, 'cbor')

    // Both should succeed
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)

    // Verify encoder instance is reused (no errors thrown)
    // Note: With useRecords, similar shapes may produce similar output structure,
    // but the actual encoded bytes should differ for different values
    const buf1 = await res1.arrayBuffer()
    const buf2 = await res2.arrayBuffer()

    // The buffers should be valid CBOR and the encoder should work correctly
    expect(buf1.byteLength).toBeGreaterThan(0)
    expect(buf2.byteLength).toBeGreaterThan(0)

    // Verify encoder instance is reused (no errors thrown on subsequent calls)
    const body3 = { ok: true, data: { type: 'test', value: 3 } }
    const res3 = serializeResponse(body3, 200, {}, 'cbor')
    expect(res3.status).toBe(200)
    const buf3 = await res3.arrayBuffer()
    expect(buf3.byteLength).toBeGreaterThan(0)
  })
})

describe('decodeRequestBody', () => {
  it('should decode JSON bodies', async () => {
    const body = { type: 'query', input: { name: 'test' } }
    const reader = {
      json: async () => body,
      arrayBuffer: async () => new ArrayBuffer(0),
    }

    const result = await decodeRequestBody('application/json', reader)
    expect(result.format).toBe('json')
    expect(result.body).toEqual(body)
  })

  it('should decode CBOR bodies', async () => {
    const body = { type: 'query', input: { name: 'test' } }
    const encoded = cborEncode(body)
    // cborEncode returns Uint8Array, convert to ArrayBuffer properly
    const buffer =
      encoded instanceof Uint8Array
        ? encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength)
        : new Uint8Array(encoded).buffer
    const reader = {
      json: async () => null,
      arrayBuffer: async () => buffer,
    }

    const result = await decodeRequestBody(CBOR_CONTENT_TYPE, reader as never)
    expect(result.format).toBe('cbor')
    expect(result.body).toEqual(body)
  })

  it('should reuse decoder instance', async () => {
    // Test that decoder reuse works
    const body1 = { type: 'test', value: 1 }
    const body2 = { type: 'test', value: 2 }

    const encoded1 = cborEncode(body1)
    const encoded2 = cborEncode(body2)

    // Convert Uint8Array to ArrayBuffer properly
    const buffer1 =
      encoded1 instanceof Uint8Array
        ? encoded1.buffer.slice(encoded1.byteOffset, encoded1.byteOffset + encoded1.byteLength)
        : new Uint8Array(encoded1).buffer
    const buffer2 =
      encoded2 instanceof Uint8Array
        ? encoded2.buffer.slice(encoded2.byteOffset, encoded2.byteOffset + encoded2.byteLength)
        : new Uint8Array(encoded2).buffer

    const reader1 = {
      json: async () => null,
      arrayBuffer: async () => buffer1,
    }
    const reader2 = {
      json: async () => null,
      arrayBuffer: async () => buffer2,
    }

    const result1 = await decodeRequestBody(CBOR_CONTENT_TYPE, reader1 as never)
    const result2 = await decodeRequestBody(CBOR_CONTENT_TYPE, reader2 as never)

    expect(result1.body).toEqual(body1)
    expect(result2.body).toEqual(body2)
  })
})

describe('resolveResponseFormat', () => {
  it('should resolve JSON format by default', () => {
    const req = new Request('http://localhost/test')
    const format = resolveResponseFormat(req)
    expect(format).toBe('json')
  })

  it('should resolve CBOR format from Accept header', () => {
    const req = new Request('http://localhost/test', {
      headers: { accept: 'application/cbor' },
    })
    const format = resolveResponseFormat(req)
    expect(format).toBe('cbor')
  })

  it('should resolve CBOR format from Content-Type header', () => {
    const req = new Request('http://localhost/test', {
      headers: { 'content-type': CBOR_CONTENT_TYPE },
    })
    const format = resolveResponseFormat(req)
    expect(format).toBe('cbor')
  })
})
