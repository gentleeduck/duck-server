import { type AnyProc, Procedure } from './procedure'

export type AnyRPCRouter = RPCRouter<any>

export type RouterRecord = Readonly<Record<string, AnyProc | AnyRPCRouter>>

export interface RPCRouter<TRecord extends RouterRecord = RouterRecord> {
  readonly _kind: 'router'
  readonly _def: {
    readonly record: TRecord
  }
}

export class RPCRouterImpl<const TRecord extends RouterRecord> implements RPCRouter<TRecord> {
  public readonly _kind = 'router' as const
  public readonly _def: RPCRouter<TRecord>['_def']

  private constructor(record: TRecord) {
    this._def = { record }
    // optional hard immutability
    Object.freeze(record)
    Object.freeze(this._def)
    Object.freeze(this)
  }

  public static create<const T extends RouterRecord>(record: T): RPCRouter<T> {
    return new RPCRouterImpl(record)
  }

  public static isRPCRouter(x: unknown): x is AnyRPCRouter {
    return !!x && typeof x === 'object' && (x as any)._kind === 'router'
  }
}

export interface RouterIndex {
  procs: Map<string, AnyProc>
  routers: Map<string, AnyRPCRouter>
}

const ROUTER_INDEX = new WeakMap<AnyRPCRouter, RouterIndex>()

export class RPCRouterIndex {
  private static joinPath(path: readonly string[]) {
    return path.join('.')
  }

  public static buildIndex(router: AnyRPCRouter): RouterIndex {
    const procs = new Map<string, AnyProc>()
    const routers = new Map<string, AnyRPCRouter>()

    const visit = (node: AnyRPCRouter, prefix: string[]) => {
      const rec = node._def.record as Record<string, any>

      for (const key in rec) {
        const val = rec[key]
        const nextPath = prefix.length ? [...prefix, key] : [key]

        if (Procedure.isProcedure(val)) {
          procs.set(this.joinPath(nextPath), val)
          continue
        }

        if (RPCRouterImpl.isRPCRouter(val)) {
          routers.set(this.joinPath(nextPath), val)
          visit(val, nextPath)
        }
      }
    }

    visit(router, [])
    return { procs, routers }
  }

  public static getRouterIndex(router: AnyRPCRouter): RouterIndex {
    const cached = ROUTER_INDEX.get(router)
    if (cached) return cached
    const idx = this.buildIndex(router)
    ROUTER_INDEX.set(router, idx)
    return idx
  }

  public static getProcedureAtPath(router: AnyRPCRouter, path: readonly string[]): AnyProc | null {
    const idx = this.getRouterIndex(router)
    return idx.procs.get(this.joinPath(path)) ?? null
  }
}
