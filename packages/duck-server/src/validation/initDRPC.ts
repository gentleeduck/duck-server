import { type AnyProc, Procedure } from './procedure'
import { type AnyRPCRouter, createRPCRouter } from './router'

export function initDuckRPC<TCtx>() {
  return {
    create: () => {
      return {
        procedure: () => new Procedure<TCtx, unknown, unknown>(),
        router: <const T extends Record<string, AnyProc | AnyRPCRouter>>(record: T) => createRPCRouter<TCtx, T>(record),
        // createCaller: <R extends RouterDef<TCtx, any>>(router: R, ctx: TCtx) => createCaller(router, ctx),
      }
    },
  }
}
