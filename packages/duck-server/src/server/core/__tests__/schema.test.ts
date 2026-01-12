/**
 * Tests for schema validation.
 *
 * Covers:
 * - Input parsing
 * - Output parsing
 * - Validation errors
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { isRPCError } from '../error'
import { parseInput, parseOutput } from '../schema'

describe('parseInput', () => {
  it('should parse valid input', async () => {
    const schema = z.object({ name: z.string() })
    const result = await parseInput(schema, { name: 'test' })
    expect(result).toEqual({ name: 'test' })
  })

  it('should throw on invalid input', async () => {
    const schema = z.object({ name: z.string() })
    try {
      await parseInput(schema, { name: 123 })
      expect.fail('Should have thrown')
    } catch (error) {
      expect(isRPCError(error)).toBe(true)
      if (isRPCError(error)) {
        expect(error.code).toBe('RPC_BAD_REQUEST')
      }
    }
  })
})

describe('parseOutput', () => {
  it('should parse valid output', async () => {
    const schema = z.object({ result: z.string() })
    const result = await parseOutput(schema, { result: 'test' })
    expect(result).toEqual({ result: 'test' })
  })

  it('should throw on invalid output', async () => {
    const schema = z.object({ result: z.string() })
    try {
      await parseOutput(schema, { result: 123 })
      expect.fail('Should have thrown')
    } catch (error) {
      expect(isRPCError(error)).toBe(true)
      if (isRPCError(error)) {
        expect(error.code).toBe('RPC_INTERNAL_SERVER_ERROR')
      }
    }
  })
})
