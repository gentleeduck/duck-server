/**
 * Benchmark result validation.
 *
 * Ensures benchmarks produce real, accurate numbers by:
 * - Validating statistical consistency
 * - Detecting anomalies
 * - Verifying reasonable ranges
 * - Checking for measurement errors
 */

import {
  coefficientOfVariation,
  confidenceInterval95,
  detectOutliers,
  isStatisticallySignificant,
  validateBenchmarkResults,
} from './statistics'

export type BenchmarkValidationResult = {
  valid: boolean
  warnings: string[]
  errors: string[]
  statistics: {
    mean: number
    stdDev: number
    cv: number
    ci: [number, number]
    outliers: number[]
  }
}

/**
 * Validate a single benchmark run.
 *
 * @param values - Multiple measurements from the same benchmark
 * @param metricName - Name of the metric being validated
 * @param expectedRange - Expected range [min, max] or null if unknown
 * @returns Validation result
 */
export function validateBenchmarkRun(
  values: number[],
  metricName: string,
  expectedRange: [number, number] | null = null,
): BenchmarkValidationResult {
  const warnings: string[] = []
  const errors: string[] = []

  // Basic checks
  if (values.length === 0) {
    errors.push(`${metricName}: No data points collected`)
    return {
      valid: false,
      warnings,
      errors,
      statistics: {
        mean: 0,
        stdDev: 0,
        cv: 0,
        ci: [0, 0],
        outliers: [],
      },
    }
  }

  if (values.length < 3) {
    warnings.push(`${metricName}: Only ${values.length} data points (recommend at least 3)`)
  }

  // Check for all zeros or all same value (suspicious)
  const uniqueValues = new Set(values)
  if (uniqueValues.size === 1 && values[0] === 0) {
    errors.push(`${metricName}: All values are zero (likely measurement error)`)
  }

  // Statistical validation
  const validation = validateBenchmarkResults(values, 15) // 15% max CV
  const cv = coefficientOfVariation(values)
  const ci = confidenceInterval95(values)
  const outliers = detectOutliers(values)

  if (cv > 15) {
    warnings.push(`${metricName}: High coefficient of variation (${cv.toFixed(2)}%), results may be unreliable`)
  }

  if (outliers.length > 0) {
    warnings.push(`${metricName}: ${outliers.length} outlier(s) detected at indices: ${outliers.join(', ')}`)
  }

  // Range validation
  if (expectedRange) {
    const [min, max] = expectedRange
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    if (mean < min || mean > max) {
      errors.push(`${metricName}: Mean value ${mean.toFixed(2)} outside expected range [${min}, ${max}]`)
    }
  }

  // Check for negative values where inappropriate
  if (metricName.includes('reqsPerSec') || metricName.includes('throughput')) {
    const hasNegative = values.some((v) => v < 0)
    if (hasNegative) {
      errors.push(`${metricName}: Negative values detected (invalid for this metric)`)
    }
  }

  // Check for unreasonably large values (potential overflow/error)
  const maxReasonable = getMaxReasonableValue(metricName)
  if (maxReasonable) {
    const hasUnreasonable = values.some((v) => v > maxReasonable)
    if (hasUnreasonable) {
      warnings.push(
        `${metricName}: Some values exceed reasonable maximum (${maxReasonable}), may indicate measurement error`,
      )
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    statistics: {
      mean: validation.ci[0] + (validation.ci[1] - validation.ci[0]) / 2,
      stdDev: 0, // Would need to calculate separately
      cv,
      ci,
      outliers,
    },
  }
}

/**
 * Get maximum reasonable value for a metric.
 */
function getMaxReasonableValue(metricName: string): number | null {
  // These are conservative upper bounds to catch obvious errors
  const bounds: Record<string, number> = {
    reqsPerSec: 1_000_000, // 1M req/s is very high
    latencyP50Ms: 10_000, // 10s is very high
    latencyP99Ms: 60_000, // 60s is very high
    cpuUserMs: 1_000_000, // 1000s CPU time
    rssDeltaMb: 10_000, // 10GB memory delta
  }

  for (const [key, value] of Object.entries(bounds)) {
    if (metricName.includes(key)) {
      return value
    }
  }

  return null
}

/**
 * Compare two benchmark results and validate the comparison.
 */
export function validateComparison(
  baseline: number[],
  optimized: number[],
  metricName: string,
): {
  valid: boolean
  warnings: string[]
  errors: string[]
  improvement: number
  significant: boolean
} {
  const warnings: string[] = []
  const errors: string[] = []

  // Validate both datasets
  const baselineValidation = validateBenchmarkRun(baseline, `${metricName} (baseline)`)
  const optimizedValidation = validateBenchmarkRun(optimized, `${metricName} (optimized)`)

  warnings.push(...baselineValidation.warnings)
  warnings.push(...optimizedValidation.warnings)
  errors.push(...baselineValidation.errors)
  errors.push(...optimizedValidation.errors)

  if (baselineValidation.statistics.mean === 0) {
    errors.push(`${metricName}: Baseline mean is zero, cannot calculate improvement`)
  }

  // Calculate improvement
  const improvement =
    baselineValidation.statistics.mean > 0
      ? ((optimizedValidation.statistics.mean - baselineValidation.statistics.mean) /
          baselineValidation.statistics.mean) *
        100
      : 0

  // Check statistical significance
  const significant = isStatisticallySignificant(baseline, optimized)

  if (!significant && Math.abs(improvement) > 1) {
    warnings.push(`${metricName}: Improvement of ${improvement.toFixed(2)}% is not statistically significant`)
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    improvement,
    significant,
  }
}
