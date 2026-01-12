/**
 * Response validation utilities for benchmark harness.
 *
 * Validates responses from both Duck RPC and tRPC to ensure fair comparisons.
 */

import { decode as cborDecode } from 'cbor-x'
import { CBOR_CONTENT_TYPE } from '../../src/server/serialization/codec'

export type ValidationResult = {
  success: boolean
  errorSignature?: string
  stage?: 'fetch' | 'http' | 'decode' | 'shape'
  httpStatus?: number
  contentType?: string
  errorPreview?: string // First 200 bytes
  decodedBody?: unknown
  responseSizeBytes?: number
}

/**
 * Validate a Duck RPC response.
 *
 * Success criteria:
 * 1. HTTP status is 2xx
 * 2. Response can be decoded (JSON/CBOR) without throwing
 * 3. Decoded body matches expected shape: { ok: boolean, data?: any, code?: string }
 */
export async function validateDuckResponse(res: Response, format: 'json' | 'cbor'): Promise<ValidationResult> {
  const contentType = res.headers.get('content-type')?.toLowerCase() ?? ''
  const httpStatus = res.status

  // Stage 1: HTTP status check
  if (httpStatus < 200 || httpStatus >= 300) {
    const preview = await getErrorPreview(res)
    return {
      success: false,
      stage: 'http',
      httpStatus,
      contentType,
      errorPreview: preview,
      errorSignature: buildErrorSignature('http', httpStatus, contentType, `HTTP ${httpStatus}`),
    }
  }

  // Stage 2: Decode response
  let decodedBody: unknown
  let responseSizeBytes: number | undefined

  try {
    if (format === 'cbor' || contentType.includes('application/cbor')) {
      const buf = await res.arrayBuffer()
      responseSizeBytes = buf.byteLength
      decodedBody = cborDecode(new Uint8Array(buf))
    } else {
      const text = await res.text()
      responseSizeBytes = new TextEncoder().encode(text).length
      decodedBody = JSON.parse(text)
    }
  } catch (error) {
    const preview = await getErrorPreview(res)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      stage: 'decode',
      httpStatus,
      contentType,
      errorPreview: preview,
      errorSignature: buildErrorSignature('decode', httpStatus, contentType, errorMessage),
    }
  }

  // Stage 3: Shape validation
  if (!isDuckResponseShape(decodedBody)) {
    const preview = JSON.stringify(decodedBody).slice(0, 200)
    return {
      success: false,
      stage: 'shape',
      httpStatus,
      contentType,
      errorPreview: preview,
      decodedBody,
      errorSignature: buildErrorSignature('shape', httpStatus, contentType, 'Response does not match Duck RPC shape'),
    }
  }

  // Check if ok is true (successful response)
  if (typeof decodedBody === 'object' && decodedBody !== null && 'ok' in decodedBody) {
    const duckRes = decodedBody as { ok: boolean }
    if (!duckRes.ok) {
      // This is a valid Duck response shape but indicates an error
      const preview = JSON.stringify(decodedBody).slice(0, 200)
      return {
        success: false,
        stage: 'shape',
        httpStatus,
        contentType,
        errorPreview: preview,
        decodedBody,
        errorSignature: buildErrorSignature('shape', httpStatus, contentType, 'Response has ok=false (RPC error)'),
      }
    }
  }

  return {
    success: true,
    httpStatus,
    contentType,
    decodedBody,
    responseSizeBytes,
  }
}

/**
 * Validate a tRPC response.
 *
 * Success criteria:
 * 1. HTTP status is 2xx
 * 2. Response can be decoded as JSON without throwing
 * 3. Decoded body matches tRPC response shape: { result: { data: any } } or { error: {...} }
 */
export async function validateTRPCResponse(res: Response): Promise<ValidationResult> {
  const contentType = res.headers.get('content-type')?.toLowerCase() ?? ''
  const httpStatus = res.status

  // Stage 1: HTTP status check
  if (httpStatus < 200 || httpStatus >= 300) {
    const preview = await getErrorPreview(res)
    return {
      success: false,
      stage: 'http',
      httpStatus,
      contentType,
      errorPreview: preview,
      errorSignature: buildErrorSignature('http', httpStatus, contentType, `HTTP ${httpStatus}`),
    }
  }

  // Stage 2: Decode response
  let decodedBody: unknown
  let responseSizeBytes: number | undefined

  try {
    const text = await res.text()
    responseSizeBytes = new TextEncoder().encode(text).length
    decodedBody = JSON.parse(text)
  } catch (error) {
    const preview = await getErrorPreview(res)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      stage: 'decode',
      httpStatus,
      contentType,
      errorPreview: preview,
      errorSignature: buildErrorSignature('decode', httpStatus, contentType, errorMessage),
    }
  }

  // Stage 3: Shape validation
  if (!isTRPCResponseShape(decodedBody)) {
    const preview = JSON.stringify(decodedBody).slice(0, 200)
    return {
      success: false,
      stage: 'shape',
      httpStatus,
      contentType,
      errorPreview: preview,
      decodedBody,
      errorSignature: buildErrorSignature(
        'shape',
        httpStatus,
        contentType,
        'Response does not match tRPC response shape',
      ),
    }
  }

  // Check if it's an error response
  if (typeof decodedBody === 'object' && decodedBody !== null && 'error' in decodedBody) {
    // tRPC error response - valid shape but indicates failure
    const preview = JSON.stringify(decodedBody).slice(0, 200)
    return {
      success: false,
      stage: 'shape',
      httpStatus,
      contentType,
      errorPreview: preview,
      decodedBody,
      errorSignature: buildErrorSignature('shape', httpStatus, contentType, 'Response has error field (tRPC error)'),
    }
  }

  return {
    success: true,
    httpStatus,
    contentType,
    decodedBody,
    responseSizeBytes,
  }
}

/**
 * Build a normalized error signature for tracking.
 * Format: stage={stage}; status={status}; ct={contentType}; msg={truncated message}
 */
export function buildErrorSignature(stage: string, status: number, contentType: string, message: string): string {
  const truncatedMsg = message.slice(0, 100).replace(/\s+/g, ' ')
  const ct = contentType.split(';')[0]?.trim() ?? 'unknown'
  return `stage=${stage}; status=${status}; ct=${ct}; msg=${truncatedMsg}`
}

/**
 * Check if decoded body matches Duck RPC response shape.
 */
function isDuckResponseShape(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false
  const obj = body as Record<string, unknown>
  return 'ok' in obj && typeof obj.ok === 'boolean'
}

/**
 * Check if decoded body matches tRPC response shape.
 * tRPC responses can be:
 * - { result: { data: any } } for success
 * - { error: {...} } for errors
 * - Batch format: { "0": { result: { data: any } } }
 */
function isTRPCResponseShape(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false
  const obj = body as Record<string, unknown>

  // Check for single result format
  if ('result' in obj || 'error' in obj) return true

  // Check for batch format (numeric keys)
  const keys = Object.keys(obj)
  if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
    // Check if first item has result or error
    const firstKey = keys[0]
    if (firstKey) {
      const firstItem = obj[firstKey]
      if (typeof firstItem === 'object' && firstItem !== null) {
        const item = firstItem as Record<string, unknown>
        return 'result' in item || 'error' in item
      }
    }
  }

  return false
}

/**
 * Get error preview from response (first 200 bytes).
 */
async function getErrorPreview(res: Response): Promise<string> {
  try {
    // Clone response to avoid consuming the body
    const cloned = res.clone()
    const text = await cloned.text()
    const bytes = new TextEncoder().encode(text)
    const preview = new TextDecoder().decode(bytes.slice(0, 200))
    return preview
  } catch {
    return 'Unable to read response body'
  }
}
