import type { AnyProc } from './procedure'
import { createProcedure } from './procedure'
import type { AnyRPCRouter } from './router'
import { createRouter } from './router'

/** Initialize typed RPC factory helpers bound to a context shape. */
export function initDuckRPC<const TCtx extends Record<string, any>>() {
  return {
    create: () => {
      return {
        procedure: () => createProcedure<TCtx>(),
        router: <const T extends Record<string, AnyProc | AnyRPCRouter>>(record: T) => createRouter(record),
      }
    },
  }
}
