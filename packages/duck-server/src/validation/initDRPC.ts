import { type AnyProc, Procedure } from './procedure'
import { type AnyRPCRouter, RPCRouterImpl } from './router'

export function initDuckRPC<const TCtx extends Record<string, any>>() {
  return {
    create: () => {
      return {
        procedure: () => new Procedure<TCtx, unknown, unknown>(),
        router: <const T extends Record<string, AnyProc | AnyRPCRouter>>(record: T) => RPCRouterImpl.create<T>(record),
        // TODO: createCaller
        // createCaller: <R extends RouterDef<TCtx, any>>(router: R, ctx: TCtx) => createCaller(router, ctx),
      }
    },
  }
}
