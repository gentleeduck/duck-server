import { type RPCRouter, RPCRouterIndex } from './router'
import { RPC_CODES } from './rpc-codes'
import { RPCRes as R, RPCError } from './rpc-res'

export type CreateContextOpts = { req: Request }

type FetchRequestHandlerOptions<TCtx> = {
  router: RPCRouter<any>
  createContext: (opts: CreateContextOpts) => Promise<TCtx> | TCtx
  endpoint?: string // default "/trpc"
  req: Request
}

export async function fetchRequestHandler<TCtx>({
  endpoint = '/trpc',
  router,
  createContext,
  req,
}: FetchRequestHandlerOptions<TCtx>): Promise<Response> {
  try {
    const url = new URL(req.url)
    if (!url.pathname.startsWith(endpoint)) {
      throw new RPCError({ code: 'RPC_NOT_FOUND', message: 'DRPC_REQUEST_NOT_FOUND' })
    }

    const ctx = await createContext({ req })

    // /trpc/a.b.c
    const pathStr = url.pathname.slice(endpoint.length).replace(/^\//, '')
    const path = pathStr ? pathStr.split('.') : []

    if (req.method !== 'POST' && req.method !== 'GET') {
      throw new RPCError({ code: 'RPC_BAD_REQUEST', message: 'Only POST supported' })
    }

    const body = await req.json().catch(() => null)
    if (!isRecord(body)) {
      throw new RPCError({ code: 'RPC_BAD_REQUEST', message: 'Invalid JSON body' })
    }

    const type = body.type
    const rawInput = body.input

    if (type !== 'query' && type !== 'mutation') {
      throw new RPCError({ code: 'RPC_BAD_REQUEST', message: 'Missing or invalid type' })
    }

    const proc = RPCRouterIndex.getProcedureAtPath(router, path)
    if (!proc) {
      throw new RPCError({ code: 'RPC_NOT_FOUND', message: 'Procedure type mismatch' })
    }

    if (proc._type !== type) {
      throw new RPCError({ code: 'RPC_BAD_REQUEST', message: 'Procedure type mismatch' })
    }

    const data = await proc._call({ ctx, rawInput })

    return new Response(JSON.stringify(data) + '\n', {
      status: RPC_CODES[data.code as never],
      headers: RES_HEADERS,
    })
  } catch (e: any) {
    let [err, status] = R.toErr(e)
    return new Response(JSON.stringify(err) + '\n', {
      status,
      headers: RES_HEADERS,
    })
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

const RES_HEADERS = {
  'content-type': 'application/json',
  'x-powered-by': 'duck-server',
}
