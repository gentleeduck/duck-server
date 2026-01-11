import { RPC_CODES, type RPCCode } from './codes'
import { type RPCError, rpcErrorFrom } from './error'
import type { StandardSchemaV1 } from './schema'

/** Normalized RPC response wrapper for success or error results. */
export type RPCResType<TData, TCode extends RPCCode = RPCCode> =
  | {
      ok: true
      data: TData
      code: TCode
    }
  | {
      ok: false
      code: TCode
      error: Omit<RPCError, 'name'>
    }

/** Build a successful RPC response payload. */
export function rpcOk<TData>(data: TData, code: RPCCode): RPCResType<TData> {
  return { ok: true, data, code }
}

/** Build an error RPC response payload. */
export function rpcErr<const TCode extends RPCCode>(
  code: TCode,
  message?: string,
  issues?: ReadonlyArray<StandardSchemaV1.Issue>,
): RPCResType<never, TCode> {
  return { ok: false, code, error: { code, message: message ?? 'NOT_PROVIDED', issues: issues ?? [] } }
}

/** Convert an unknown error to an RPC error response and HTTP status. */
export function rpcToErr(e: unknown): [RPCResType<never>, number] {
  const de = rpcErrorFrom(e)
  const status = RPC_CODES[de.code as never] ?? RPC_CODES.RPC_INTERNAL_SERVER_ERROR
  return [rpcErr(de.code, de.message, de.issues), status]
}

/** Serialize an RPC response for structured logging. */
export function rpcToLog(res: RPCResType<any>): string {
  return JSON.stringify(res)
}

/**
 * Back-compat object for existing call sites.
 */
export const RPCRes = {
  ok: rpcOk,
  err: rpcErr,
  toErr: rpcToErr,
  toLog: rpcToLog,
} as const
