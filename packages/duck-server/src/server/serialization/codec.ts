import { decode as cborDecode, encode as cborEncode } from 'cbor-x'

export const CBOR_CONTENT_TYPE = 'application/cbor'

export type ResponseFormat = 'json' | 'cbor'

export async function decodeRequestBody(req: Request): Promise<{ body: unknown; format: ResponseFormat }> {
  const contentType = req.headers.get('content-type')
  if (isCborContentType(contentType)) {
    const buf = await req.arrayBuffer()
    return { body: cborDecode(new Uint8Array(buf)), format: 'cbor' }
  }

  const body = await req.json().catch(() => null)
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
    return new Response(cborEncode(body), {
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
