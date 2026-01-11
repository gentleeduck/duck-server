import type { AnyProc, ProcedureDef } from '../server/core/procedure'
import type { RPCResType } from '../server/core/response'
import type { AnyRPCRouter, RouterRecord, RPCRouter } from '../server/core/router'
import { type CallOptions, type ClientOptions, createRPCClient } from './low-level-client'

/**
 * Proxy-based client that mirrors the router shape.
 * Property access builds a dotted path until `.query` or `.mutation` is called.
 */

/** Infer procedure input type from a ProcedureDef. */
type ProcInput<TProc> = TProc extends ProcedureDef<any, infer TInput, any> ? TInput : never
/** Infer procedure output type from a ProcedureDef. */
type ProcOutput<TProc> = TProc extends ProcedureDef<any, any, infer TOutput> ? TOutput : never

/** Map a procedure to its query/mutation call shape. */
type ProcClient<TProc extends AnyProc> = TProc['_type'] extends 'query'
  ? {
      query: (input: ProcInput<TProc>, options?: CallOptions) => Promise<RPCResType<ProcOutput<TProc>>>
    }
  : {
      mutation: (input: ProcInput<TProc>, options?: CallOptions) => Promise<RPCResType<ProcOutput<TProc>>>
    }

/** Recursively map a router record to nested client nodes. */
type RouterClient<TRecord extends RouterRecord> = {
  [K in keyof TRecord]: TRecord[K] extends AnyProc
    ? ProcClient<TRecord[K]>
    : TRecord[K] extends RPCRouter<infer R>
      ? RouterClient<R>
      : never
}

/** Typed proxy client derived from a router definition. */
export type RPCProxyClient<TRouter extends AnyRPCRouter> = TRouter extends RPCRouter<infer R> ? RouterClient<R> : never

/**
 * Create a tRPC-style proxy client (ex: client.user.get.query).
 * The proxy returns nested objects until `query` or `mutation` is accessed.
 */
export function createRPCProxyClient<TRouter extends AnyRPCRouter>(opts: ClientOptions): RPCProxyClient<TRouter> {
  const client = createRPCClient(opts)

  // Proxy builds up dotted paths at property access time.
  const buildProxy = (path: string[]): any =>
    new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'query') {
            return (input?: unknown, options?: CallOptions) => client.query(path.join('.'), input, options)
          }
          if (prop === 'mutation') {
            return (input?: unknown, options?: CallOptions) => client.mutation(path.join('.'), input, options)
          }
          // Prevent Promise-like behavior when awaited accidentally.
          if (prop === 'then') return undefined
          if (prop === Symbol.toStringTag) return 'RPCProxyClient'
          return buildProxy([...path, String(prop)])
        },
      },
    )

  return buildProxy([]) as RPCProxyClient<TRouter>
}
