import type { AnyProc } from './procedure'

export type RPCRouterDef<TCtx, TRecord extends Record<string, any>> = {
  _kind: 'router'
  _ctx: TCtx
  _record: TRecord
}

export type AnyRPCRouter = RPCRouterDef<any, any>

export function isRPCRouter(x: any): x is AnyRPCRouter {
  return x && x._kind === 'router'
}

export function createRPCRouter<TCtx, T extends Record<string, AnyProc | AnyRPCRouter>>(
  record: T,
): RPCRouterDef<TCtx, T> {
  return { _kind: 'router', _ctx: undefined as any, _record: record }
}
