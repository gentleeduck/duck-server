/**
 * Tests for benchmark validation utilities.
 */

import { describe, expect, it } from 'vitest'
import { type BenchmarkValidationResult, validateBenchmarkRun, validateComparison } from '../benchmark-validator'

describe('validateBenchmarkRun', () => {
  it('should validate good benchmark results', () => {
    const values = [100, 101, 99, 100, 101]
    const result = validateBenchmarkRun(values, 'reqsPerSec', [0, 1_000_000])

    expect(result.valid).toBe(true)
    expect(result.errors.length).toBe(0)
    expect(result.statistics.mean).toBeGreaterThan(0)
  })

  it('should detect empty data', () => {
    const result = validateBenchmarkRun([], 'reqsPerSec', null)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('No data points'))).toBe(true)
  })

  it('should warn about few data points', () => {
    const result = validateBenchmarkRun([100, 101], 'reqsPerSec', null)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings.some((w) => w.includes('data points'))).toBe(true)
  })

  it('should detect all zeros', () => {
    const result = validateBenchmarkRun([0, 0, 0], 'reqsPerSec', null)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('zero'))).toBe(true)
  })

  it('should validate range', () => {
    const result = validateBenchmarkRun([1_000_000], 'reqsPerSec', [0, 100_000])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('range'))).toBe(true)
  })

  it('should detect negative values for throughput', () => {
    const result = validateBenchmarkRun([-10, 100, 200], 'reqsPerSec', null)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Negative'))).toBe(true)
  })

  it('should warn about high variation', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    const result = validateBenchmarkRun(values, 'reqsPerSec', null)
    expect(result.warnings.some((w) => w.includes('variation'))).toBe(true)
  })

  it('should detect outliers', () => {
    const values = [100, 101, 99, 100, 101, 1000]
    const result = validateBenchmarkRun(values, 'reqsPerSec', null)
    expect(result.warnings.some((w) => w.includes('outlier'))).toBe(true)
  })
})

describe('validateComparison', () => {
  it('should validate good comparison', () => {
    const baseline = [100, 101, 99, 100, 101]
    const optimized = [200, 201, 199, 200, 201]
    const result = validateComparison(baseline, optimized, 'reqsPerSec')

    expect(result.valid).toBe(true)
    expect(result.improvement).toBeGreaterThan(0)
  })

  it('should detect invalid baseline', () => {
    const baseline = [0, 0, 0]
    const optimized = [100, 101, 99]
    const result = validateComparison(baseline, optimized, 'reqsPerSec')

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('zero'))).toBe(true)
  })

  it('should calculate improvement percentage', () => {
    const baseline = [100, 100, 100]
    const optimized = [150, 150, 150]
    const result = validateComparison(baseline, optimized, 'reqsPerSec')

    expect(result.improvement).toBeCloseTo(50, 1)
  })

  it('should detect negative improvement', () => {
    const baseline = [200, 200, 200]
    const optimized = [100, 100, 100]
    const result = validateComparison(baseline, optimized, 'reqsPerSec')

    expect(result.improvement).toBeLessThan(0)
  })

  it('should warn about non-significant differences', () => {
    const baseline = [100, 101, 99, 100, 101]
    const optimized = [100, 101, 99, 100, 101]
    const result = validateComparison(baseline, optimized, 'reqsPerSec')

    if (Math.abs(result.improvement) > 1) {
      expect(result.warnings.some((w) => w.includes('significant'))).toBe(true)
    }
  })
})
