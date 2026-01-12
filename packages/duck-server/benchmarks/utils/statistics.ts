/**
 * Statistical analysis utilities for benchmark results.
 *
 * Provides functions for:
 * - Calculating confidence intervals
 * - Detecting outliers
 * - Computing statistical significance
 * - Validating benchmark results
 */

/**
 * Calculate mean (average) of a dataset.
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * Calculate standard deviation.
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const avg = mean(values)
  const squareDiffs = values.map((val) => Math.pow(val - avg, 2))
  const avgSquareDiff = mean(squareDiffs)
  return Math.sqrt(avgSquareDiff)
}

/**
 * Calculate confidence interval (95%).
 *
 * @param values - Dataset
 * @returns [lower, upper] bounds
 */
export function confidenceInterval95(values: number[]): [number, number] {
  if (values.length < 2) {
    const val = values[0] ?? 0
    return [val, val]
  }

  const avg = mean(values)
  const stdDev = standardDeviation(values)
  const margin = (1.96 * stdDev) / Math.sqrt(values.length) // 95% CI

  return [avg - margin, avg + margin]
}

/**
 * Detect outliers using IQR (Interquartile Range) method.
 *
 * @param values - Dataset
 * @returns Array of outlier indices
 */
export function detectOutliers(values: number[]): number[] {
  if (values.length < 4) return []

  const sorted = [...values].sort((a, b) => a - b)
  const q1Index = Math.floor(values.length * 0.25)
  const q3Index = Math.floor(values.length * 0.75)
  const q1 = sorted[q1Index] ?? 0
  const q3 = sorted[q3Index] ?? 0
  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr

  const outliers: number[] = []
  for (let i = 0; i < values.length; i++) {
    if (values[i]! < lowerBound || values[i]! > upperBound) {
      outliers.push(i)
    }
  }

  return outliers
}

/**
 * Calculate coefficient of variation (CV).
 * Measures relative variability.
 *
 * @param values - Dataset
 * @returns CV as percentage (0-100)
 */
export function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0
  const avg = mean(values)
  if (avg === 0) return 0
  const stdDev = standardDeviation(values)
  return (stdDev / avg) * 100
}

/**
 * Validate benchmark results for consistency.
 *
 * @param values - Multiple runs of the same benchmark
 * @param maxCV - Maximum acceptable coefficient of variation (default: 10%)
 * @returns Validation result
 */
export function validateBenchmarkResults(
  values: number[],
  maxCV: number = 10,
): { valid: boolean; cv: number; outliers: number[]; ci: [number, number] } {
  const cv = coefficientOfVariation(values)
  const outliers = detectOutliers(values)
  const ci = confidenceInterval95(values)

  return {
    valid: cv <= maxCV && outliers.length === 0,
    cv,
    outliers,
    ci,
  }
}

/**
 * Calculate percentage difference between two values.
 */
export function percentageDifference(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : Infinity
  return ((a - b) / b) * 100
}

/**
 * Calculate speedup ratio.
 */
export function speedupRatio(baseline: number, optimized: number): number {
  if (baseline === 0) return 0
  return optimized / baseline
}

/**
 * Determine if difference is statistically significant.
 * Uses t-test approximation for large samples.
 *
 * @param values1 - First dataset
 * @param values2 - Second dataset
 * @param significanceLevel - Alpha level (default: 0.05)
 * @returns Whether difference is significant
 */
export function isStatisticallySignificant(
  values1: number[],
  values2: number[],
  significanceLevel: number = 0.05,
): boolean {
  if (values1.length < 2 || values2.length < 2) return false

  const mean1 = mean(values1)
  const mean2 = mean(values2)
  const std1 = standardDeviation(values1)
  const std2 = standardDeviation(values2)

  // Pooled standard error
  const se = Math.sqrt((std1 * std1) / values1.length + (std2 * std2) / values2.length)

  if (se === 0) return mean1 !== mean2

  // t-statistic
  const t = Math.abs(mean1 - mean2) / se

  // Approximate critical value for large samples (z-test)
  // For small samples, would need t-distribution
  const criticalValue = 1.96 // 95% confidence

  return t > criticalValue
}

/**
 * Calculate percentiles.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))] ?? 0
}
