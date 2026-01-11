import type { AnyProc } from './procedure'
import { isProcedure } from './procedure'

/** Router type alias for any record shape. */
export type AnyRPCRouter = RPCRouter<any>

/** A router record containing procedures or nested routers. */
export type RouterRecord = Readonly<Record<string, AnyProc | AnyRPCRouter>>

/** Runtime router object created by {@link createRouter}. */
export interface RPCRouter<TRecord extends RouterRecord = RouterRecord> {
  readonly _kind: 'router'
  readonly _def: {
    readonly record: TRecord
  }
}

/** Create an immutable router from a record of procedures and nested routers. */
export function createRouter<const TRecord extends RouterRecord>(record: TRecord): RPCRouter<TRecord> {
  const def = { record }
  Object.freeze(def)
  Object.freeze(record)
  return Object.freeze({ _kind: 'router', _def: def })
}

/** Runtime type guard for router objects. */
export function isRPCRouter(x: unknown): x is AnyRPCRouter {
  return !!x && typeof x === 'object' && (x as AnyRPCRouter)._kind === 'router'
}

/** Flat index of resolved procedures and nested routers by dotted path. */
export interface RouterIndex {
  procs: Map<string, AnyProc>
  routers: Map<string, AnyRPCRouter>
}

const ROUTER_INDEX = new WeakMap<AnyRPCRouter, RouterIndex>()

/** Join a path array into a dotted router path. */
function joinPath(path: readonly string[]) {
  return path.join('.')
}

/** Build a flat index of all procedures and nested routers. */
export function buildRouterIndex(router: AnyRPCRouter): RouterIndex {
  const procs = new Map<string, AnyProc>()
  const routers = new Map<string, AnyRPCRouter>()

  const visit = (node: AnyRPCRouter, prefix: string[]) => {
    const rec = node._def.record as Record<string, any>

    for (const key in rec) {
      const val = rec[key]
      const nextPath = prefix.length ? [...prefix, key] : [key]

      if (isProcedure(val)) {
        procs.set(joinPath(nextPath), val)
        continue
      }

      if (isRPCRouter(val)) {
        routers.set(joinPath(nextPath), val)
        visit(val, nextPath)
      }
    }
  }

  visit(router, [])
  return { procs, routers }
}

/** Return a cached router index, building it on first access. */
export function getRouterIndex(router: AnyRPCRouter): RouterIndex {
  const cached = ROUTER_INDEX.get(router)
  if (cached) return cached
  const idx = buildRouterIndex(router)
  ROUTER_INDEX.set(router, idx)
  return idx
}

/** Look up a procedure by its dotted path, or return null if not found. */
export function getProcedureAtPath(router: AnyRPCRouter, path: readonly string[]): AnyProc | null {
  const idx = getRouterIndex(router)
  return idx.procs.get(joinPath(path)) ?? null
}
