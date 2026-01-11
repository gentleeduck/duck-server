import { decode as cborDecode, encode as cborEncode } from 'cbor-x'

export const CBOR_CONTENT_TYPE = 'application/cbor'

export type ResponseFormat = 'json' | 'cbor'

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
    return { body: cborDecode(new Uint8Array(buf)), format: 'cbor' }
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
    return new Response(cborEncode(body) as Buffer<ArrayBuffer>, {
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
