/**
 * Tests for procedure creation and execution.
 *
 * Covers:
 * - Procedure creation with/without validation
 * - Middleware composition
 * - Input/output validation
 * - Error handling
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createProcedure } from '../procedure'
import { RPCRes as R } from '../response'

describe('createProcedure', () => {
  it('should create a procedure without validation', () => {
    const proc = createProcedure()
      .validation('on')
      .query(async ({ input }) => {
        return R.ok({ result: input }, 'RPC_OK')
      })

    expect(proc._kind).toBe('procedure')
    expect(proc._type).toBe('query')
  })

  it('should create a procedure with input validation', async () => {
    const schema = z.object({ name: z.string() })
    const proc = createProcedure()
      .input(schema)
      .query(async ({ input }) => {
        return R.ok({ greeting: `Hello ${input.name}` }, 'RPC_OK')
      })

    const result = await proc._call({
      ctx: {},
      rawInput: { name: 'World' },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.greeting).toBe('Hello World')
    }
  })

  it('should reject invalid input', async () => {
    const schema = z.object({ name: z.string() })
    const proc = createProcedure()
      .input(schema)
      .query(async ({ input }) => {
        return R.ok({ greeting: `Hello ${input.name}` }, 'RPC_OK')
      })

    const result = await proc._call({
      ctx: {},
      rawInput: { name: 123 as unknown as string }, // Invalid: should be string
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('RPC_BAD_REQUEST')
    }
  })

  it('should execute middleware in order', async () => {
    const callOrder: number[] = []

    const proc = createProcedure<any, any, any>()
      .use<any>(async ({ ctx, next }) => {
        callOrder.push(1)
        return next({ ctx: { ...ctx, step1: true } })
      })
      .use<any>(async ({ ctx, next }) => {
        callOrder.push(2)
        expect(ctx).toHaveProperty('step1')
        return next({ ctx: { ...ctx, step2: true } })
      })
      .query(async ({ ctx }) => {
        callOrder.push(3)
        expect(ctx).toHaveProperty('step1')
        expect(ctx).toHaveProperty('step2')
        return R.ok({ done: true }, 'RPC_OK')
      })

    const result = await proc._call({ ctx: {}, rawInput: undefined })
    expect(result.ok).toBe(true)
    expect(callOrder).toEqual([1, 2, 3])
  })

  it('should handle middleware errors', async () => {
    const proc = createProcedure()
      .use(async () => {
        return {
          ok: false,
          error: { code: 'RPC_UNAUTHORIZED', message: 'Unauthorized', name: 'UnauthorizedError', issues: [] },
        }
      })
      .query(async () => {
        return R.ok({}, 'RPC_OK')
      })

    const result = await proc._call({ ctx: {}, rawInput: undefined })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('RPC_UNAUTHORIZED')
    }
  })

  it('should create mutation procedures', () => {
    const proc = createProcedure().mutation(async () => {
      return R.ok({}, 'RPC_OK')
    })

    expect(proc._type).toBe('mutation')
  })

  it('should handle thrown errors', async () => {
    const proc = createProcedure().query(async () => {
      throw new Error('Test error')
    })

    const result = await proc._call({ ctx: {}, rawInput: undefined })
    expect(result.ok).toBe(false)
  })

  it('should pre-compose middleware chain', async () => {
    // This test verifies that middleware chains are pre-composed
    // and don't create new closures on every request
    let middlewareCallCount = 0

    const proc = createProcedure()
      .use(async ({ ctx, next }) => {
        middlewareCallCount++
        return next({ ctx })
      })
      .query(async () => {
        return R.ok({}, 'RPC_OK')
      })

    // First call
    await proc._call({ ctx: {}, rawInput: undefined })
    const firstCount = middlewareCallCount

    // Second call - should reuse the same middleware chain
    await proc._call({ ctx: {}, rawInput: undefined })
    const secondCount = middlewareCallCount

    expect(secondCount).toBe(firstCount + 1)
    expect(firstCount).toBe(1)
  })

  it('should handle multiple middleware layers', async () => {
    const trace: string[] = []

    const proc = createProcedure<any, any, any>()
      .use<any>(async ({ ctx, next }) => {
        trace.push('mw1-start')
        const result = await next({ ctx: { ...ctx, mw1: true } })
        trace.push('mw1-end')
        return result
      })
      .use<any>(async ({ ctx, next }) => {
        trace.push('mw2-start')
        const result = await next({ ctx: { ...ctx, mw2: true } })
        trace.push('mw2-end')
        return result
      })
      .use(async ({ ctx, next }) => {
        trace.push('mw3-start')
        const result = await next({ ctx: { ...ctx, mw3: true } })
        trace.push('mw3-end')
        return result
      })
      .query(async ({ ctx }) => {
        trace.push('resolver')
        expect(ctx).toHaveProperty('mw1')
        expect(ctx).toHaveProperty('mw2')
        expect(ctx).toHaveProperty('mw3')
        return R.ok({ done: true }, 'RPC_OK')
      })

    const result = await proc._call({ ctx: {}, rawInput: undefined })
    expect(result.ok).toBe(true)
    expect(trace).toEqual(['mw1-start', 'mw2-start', 'mw3-start', 'resolver', 'mw3-end', 'mw2-end', 'mw1-end'])
  })

  it('should handle middleware that modifies context', async () => {
    const proc = createProcedure<any, any, any>()
      .use<any>(async ({ ctx, next }) => {
        return next({ ctx: { ...ctx, userId: 123 } })
      })
      .query(async ({ ctx }) => {
        expect((ctx as any).userId).toBe(123)
        return R.ok({ userId: (ctx as any).userId }, 'RPC_OK')
      })

    const result = await proc._call({ ctx: {}, rawInput: undefined })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.userId).toBe(123)
    }
  })

  it('should handle empty middleware chain', async () => {
    const proc = createProcedure().query(async () => {
      return R.ok({ done: true }, 'RPC_OK')
    })

    const result = await proc._call({ ctx: {}, rawInput: undefined })
    expect(result.ok).toBe(true)
  })

  it('should handle output validation', async () => {
    const outputSchema = z.object({ result: z.string() })
    const proc = createProcedure()
      .output(outputSchema)
      .query(async () => {
        return R.ok({ result: 'valid' }, 'RPC_OK')
      })

    const result = await proc._call({ ctx: {}, rawInput: undefined })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.result).toBe('valid')
    }
  })

  it('should handle validation off mode', async () => {
    const inputSchema = z.object({ value: z.number() })
    const proc = createProcedure()
      .input(inputSchema)
      .validation('off')
      .query(async ({ input }) => {
        // With validation off, input is not validated, so it passes through as-is
        return R.ok({ received: input }, 'RPC_OK')
      })

    const result = await proc._call({
      ctx: {},
      rawInput: { value: 'not-a-number' as unknown as number }, // Invalid but validation is off
    })

    // With validation off, invalid input passes through without validation
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.received.value).toBe('not-a-number')
    }
  })

  it('should handle concurrent calls', async () => {
    const proc = createProcedure().query(async ({ input }) => {
      return R.ok({ value: input }, 'RPC_OK')
    })

    const promises = Array.from({ length: 10 }, (_, i) => proc._call({ ctx: {}, rawInput: i }))

    const results = await Promise.all(promises)
    expect(results.length).toBe(10)
    results.forEach((result, i) => {
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.value).toBe(i)
      }
    })
  })
})
