/**
 * Optimization-specific benchmark scenarios.
 *
 * These scenarios test the performance improvements from:
 * - Pre-composed middleware chains
 * - Reused CBOR encoder/decoder instances
 * - WeakMap-based request metadata
 */

import { generateStandardPayloads } from './payloads/payload-generators'
import type { BenchmarkScenario } from './scenario-builder'

/**
 * Scenarios specifically designed to test middleware composition optimization.
 *
 * Tests procedures with varying numbers of middlewares to measure
 * the impact of pre-composed middleware chains.
 */
export function buildMiddlewareOptimizationScenarios(): BenchmarkScenario[] {
  const payloads = generateStandardPayloads()

  return [
    {
      name: 'middleware-0-small',
      path: 'heavyNoValidate',
      payload: payloads.small,
      format: 'json',
      validation: 'none',
    },
    {
      name: 'middleware-1-small',
      path: 'heavyWithMiddleware1',
      payload: payloads.small,
      format: 'json',
      validation: 'zod',
    },
    {
      name: 'middleware-3-small',
      path: 'heavyWithMiddleware3',
      payload: payloads.small,
      format: 'json',
      validation: 'zod',
    },
    {
      name: 'middleware-5-small',
      path: 'heavyWithMiddleware5',
      payload: payloads.small,
      format: 'json',
      validation: 'zod',
    },
  ]
}

/**
 * Scenarios to test CBOR encoder/decoder reuse optimization.
 *
 * Compares performance with and without encoder reuse to measure
 * the impact of shape learning (useRecords).
 */
export function buildCBOROptimizationScenarios(): BenchmarkScenario[] {
  const payloads = generateStandardPayloads()

  return [
    {
      name: 'cbor-small-repeated',
      path: 'heavy',
      payload: payloads.small,
      format: 'cbor',
      validation: 'zod',
    },
    {
      name: 'cbor-medium-repeated',
      path: 'heavy',
      payload: payloads.medium,
      format: 'cbor',
      validation: 'zod',
    },
    {
      name: 'cbor-large-repeated',
      path: 'heavy',
      payload: payloads.large,
      format: 'cbor',
      validation: 'zod',
    },
  ]
}

/**
 * Scenarios to test WeakMap metadata optimization.
 *
 * Tests request handling with metadata tracking to ensure
 * WeakMap doesn't cause memory leaks or performance degradation.
 */
export function buildMetadataOptimizationScenarios(): BenchmarkScenario[] {
  const payloads = generateStandardPayloads()

  return [
    {
      name: 'metadata-small',
      path: 'heavyWithMetadata',
      payload: payloads.small,
      format: 'json',
      validation: 'zod',
    },
    {
      name: 'metadata-large',
      path: 'heavyWithMetadata',
      payload: payloads.large,
      format: 'json',
      validation: 'zod',
    },
  ]
}

/**
 * Combined optimization scenarios for comprehensive testing.
 */
export function buildAllOptimizationScenarios(): BenchmarkScenario[] {
  return [
    ...buildMiddlewareOptimizationScenarios(),
    ...buildCBOROptimizationScenarios(),
    ...buildMetadataOptimizationScenarios(),
  ]
}
