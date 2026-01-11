import type { MiddlewareHandler } from 'hono'
import { routePath } from 'hono/route'
import type { RPCRouter } from '../core/router'
import type { CreateContextOpts } from './fetch'
import { fetchRequestHandler } from './fetch'

/** Options for wiring Duck RPC into a Hono app. */
export interface RPCServerOptions<TCtx> {
  /** RPC router */
  router: RPCRouter<any>
  /** Create context for every request (required) */
  createContext: (opts: CreateContextOpts) => Promise<TCtx> | TCtx
  /** Default: '/rpc' */
  endpoint?: string
  /** Default: '/rpc' */
  defaultEndpoint?: string
  /** Add extra fields to ctx for every request (ex: env, reqId, logger) */
  extendContext?: (base: TCtx, honoCtx: any) => TCtx | Promise<TCtx>
  /** Custom headers for RPC responses (optional). */
  headers?: Record<string, string>
}

/** Create a Hono middleware that handles Duck RPC requests. */
export function rpcServer<TCtx>(opts: RPCServerOptions<TCtx>): MiddlewareHandler {
  return async (c) => {
    const cannotHaveBody = c.req.method === 'GET' || c.req.method === 'HEAD'
    const endpoint = resolveEndpoint(c, opts)
    const req: Request = c.req.raw

    const createContext = async (ctxOpts: CreateContextOpts): Promise<TCtx> => {
      const base = (await opts.createContext(ctxOpts)) as TCtx
      return opts.extendContext ? await opts.extendContext(base, c) : base
    }

    const res = await fetchRequestHandler({
      router: opts.router,
      createContext,
      endpoint,
      req,
      // Use Hono's body helpers instead of proxying Request methods.
      ...(cannotHaveBody
        ? {}
        : {
            bodyReader: {
              json: () => c.req.json(),
              arrayBuffer: () => c.req.arrayBuffer(),
            },
            contentType: c.req.header('content-type'),
          }),
      ...(opts.headers ? { headers: opts.headers } : {}),
    })

    // hono typing issue: c.body accepts ReadableStream | null but types may not match
    // @ts-expect-error
    return c.body(res.body, res)
  }
}

/** Resolve the effective endpoint for this request. */
function resolveEndpoint(c: any, opts: RPCServerOptions<any>): string {
  if (opts.endpoint) return opts.endpoint

  const fallback = opts.defaultEndpoint ?? '/rpc'
  const path = routePath(c)
  if (!path) return fallback

  // "/v1/*" -> "/v1"
  const cleaned = path.replace(/\/\*+$/, '')
  return cleaned || fallback
}
