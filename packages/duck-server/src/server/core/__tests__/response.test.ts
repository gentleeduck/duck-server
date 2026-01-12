/**
 * Tests for response utilities.
 *
 * Covers:
 * - RPCRes creation
 * - Error conversion
 * - Response type guards
 * - All response functions
 */

import { describe, expect, it } from 'vitest'
import { RPC_CODES } from '../codes'
import { createRPCError } from '../error'
import { RPCRes as R, rpcErr, rpcOk, rpcToErr, rpcToLog } from '../response'

describe('rpcOk', () => {
  it('should create success response', () => {
    const res = rpcOk({ data: 'test' }, 'RPC_OK')
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data).toEqual({ data: 'test' })
      expect(res.code).toBe('RPC_OK')
    }
  })

  it('should handle different data types', () => {
    expect(rpcOk(null, 'RPC_OK').ok).toBe(true)
    expect(rpcOk(undefined, 'RPC_OK').ok).toBe(true)
    expect(rpcOk(123, 'RPC_OK').ok).toBe(true)
    expect(rpcOk('string', 'RPC_OK').ok).toBe(true)
    expect(rpcOk([1, 2, 3], 'RPC_OK').ok).toBe(true)
  })

  it('should use custom codes', () => {
    const res = rpcOk({}, 'RPC_CREATED')
    expect(res.code).toBe('RPC_CREATED')
  })
})

describe('rpcErr', () => {
  it('should create error response', () => {
    const res = rpcErr('RPC_BAD_REQUEST', 'Test error')
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('RPC_BAD_REQUEST')
      expect(res.error.message).toBe('Test error')
      expect(res.code).toBe('RPC_BAD_REQUEST')
    }
  })

  it('should use default message when not provided', () => {
    const res = rpcErr('RPC_BAD_REQUEST')
    if (!res.ok) {
      expect(res.error.message).toBe('NOT_PROVIDED')
    }
  })

  it('should handle issues', () => {
    const issues = [{ message: 'Invalid', path: ['field'] }]
    const res = rpcErr('RPC_VALIDATION_ERROR', 'Validation failed', issues)
    if (!res.ok) {
      expect(res.error.issues).toEqual(issues)
    }
  })

  it('should handle empty issues', () => {
    const res = rpcErr('RPC_BAD_REQUEST', 'Error', [])
    if (!res.ok) {
      expect(res.error.issues).toEqual([])
    }
  })
})

describe('RPCRes (back-compat)', () => {
  it('should provide ok helper', () => {
    const res = R.ok({ data: 'test' }, 'RPC_OK')
    expect(res.ok).toBe(true)
  })

  it('should provide err helper', () => {
    const res = R.err('RPC_BAD_REQUEST', 'Error')
    expect(res.ok).toBe(false)
  })

  it('should provide toErr helper', () => {
    const error = new Error('Test')
    const [err, status] = R.toErr(error)
    expect(err.ok).toBe(false)
    expect(status).toBe(500)
  })

  it('should provide toLog helper', () => {
    const res = rpcOk({ data: 'test' }, 'RPC_OK')
    const log = R.toLog(res)
    expect(typeof log).toBe('string')
    expect(JSON.parse(log)).toHaveProperty('ok', true)
  })
})

describe('rpcToErr', () => {
  it('should convert RPCError to error response', () => {
    const error = createRPCError({ code: 'RPC_BAD_REQUEST', message: 'Test' })
    const [err, status] = rpcToErr(error)

    expect(err.ok).toBe(false)
    expect(status).toBe(RPC_CODES.RPC_BAD_REQUEST)
    if (!err.ok) {
      expect(err.error.code).toBe('RPC_BAD_REQUEST')
      expect(err.error.message).toBe('Test')
    }
  })

  it('should convert RPCError with issues', () => {
    const issues = [{ message: 'Invalid', path: ['field'] }]
    const error = createRPCError({
      code: 'RPC_VALIDATION_ERROR',
      message: 'Validation failed',
      issues,
    })
    const [err, status] = rpcToErr(error)

    if (!err.ok) {
      expect(err.error.issues).toEqual(issues)
      expect(status).toBe(RPC_CODES.RPC_VALIDATION_ERROR)
    }
  })

  it('should convert regular Error to internal server error', () => {
    const error = new Error('Test error')
    const [err, status] = rpcToErr(error)

    expect(err.ok).toBe(false)
    expect(status).toBe(RPC_CODES.RPC_INTERNAL_SERVER_ERROR)
    if (!err.ok) {
      expect(err.error.code).toBe('RPC_INTERNAL_SERVER_ERROR')
    }
  })

  it('should handle unknown error types', () => {
    const testCases = ['string error', null, undefined, 123, { custom: 'error' }, []]

    for (const testCase of testCases) {
      const [err, status] = rpcToErr(testCase)
      expect(err.ok).toBe(false)
      expect(status).toBe(RPC_CODES.RPC_INTERNAL_SERVER_ERROR)
    }
  })

  it('should handle all RPC error codes', () => {
    const codes = Object.keys(RPC_CODES) as Array<keyof typeof RPC_CODES>
    for (const code of codes) {
      if (code.startsWith('RPC_') && code !== 'RPC_OK' && code !== 'RPC_CREATED') {
        const error = createRPCError({ code, message: 'Test' })
        const [err, status] = rpcToErr(error)
        expect(err.ok).toBe(false)
        expect(status).toBe(RPC_CODES[code])
      }
    }
  })

  it('should handle custom RPC codes', () => {
    const error = createRPCError({ code: 'RPC_CUSTOM_ERROR' as any, message: 'Test' })
    const [err, status] = rpcToErr(error)
    expect(err.ok).toBe(false)
    // Custom codes should fallback to 500
    expect(status).toBe(RPC_CODES.RPC_INTERNAL_SERVER_ERROR)
  })
})

describe('rpcToLog', () => {
  it('should serialize success responses', () => {
    const res = rpcOk({ data: 'test' }, 'RPC_OK')
    const log = rpcToLog(res)
    const parsed = JSON.parse(log)
    expect(parsed.ok).toBe(true)
    expect(parsed.data).toEqual({ data: 'test' })
  })

  it('should serialize error responses', () => {
    const res = rpcErr('RPC_BAD_REQUEST', 'Error')
    const log = rpcToLog(res)
    const parsed = JSON.parse(log)
    expect(parsed.ok).toBe(false)
    expect(parsed.error.code).toBe('RPC_BAD_REQUEST')
  })
})
