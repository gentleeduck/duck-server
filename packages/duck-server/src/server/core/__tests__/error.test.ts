/**
 * Tests for error handling.
 *
 * Covers:
 * - RPCError creation
 * - Error codes
 * - Error serialization
 * - Error conversion
 * - Type guards
 */

import { describe, expect, it } from 'vitest'
import { RPC_CODES } from '../codes'
import { createRPCError, isRPCError, RPCError, rpcErrorFrom } from '../error'

describe('RPCError', () => {
  it('should create an RPC error', () => {
    const error = new RPCError({
      code: 'RPC_BAD_REQUEST',
      message: 'Test error',
    })

    expect(error.code).toBe('RPC_BAD_REQUEST')
    expect(error.message).toBe('Test error')
    expect(error.name).toBe('RPCError')
    expect(error).toBeInstanceOf(Error)
  })

  it('should create error with issues', () => {
    const error = new RPCError({
      code: 'RPC_BAD_REQUEST',
      message: 'Validation failed',
      issues: [{ message: 'Invalid field', path: ['name'] }],
    })

    expect(error.issues).toHaveLength(1)
    expect(error.issues![0]?.message).toBe('Invalid field')
    expect(error.issues![0]?.path).toEqual(['name'])
  })

  it('should create error with cause', () => {
    const cause = new Error('Original error')
    const error = new RPCError({
      code: 'RPC_INTERNAL_SERVER_ERROR',
      message: 'Wrapped error',
      cause,
    })

    expect(error.cause).toBe(cause)
  })

  it('should use createRPCError helper', () => {
    const error = createRPCError({
      code: 'RPC_NOT_FOUND',
      message: 'Not found',
    })

    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('RPC_NOT_FOUND')
    expect(error.name).toBe('RPCError')
  })

  it('should handle empty issues array', () => {
    const error = createRPCError({
      code: 'RPC_BAD_REQUEST',
      message: 'Error',
      issues: [],
    })

    expect(error.issues).toEqual([])
  })

  it('should handle undefined issues', () => {
    const error = createRPCError({
      code: 'RPC_BAD_REQUEST',
      message: 'Error',
    })

    expect(error.issues).toEqual([])
  })
})

describe('isRPCError', () => {
  it('should identify RPCError instances', () => {
    const error = createRPCError({ code: 'RPC_BAD_REQUEST', message: 'Test' })
    expect(isRPCError(error)).toBe(true)
  })

  it('should reject regular Error instances', () => {
    const error = new Error('Regular error')
    expect(isRPCError(error)).toBe(false)
  })

  it('should reject non-error values', () => {
    expect(isRPCError(null)).toBe(false)
    expect(isRPCError(undefined)).toBe(false)
    expect(isRPCError('string')).toBe(false)
    expect(isRPCError(123)).toBe(false)
    expect(isRPCError({})).toBe(false)
  })
})

describe('rpcErrorFrom', () => {
  it('should return RPCError as-is', () => {
    const error = createRPCError({ code: 'RPC_BAD_REQUEST', message: 'Test' })
    const result = rpcErrorFrom(error)
    expect(result).toBe(error)
  })

  it('should convert regular Error to RPCError', () => {
    const error = new Error('Regular error')
    const result = rpcErrorFrom(error)

    expect(isRPCError(result)).toBe(true)
    expect(result.code).toBe('RPC_INTERNAL_SERVER_ERROR')
    expect(result.message).toBe('Regular error')
    expect(result.cause).toBe(error)
  })

  it('should handle unknown error types', () => {
    const result1 = rpcErrorFrom('string error')
    expect(isRPCError(result1)).toBe(true)
    expect(result1.code).toBe('RPC_INTERNAL_SERVER_ERROR')
    expect(result1.message).toBe('Unknown error')

    const result2 = rpcErrorFrom(null)
    expect(isRPCError(result2)).toBe(true)
    expect(result2.code).toBe('RPC_INTERNAL_SERVER_ERROR')

    const result3 = rpcErrorFrom({ custom: 'error' })
    expect(isRPCError(result3)).toBe(true)
    expect(result3.code).toBe('RPC_INTERNAL_SERVER_ERROR')
  })
})

describe('RPC_CODES', () => {
  it('should have status codes for all error types', () => {
    expect(RPC_CODES.RPC_OK).toBe(200)
    expect(RPC_CODES.RPC_CREATED).toBe(201)
    expect(RPC_CODES.RPC_BAD_REQUEST).toBe(400)
    expect(RPC_CODES.RPC_UNAUTHORIZED).toBe(401)
    expect(RPC_CODES.RPC_FORBIDDEN).toBe(403)
    expect(RPC_CODES.RPC_NOT_FOUND).toBe(404)
    expect(RPC_CODES.RPC_METHOD_NOT_ALLOWED).toBe(405)
    expect(RPC_CODES.RPC_TIMEOUT).toBe(408)
    expect(RPC_CODES.RPC_CONFLICT).toBe(409)
    expect(RPC_CODES.RPC_PRECONDITION_FAILED).toBe(412)
    expect(RPC_CODES.RPC_PAYLOAD_TOO_LARGE).toBe(413)
    expect(RPC_CODES.RPC_UNSUPPORTED_MEDIA_TYPE).toBe(415)
    expect(RPC_CODES.RPC_TOO_MANY_REQUESTS).toBe(429)
    expect(RPC_CODES.RPC_INTERNAL_SERVER_ERROR).toBe(500)
    expect(RPC_CODES.RPC_NOT_IMPLEMENTED).toBe(501)
    expect(RPC_CODES.RPC_BAD_GATEWAY).toBe(502)
    expect(RPC_CODES.RPC_SERVICE_UNAVAILABLE).toBe(503)
    expect(RPC_CODES.RPC_GATEWAY_TIMEOUT).toBe(504)
    expect(RPC_CODES.RPC_PARSE_ERROR).toBe(460)
    expect(RPC_CODES.RPC_VALIDATION_ERROR).toBe(461)
    expect(RPC_CODES.RPC_PROCEDURE_NOT_FOUND).toBe(462)
    expect(RPC_CODES.RPC_CONTEXT_ERROR).toBe(463)
    expect(RPC_CODES.RPC_MIDDLEWARE_ERROR).toBe(464)
    expect(RPC_CODES.RPC_SERIALIZATION_ERROR).toBe(465)
  })

  it('should have all codes as const', () => {
    // Verify all codes are defined and have numeric values
    const codes = RPC_CODES
    const codeKeys = Object.keys(codes)
    expect(codeKeys.length).toBeGreaterThan(0)
    // All values should be numbers
    for (const key of codeKeys) {
      expect(typeof codes[key as keyof typeof codes]).toBe('number')
    }
  })
})
