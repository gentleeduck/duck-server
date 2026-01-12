import { Static, Type } from '@sinclair/typebox'
import { type } from 'arktype'
import { array, number, object, string } from 'valibot'
import { z } from 'zod'

export const benchInputSchema = z.object({
  text: z.string(),
  iterations: z.number().int().nonnegative(),
  numbers: z.array(z.number()),
})

export type BenchInput = z.infer<typeof benchInputSchema>

// Valibot schema
export const benchInputSchemaValibot = object({
  text: string(),
  iterations: number(),
  numbers: array(number()),
})

// Arktype schema
export const benchInputSchemaArktype = type({
  text: 'string',
  iterations: 'number',
  numbers: 'number[]',
})

// TypeBox schema
export const benchInputSchemaTypeBox = Type.Object({
  text: Type.String(),
  iterations: Type.Integer({ minimum: 0 }),
  numbers: Type.Array(Type.Number()),
})

export type BenchInputTypeBox = Static<typeof benchInputSchemaTypeBox>

export type BenchOutput = {
  length: number
  checksum: number
  sum: number
}

export function createBenchInput(opts: { textSize: number; iterations: number; numbersCount: number }): BenchInput {
  const text = 'x'.repeat(opts.textSize)
  const numbers = Array.from({ length: opts.numbersCount }, (_, i) => i)
  return { text, iterations: opts.iterations, numbers }
}

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
