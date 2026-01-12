/**
 * Tests for request metadata utilities.
 *
 * Covers:
 * - WeakMap-based metadata storage
 * - Request ID generation
 * - Start time tracking
 * - Memory leak prevention
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getRequestMetadata, getRequestMetadataIfExists } from '../request-metadata'

describe('request-metadata', () => {
  beforeEach(() => {
    // WeakMap automatically cleans up, but we can't easily test that
    // without exposing internals or using GC
  })

  it('should create metadata for a request', () => {
    const req = new Request('http://localhost/test')
    const metadata = getRequestMetadata(req)

    expect(metadata).toHaveProperty('requestId')
    expect(metadata).toHaveProperty('startTime')
    expect(typeof metadata.requestId).toBe('string')
    expect(typeof metadata.startTime).toBe('number')
    expect(metadata.requestId.length).toBeGreaterThan(0)
  })

  it('should return same metadata for same request', () => {
    const req = new Request('http://localhost/test')
    const metadata1 = getRequestMetadata(req)
    const metadata2 = getRequestMetadata(req)

    expect(metadata1).toBe(metadata2)
    expect(metadata1.requestId).toBe(metadata2.requestId)
    expect(metadata1.startTime).toBe(metadata2.startTime)
  })

  it('should return different metadata for different requests', () => {
    const req1 = new Request('http://localhost/test1')
    const req2 = new Request('http://localhost/test2')
    const metadata1 = getRequestMetadata(req1)
    const metadata2 = getRequestMetadata(req2)

    expect(metadata1.requestId).not.toBe(metadata2.requestId)
  })

  it('should generate unique request IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const req = new Request(`http://localhost/test${i}`)
      const metadata = getRequestMetadata(req)
      ids.add(metadata.requestId)
    }

    // All IDs should be unique
    expect(ids.size).toBe(100)
  })

  it('should track start time', () => {
    const before = performance.now()
    const req = new Request('http://localhost/test')
    const metadata = getRequestMetadata(req)
    const after = performance.now()

    expect(metadata.startTime).toBeGreaterThanOrEqual(before)
    expect(metadata.startTime).toBeLessThanOrEqual(after)
  })

  it('should return undefined for non-existent metadata', () => {
    const req = new Request('http://localhost/test')
    const metadata = getRequestMetadataIfExists(req)
    expect(metadata).toBeUndefined()
  })

  it('should return metadata if it exists', () => {
    const req = new Request('http://localhost/test')
    const created = getRequestMetadata(req)
    const retrieved = getRequestMetadataIfExists(req)

    expect(retrieved).toBe(created)
  })
})
