import { decode as cborDecode, encode as cborEncode } from 'cbor-x'
import type { RPCResType } from '../server/core/response'

/**
 * Low-level RPC client that handles transport and serialization.
 * Returns RPCResType for all calls and never throws on RPC errors.
 */

/** Supported wire formats for requests and responses. */
export type ClientFormat = 'json' | 'cbor'
/** Procedure dispatch type. */
export type ProcedureType = 'query' | 'mutation'

/** Construction options for the RPC client. */
export type ClientOptions = {
  /** Base URL of the server, ex: http://localhost:3000. */
  baseUrl: string
  /** RPC endpoint path, default: "/rpc". */
  endpoint?: string
  /** Request/response format, default: "json". */
  format?: ClientFormat
  /** Headers applied to every request. */
  headers?: Record<string, string>
  /** Custom fetch implementation (useful for tests). */
  fetch?: typeof fetch
}

/** Per-request options. */
export type CallOptions = {
  /** Extra headers for a single call. */
  headers?: Record<string, string>
  /** Abort signal passed to fetch. */
  signal?: AbortSignal
}

/**
 * Create a low-level RPC client that calls by dotted path.
 * Use this if you want string-based routing (ex: "upload.deleteBucket").
 */
export function createRPCClient(opts: ClientOptions) {
  const fetcher = opts.fetch ?? fetch
  const format = opts.format ?? 'json'
  const endpoint = opts.endpoint ?? '/rpc'
  const baseHeaders = opts.headers ?? {}

  /**
   * Perform a raw RPC call using the resolved path.
   * The `path` is a dotted procedure path, not a URL.
   */
  const call = async <TData>(
    path: string,
    type: ProcedureType,
    input?: unknown,
    options: CallOptions = {},
  ): Promise<RPCResType<TData>> => {
    const url = joinUrl(opts.baseUrl, endpoint, path)
    const payload = { type, input }
    const headers = {
      ...baseHeaders,
      ...options.headers,
      ...(format === 'cbor'
        ? { 'content-type': 'application/cbor', accept: 'application/cbor' }
        : { 'content-type': 'application/json', accept: 'application/json' }),
    }
    const body = format === 'cbor' ? (cborEncode(payload) as Uint8Array) : JSON.stringify(payload)

    const res = await fetcher(url, {
      method: 'POST',
      headers,
      body: body as BodyInit,
      signal: options.signal ?? null,
    })

    return (await decodeResponse(res)) as RPCResType<TData>
  }

  return {
    call,
    /** Convenience wrapper for query procedures. */
    query: <TData>(path: string, input?: unknown, options?: CallOptions) => call<TData>(path, 'query', input, options),
    /** Convenience wrapper for mutation procedures. */
    mutation: <TData>(path: string, input?: unknown, options?: CallOptions) =>
      call<TData>(path, 'mutation', input, options),
  }
}

/**
 * Decode a response body based on content-type.
 * Falls back to text when the content-type is unknown.
 */
async function decodeResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.includes('application/cbor')) {
    const buf = await res.arrayBuffer()
    return cborDecode(new Uint8Array(buf))
  }
  if (contentType.includes('application/json')) {
    return res.json()
  }
  return res.text()
}

/** Join base URL, endpoint, and dotted path into a request URL. */
function joinUrl(baseUrl: string, endpoint: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const p = path.replace(/^\/+/, '')
  return `${base}${ep}/${p}`
}
