/**
 * Payload generators for benchmark scenarios.
 *
 * Creates various payload sizes to test performance across different
 * data sizes and validate serialization/deserialization overhead.
 */

import { Static, Type } from '@sinclair/typebox'
import { type } from 'arktype'
import { array, number, object, string } from 'valibot'
import { z } from 'zod'

/**
 * Benchmark input schema using Zod (default validation library).
 */
export const benchInputSchema = z.object({
  text: z.string(),
  iterations: z.number().int().nonnegative(),
  numbers: z.array(z.number()),
})

export type BenchInput = z.infer<typeof benchInputSchema>

/**
 * Benchmark output type.
 */
export type BenchOutput = {
  length: number
  checksum: number
  sum: number
}

/**
 * Valibot schema for comparison benchmarks.
 */
export const benchInputSchemaValibot = object({
  text: string(),
  iterations: number(),
  numbers: array(number()),
})

/**
 * Arktype schema for comparison benchmarks.
 */
export const benchInputSchemaArktype = type({
  text: 'string',
  iterations: 'number',
  numbers: 'number[]',
})

/**
 * TypeBox schema for comparison benchmarks.
 */
export const benchInputSchemaTypeBox = Type.Object({
  text: Type.String(),
  iterations: Type.Integer({ minimum: 0 }),
  numbers: Type.Array(Type.Number()),
})

export type BenchInputTypeBox = Static<typeof benchInputSchemaTypeBox>

/**
 * Create a benchmark input payload with specified characteristics.
 *
 * @param opts - Payload generation options
 * @param opts.textSize - Size of the text field in bytes
 * @param opts.iterations - Number of iterations for computation
 * @param opts.numbersCount - Number of numbers in the array
 * @returns Benchmark input payload
 */
export function createBenchInput(opts: { textSize: number; iterations: number; numbersCount: number }): BenchInput {
  const text = 'x'.repeat(opts.textSize)
  const numbers = Array.from({ length: opts.numbersCount }, (_, i) => i)
  return { text, iterations: opts.iterations, numbers }
}

/**
 * Compute benchmark output from input.
 * Simulates a realistic computation workload.
 *
 * @param input - Benchmark input
 * @returns Benchmark output with computed values
 */
export function computeBench(input: BenchInput): BenchOutput {
  let checksum = 0
  for (let i = 0; i < input.text.length; i += 1) {
    checksum = (checksum + input.text.charCodeAt(i)) & 0xfffffff
  }

  let sum = 0
  for (let i = 0; i < input.iterations; i += 1) {
    sum += i % 97
  }

  for (let i = 0; i < input.numbers.length; i += 1) {
    sum += input.numbers[i]!
  }

  return {
    length: input.text.length,
    checksum,
    sum,
  }
}

/**
 * Pre-defined payload sizes for consistent benchmarking.
 */
export const PAYLOAD_SIZES = {
  tiny: { textSize: 100, iterations: 50, numbersCount: 8 },
  small: { textSize: 1024, iterations: 200, numbersCount: 32 },
  medium: { textSize: 4 * 1024, iterations: 200, numbersCount: 32 },
  large: { textSize: 16 * 1024, iterations: 200, numbersCount: 32 },
  xlarge: { textSize: 64 * 1024, iterations: 200, numbersCount: 64 },
  xxlarge: { textSize: 256 * 1024, iterations: 200, numbersCount: 128 },
} as const

/**
 * Generate all standard payloads for benchmarking.
 */
export function generateStandardPayloads() {
  return {
    tiny: createBenchInput(PAYLOAD_SIZES.tiny),
    small: createBenchInput(PAYLOAD_SIZES.small),
    medium: createBenchInput(PAYLOAD_SIZES.medium),
    large: createBenchInput(PAYLOAD_SIZES.large),
    xlarge: createBenchInput(PAYLOAD_SIZES.xlarge),
    xxlarge: createBenchInput(PAYLOAD_SIZES.xxlarge),
  }
}
