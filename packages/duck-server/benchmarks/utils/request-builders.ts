/**
 * Request building utilities for benchmark harness.
 *
 * Centralizes request construction for both Duck RPC and tRPC to ensure
 * correct format and consistency.
 */

import { encode as cborEncode } from 'cbor-x'
import { CBOR_CONTENT_TYPE } from '../../src/server/serialization/codec'
import type { BenchmarkScenario } from '../scenarios/scenario-builder'

export type RequestConfig = {
  url: string
  method: 'GET' | 'POST'
  headers: Record<string, string>
  body: string | Buffer
}

/**
 * Build a Duck RPC request configuration.
 *
 * Format:
 * - URL: /rpc/{procedurePath}
 * - Body: { type: 'query' | 'mutation', input: payload }
 * - Headers: content-type and accept based on format
 */
export function buildDuckRequest(
  baseUrl: string,
  scenario: BenchmarkScenario,
  format: 'json' | 'cbor' = 'json',
): RequestConfig {
  const url = `${baseUrl}/rpc/${scenario.path}`
  const envelope = { type: 'query', input: scenario.payload }

  if (format === 'cbor') {
    return {
      url,
      method: 'POST',
      headers: {
        'content-type': CBOR_CONTENT_TYPE,
        accept: CBOR_CONTENT_TYPE,
      },
      body: cborEncode(envelope) as Buffer,
    }
  }

  return {
    url,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(envelope),
  }
}

/**
 * Build a tRPC request configuration.
 *
 * Format for tRPC standalone adapter:
 * - URL: /trpc/{procedurePath}?input={encodedInput} (GET) or POST with body
 * - For POST: body is the input directly (not wrapped in batch format)
 * - Headers: content-type: application/json, accept: application/json
 *
 * Note: tRPC standalone adapter accepts input directly in the body for POST requests.
 * The batch format is used by HTTP link adapter, not standalone adapter.
 */
export function buildTRPCRequest(baseUrl: string, scenario: BenchmarkScenario): RequestConfig {
  const url = `${baseUrl}/trpc/${scenario.path}`

  // tRPC standalone adapter expects input directly in the body for POST
  // For queries, we can use GET with input as query param, but POST is more consistent
  const body = JSON.stringify(scenario.payload)

  return {
    url,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body,
  }
}
