import type { MiddlewareHandler } from 'hono'
import { routePath } from 'hono/route'
import { type CreateContextOpts, fetchRequestHandler } from '.'
import type { RPCRouterDef } from './router'

type dRPCOptions<TCtx> = {
  router: RPCRouterDef<TCtx, any>
  createContext: (opts: CreateContextOpts) => Promise<TCtx> | TCtx
  endpoint?: string
}

export function drpcServer<TCtx>({ endpoint, createContext, ...rest }: dRPCOptions<TCtx>): MiddlewareHandler {
  const bodyProps = new Set(['arrayBuffer', 'blob', 'formData', 'json', 'text'] as const)
  type BodyProp = typeof bodyProps extends Set<infer T> ? T : never
  return async (c) => {
    const canWithBody = c.req.method === 'GET' || c.req.method === 'HEAD'

    // Auto-detect endpoint from route path if not explicitly provided
    let resolvedEndpoint = endpoint
    if (!endpoint) {
      const path = routePath(c)
      if (path) {
        // Remove wildcard suffix (e.g., "/v1/*" -> "/v1")
        resolvedEndpoint = path.replace(/\/\*+$/, '') || '/trpc'
      } else {
        resolvedEndpoint = '/trpc'
      }
    }
    const res = fetchRequestHandler({
      ...rest,
      createContext: async (opts) =>
        ({
          ...(createContext ? await createContext(opts) : {}),
          env: c.env,
        }) as TCtx,
      endpoint: resolvedEndpoint!,
      req: canWithBody
        ? c.req.raw
        : new Proxy(c.req.raw, {
            get(t, p, _r) {
              if (bodyProps.has(p as BodyProp)) {
                return () => c.req[p as BodyProp]()
              }
              return Reflect.get(t, p, t)
            },
          }),
    }).then((res) =>
      // @ts-expect-error c.body accepts both ReadableStream and null but is not typed well
      c.body(res.body, res),
    )
    return res
  }
}
