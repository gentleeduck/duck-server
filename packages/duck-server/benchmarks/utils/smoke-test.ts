/**
 * Smoke test utilities for benchmark harness.
 *
 * Validates that requests work correctly before running load tests.
 * This catches endpoint/body/decoder mismatches early.
 */

import type { Framework } from '../run'
import type { BenchmarkScenario } from '../scenarios/scenario-builder'
import { buildDuckRequest, buildTRPCRequest } from './request-builders'
import { validateDuckResponse, validateTRPCResponse } from './response-validator'

export type SmokeTestResult = {
  passed: boolean
  error?: {
    signature: string
    stage: string
    httpStatus?: number
    preview: string
  }
}

/**
 * Run a smoke test for a framework and scenario.
 *
 * Makes a single request and validates the response.
 * Returns failure details if the request doesn't work correctly.
 */
export async function smokeTest(
  framework: Framework,
  scenario: BenchmarkScenario,
  baseUrl: string,
): Promise<SmokeTestResult> {
  try {
    // Build request based on framework
    let requestConfig
    if (framework.name === 'duck') {
      requestConfig = buildDuckRequest(baseUrl, scenario, scenario.format ?? 'json')
    } else {
      // tRPC doesn't support CBOR
      requestConfig = buildTRPCRequest(baseUrl, scenario)
    }

    // Make the request
    const res = await fetch(requestConfig.url, {
      method: requestConfig.method,
      headers: requestConfig.headers,
      body: requestConfig.body,
    })

    // Validate response based on framework
    let validationResult
    if (framework.name === 'duck') {
      validationResult = await validateDuckResponse(res, scenario.format ?? 'json')
    } else {
      validationResult = await validateTRPCResponse(res)
    }

    if (!validationResult.success) {
      return {
        passed: false,
        error: {
          signature: validationResult.errorSignature ?? 'unknown',
          stage: validationResult.stage ?? 'unknown',
          httpStatus: validationResult.httpStatus,
          preview: validationResult.errorPreview ?? 'No preview available',
        },
      }
    }

    return { passed: true }
  } catch (error) {
    // Network/fetch errors
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      passed: false,
      error: {
        signature: `stage=fetch; status=0; ct=unknown; msg=${errorMessage.slice(0, 100)}`,
        stage: 'fetch',
        preview: errorMessage,
      },
    }
  }
}
