import { RPC_CODES } from '../core/codes'
import { createRPCError } from '../core/error'
import { rpcToErr } from '../core/response'
import type { RPCRouter } from '../core/router'
import { getProcedureAtPath } from '../core/router'

/** Context creation input for fetch-based handlers. */
export type CreateContextOpts = { req: Request }

/** Options for handling an RPC request via the Fetch API. */
export type FetchRequestHandlerOptions<TCtx> = {
  router: RPCRouter<any>
  createContext: (opts: CreateContextOpts) => Promise<TCtx> | TCtx
  endpoint?: string // default "/rpc"
  req: Request
  headers?: Record<string, string>
}

/** Default headers applied to RPC responses. */
export const DEFAULT_HEADERS: Record<string, string> = {
  'content-type': 'application/json',
  'x-powered-by': 'duck-server',
}

/** Handle an RPC request and return a serialized JSON response. */
export async function fetchRequestHandler<TCtx>({
  endpoint = '/rpc',
  router,
  createContext,
  req,
  headers,
}: FetchRequestHandlerOptions<TCtx>): Promise<Response> {
  const resHeaders = headers ?? DEFAULT_HEADERS

  try {
    const url = new URL(req.url)
    if (!url.pathname.startsWith(endpoint)) {
      throw createRPCError({ code: 'RPC_NOT_FOUND', message: 'Request not found' })
    }

    if (req.method !== 'POST' && req.method !== 'GET') {
      throw createRPCError({ code: 'RPC_BAD_REQUEST', message: 'Only GET and POST are supported' })
    }

    const ctx = await createContext({ req })
    const path = parsePath(url, endpoint)

    const { type, rawInput } = req.method === 'POST' ? await parsePostEnvelope(req) : parseGetEnvelope(url)

    if (type !== 'query' && type !== 'mutation') {
      throw createRPCError({ code: 'RPC_BAD_REQUEST', message: 'Missing or invalid type' })
    }

    const proc = getProcedureAtPath(router, path)
    if (!proc) {
      throw createRPCError({ code: 'RPC_NOT_FOUND', message: 'Procedure not found' })
    }

    if (proc._type !== type) {
      throw createRPCError({ code: 'RPC_BAD_REQUEST', message: 'Procedure type mismatch' })
    }

    const data = await proc._call({ ctx, rawInput })
    return jsonResponse(data, RPC_CODES[data.code as never], resHeaders)
  } catch (e: unknown) {
    const [err, status] = rpcToErr(e)
    return jsonResponse(err, status, resHeaders)
  }
}

/** Build a JSON response with a trailing newline. */
function jsonResponse(body: unknown, status = 200, headers = DEFAULT_HEADERS): Response {
  return new Response(JSON.stringify(body) + '\n', {
    status,
    headers,
  })
}

/** Parse the RPC procedure path from the URL and endpoint. */
function parsePath(url: URL, endpoint: string): string[] {
  const pathStr = url.pathname.slice(endpoint.length).replace(/^\//, '')
  return pathStr ? pathStr.split('.') : []
}

/** Parse query params into a request envelope for GET requests. */
function parseGetEnvelope(url: URL): { type: unknown; rawInput: unknown } {
  const type = url.searchParams.get('type') ?? 'query'

  const inputParam = url.searchParams.get('input')
  let input: unknown = undefined

  if (inputParam != null) {
    try {
      input = JSON.parse(inputParam)
    } catch {
      input = inputParam
    }
  } else {
    const obj: Record<string, string> = {}
    for (const [k, v] of url.searchParams.entries()) {
      if (k === 'type') continue
      obj[k] = v
    }
    if (Object.keys(obj).length) input = obj
  }

  return { type, rawInput: input }
}

/** Parse the JSON body into a request envelope for POST requests. */
async function parsePostEnvelope(req: Request): Promise<{ type: unknown; rawInput: unknown }> {
  const body = await req.json().catch(() => null)
  if (!isRecord(body)) {
    throw createRPCError({ code: 'RPC_BAD_REQUEST', message: 'Invalid JSON body' })
  }

  return { type: body.type, rawInput: body.input }
}

/** Narrow unknown values to plain object records. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
