/**
 * Tests for statistical analysis utilities.
 */

import { describe, expect, it } from 'vitest'
import {
  coefficientOfVariation,
  confidenceInterval95,
  detectOutliers,
  isStatisticallySignificant,
  mean,
  percentageDifference,
  percentile,
  speedupRatio,
  standardDeviation,
  validateBenchmarkResults,
} from '../statistics'

describe('mean', () => {
  it('should calculate mean of numbers', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3)
    expect(mean([10, 20, 30])).toBe(20)
    expect(mean([5])).toBe(5)
  })

  it('should handle empty array', () => {
    expect(mean([])).toBe(0)
  })

  it('should handle negative numbers', () => {
    expect(mean([-1, 0, 1])).toBe(0)
  })

  it('should handle decimal numbers', () => {
    expect(mean([1.5, 2.5, 3.5])).toBeCloseTo(2.5)
  })
})

describe('standardDeviation', () => {
  it('should calculate standard deviation', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9]
    const stdDev = standardDeviation(values)
    expect(stdDev).toBeCloseTo(2, 1)
  })

  it('should return 0 for empty array', () => {
    expect(standardDeviation([])).toBe(0)
  })

  it('should return 0 for single value', () => {
    expect(standardDeviation([5])).toBe(0)
  })

  it('should return 0 for identical values', () => {
    expect(standardDeviation([5, 5, 5, 5])).toBe(0)
  })
})

describe('confidenceInterval95', () => {
  it('should calculate confidence interval', () => {
    const values = [10, 12, 14, 16, 18]
    const [lower, upper] = confidenceInterval95(values)
    expect(lower).toBeLessThan(14)
    expect(upper).toBeGreaterThan(14)
    expect(lower).toBeLessThan(upper)
  })

  it('should handle single value', () => {
    const [lower, upper] = confidenceInterval95([5])
    expect(lower).toBe(5)
    expect(upper).toBe(5)
  })

  it('should handle empty array', () => {
    const [lower, upper] = confidenceInterval95([])
    expect(lower).toBe(0)
    expect(upper).toBe(0)
  })
})

describe('detectOutliers', () => {
  it('should detect outliers using IQR', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100] // 100 is an outlier
    const outliers = detectOutliers(values)
    expect(outliers.length).toBeGreaterThan(0)
    expect(outliers).toContain(9) // Index of 100
  })

  it('should return empty array for small datasets', () => {
    expect(detectOutliers([1, 2, 3])).toEqual([])
  })

  it('should return empty array when no outliers', () => {
    const values = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    const outliers = detectOutliers(values)
    expect(outliers.length).toBe(0)
  })
})

describe('coefficientOfVariation', () => {
  it('should calculate CV as percentage', () => {
    const values = [10, 10, 10, 10, 10] // No variation
    expect(coefficientOfVariation(values)).toBe(0)
  })

  it('should handle zero mean', () => {
    expect(coefficientOfVariation([0, 0, 0])).toBe(0)
  })

  it('should return higher CV for more variable data', () => {
    const lowVar = [10, 11, 12, 13, 14]
    const highVar = [1, 5, 10, 15, 19]
    const cvLow = coefficientOfVariation(lowVar)
    const cvHigh = coefficientOfVariation(highVar)
    expect(cvHigh).toBeGreaterThan(cvLow)
  })
})

describe('validateBenchmarkResults', () => {
  it('should validate consistent results', () => {
    const values = [100, 101, 99, 100, 101]
    const result = validateBenchmarkResults(values, 10)
    expect(result.valid).toBe(true)
    expect(result.cv).toBeLessThan(10)
    expect(result.outliers.length).toBe(0)
  })

  it('should flag high variation', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    const result = validateBenchmarkResults(values, 5)
    expect(result.valid).toBe(false)
    expect(result.cv).toBeGreaterThan(5)
  })

  it('should detect outliers', () => {
    const values = [100, 101, 99, 100, 101, 1000] // 1000 is outlier
    const result = validateBenchmarkResults(values, 20)
    expect(result.outliers.length).toBeGreaterThan(0)
  })
})

describe('percentageDifference', () => {
  it('should calculate percentage difference', () => {
    expect(percentageDifference(110, 100)).toBe(10)
    expect(percentageDifference(90, 100)).toBe(-10)
    expect(percentageDifference(200, 100)).toBe(100)
  })

  it('should handle zero baseline', () => {
    expect(percentageDifference(10, 0)).toBe(Infinity)
    expect(percentageDifference(0, 0)).toBe(0)
  })
})

describe('speedupRatio', () => {
  it('should calculate speedup ratio', () => {
    expect(speedupRatio(100, 200)).toBe(2) // 2x faster
    expect(speedupRatio(200, 100)).toBe(0.5) // 2x slower
    expect(speedupRatio(100, 100)).toBe(1) // Same
  })

  it('should handle zero baseline', () => {
    expect(speedupRatio(0, 100)).toBe(0)
  })
})

describe('isStatisticallySignificant', () => {
  it('should detect significant differences', () => {
    const values1 = [100, 101, 99, 100, 101]
    const values2 = [200, 201, 199, 200, 201]
    const significant = isStatisticallySignificant(values1, values2)
    expect(significant).toBe(true)
  })

  it('should detect non-significant differences', () => {
    const values1 = [100, 101, 99, 100, 101]
    const values2 = [100, 101, 99, 100, 101]
    const significant = isStatisticallySignificant(values1, values2)
    expect(significant).toBe(false)
  })

  it('should return false for small samples', () => {
    expect(isStatisticallySignificant([1], [2])).toBe(false)
  })
})

describe('percentile', () => {
  it('should calculate percentiles', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentile(values, 50)).toBe(5) // Median
    expect(percentile(values, 90)).toBe(9)
    expect(percentile(values, 99)).toBe(10)
  })

  it('should handle empty array', () => {
    expect(percentile([], 50)).toBe(0)
  })

  it('should handle edge percentiles', () => {
    const values = [1, 2, 3, 4, 5]
    expect(percentile(values, 0)).toBe(1)
    expect(percentile(values, 100)).toBe(5)
  })
})
