/**
 * Scenario builder for benchmark test cases.
 *
 * Defines different benchmark scenarios including payload sizes,
 * serialization formats, validation libraries, and load patterns.
 */

import type { BenchInput } from './payloads/payload-generators'

/**
 * Serialization format for requests/responses.
 */
export type SerializationFormat = 'json' | 'cbor'

/**
 * Validation library used for input validation.
 */
export type ValidationLibrary = 'zod' | 'valibot' | 'arktype' | 'typebox' | 'none'

/**
 * Load pattern configuration.
 */
export type LoadPattern = {
  name: string
  connections: number[]
  pipelining: number[]
  duration: number
}

/**
 * Benchmark scenario definition.
 */
export type BenchmarkScenario = {
  name: string
  path: string
  payload: BenchInput
  format?: SerializationFormat
  validation?: ValidationLibrary
}

/**
 * Build scenarios for different payload sizes and configurations.
 *
 * @param payloads - Pre-generated payloads
 * @returns Array of benchmark scenarios
 */
export function buildScenarios(payloads: {
  tiny: BenchInput
  small: BenchInput
  medium: BenchInput
  large: BenchInput
  xlarge: BenchInput
  xxlarge: BenchInput
}): BenchmarkScenario[] {
  const scenarios: BenchmarkScenario[] = [
    // Tiny payloads
    { name: 'tiny-json-zod', path: 'heavy', payload: payloads.tiny, format: 'json', validation: 'zod' },
    {
      name: 'tiny-json-novalidate',
      path: 'heavyNoValidate',
      payload: payloads.tiny,
      format: 'json',
      validation: 'none',
    },
    { name: 'tiny-cbor-zod', path: 'heavy', payload: payloads.tiny, format: 'cbor', validation: 'zod' },

    // Small payloads
    { name: 'small-json-zod', path: 'heavy', payload: payloads.small, format: 'json', validation: 'zod' },
    {
      name: 'small-json-valibot',
      path: 'heavyValibot',
      payload: payloads.small,
      format: 'json',
      validation: 'valibot',
    },
    {
      name: 'small-json-arktype',
      path: 'heavyArktype',
      payload: payloads.small,
      format: 'json',
      validation: 'arktype',
    },
    {
      name: 'small-json-novalidate',
      path: 'heavyNoValidate',
      payload: payloads.small,
      format: 'json',
      validation: 'none',
    },
    { name: 'small-cbor-zod', path: 'heavy', payload: payloads.small, format: 'cbor', validation: 'zod' },

    // Medium payloads
    { name: 'medium-json-zod', path: 'heavy', payload: payloads.medium, format: 'json', validation: 'zod' },
    {
      name: 'medium-json-novalidate',
      path: 'heavyNoValidate',
      payload: payloads.medium,
      format: 'json',
      validation: 'none',
    },
    { name: 'medium-cbor-zod', path: 'heavy', payload: payloads.medium, format: 'cbor', validation: 'zod' },

    // Large payloads
    { name: 'large-json-zod', path: 'heavy', payload: payloads.large, format: 'json', validation: 'zod' },
    {
      name: 'large-json-novalidate',
      path: 'heavyNoValidate',
      payload: payloads.large,
      format: 'json',
      validation: 'none',
    },
    { name: 'large-cbor-zod', path: 'heavy', payload: payloads.large, format: 'cbor', validation: 'zod' },

    // Extra large payloads
    { name: 'xlarge-json-zod', path: 'heavy', payload: payloads.xlarge, format: 'json', validation: 'zod' },
    {
      name: 'xlarge-json-novalidate',
      path: 'heavyNoValidate',
      payload: payloads.xlarge,
      format: 'json',
      validation: 'none',
    },
    { name: 'xlarge-cbor-zod', path: 'heavy', payload: payloads.xlarge, format: 'cbor', validation: 'zod' },

    // XXL payloads
    { name: 'xxlarge-json-zod', path: 'heavy', payload: payloads.xxlarge, format: 'json', validation: 'zod' },
    {
      name: 'xxlarge-json-novalidate',
      path: 'heavyNoValidate',
      payload: payloads.xxlarge,
      format: 'json',
      validation: 'none',
    },
    { name: 'xxlarge-cbor-zod', path: 'heavy', payload: payloads.xxlarge, format: 'cbor', validation: 'zod' },
  ]

  return scenarios
}

/**
 * Pre-defined load patterns for benchmarking.
 */
export const LOAD_PATTERNS: Record<string, LoadPattern> = {
  sustained: {
    name: 'sustained',
    connections: [64],
    pipelining: [1],
    duration: 20,
  },
  burst: {
    name: 'burst',
    connections: [64],
    pipelining: [1],
    duration: 5,
  },
  rampup: {
    name: 'rampup',
    connections: [16, 32, 64, 128],
    pipelining: [1],
    duration: 10,
  },
  mixed: {
    name: 'mixed',
    connections: [16, 64],
    pipelining: [1, 4],
    duration: 15,
  },
  connections: {
    name: 'connections',
    connections: [16, 32, 64, 128, 256],
    pipelining: [1],
    duration: 20,
  },
  pipelining: {
    name: 'pipelining',
    connections: [64],
    pipelining: [1, 4, 8, 16],
    duration: 20,
  },
}
