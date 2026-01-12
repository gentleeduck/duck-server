import { Decoder, Encoder } from 'cbor-x'

export const CBOR_CONTENT_TYPE = 'application/cbor'

export type ResponseFormat = 'json' | 'cbor'

// Shared CBOR encoder instance.
// Reusing the encoder lets cbor-x learn and reuse object shapes (useRecords),
// improving throughput for repeated response shapes (e.g. { ok, data, code }).
const cborEncoder = new Encoder({
  useRecords: true,
  mapsAsObjects: true,
})

// Shared CBOR decoder instance.
// Using a shared Decoder allows cbor-x to reuse shape information on decode
// as well, which can speed up repeated decoding of similar payloads.
const cborDecoder = new Decoder({
  useRecords: true,
  mapsAsObjects: true,
})

/** Minimal body reader interface for decoding request bodies. */
export type BodyReader = {
  /** Read and parse a JSON body. */
  json: () => Promise<unknown>
  /** Read raw body bytes for CBOR decoding. */
  arrayBuffer: () => Promise<ArrayBuffer>
}

/** Decode JSON or CBOR request bodies using a content-type hint. */
export async function decodeRequestBody(
  contentType: string | null | undefined,
  reader: BodyReader,
): Promise<{ body: unknown; format: ResponseFormat }> {
  if (isCborContentType(contentType)) {
    const buf = await reader.arrayBuffer()
    // Each request still has its own buffer; only the decoder instance is reused.
    return { body: cborDecoder.decode(new Uint8Array(buf)), format: 'cbor' }
  }

  const body = await reader.json().catch(() => null)
  return { body, format: 'json' }
}

export function resolveResponseFormat(req: Request): ResponseFormat {
  const accept = req.headers.get('accept')?.toLowerCase()
  if (accept?.includes(CBOR_CONTENT_TYPE)) return 'cbor'
  if (isCborContentType(req.headers.get('content-type'))) return 'cbor'
  return 'json'
}

export function serializeResponse(
  body: unknown,
  status: number,
  headers: Record<string, string>,
  format: ResponseFormat,
): Response {
  if (format === 'cbor') {
    // Each response still gets its own encoded bytes; we only reuse the encoder,
    // never the output buffer, to avoid corrupting in-flight responses.
    const encoded = cborEncoder.encode(body) as Buffer<ArrayBuffer>
    return new Response(encoded, {
      status,
      headers: withContentType(headers, CBOR_CONTENT_TYPE),
    })
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: withContentType(headers, 'application/json'),
  })
}

export function isCborContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false
  return contentType.split(';', 1)[0]?.trim().toLowerCase() === CBOR_CONTENT_TYPE
}

export function withContentType(headers: Record<string, string>, contentType: string): Record<string, string> {
  return { ...headers, 'content-type': contentType }
}
