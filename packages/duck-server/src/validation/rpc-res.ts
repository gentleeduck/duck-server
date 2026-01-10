import { RPC_CODES, type RPCCode } from './rpc-codes'
import type { StandardSchemaV1 } from './rpc-schema'

export class RPCError<const T extends RPCCode = RPCCode> extends Error {
  readonly code: T
  readonly cause?: unknown
  readonly issues?: ReadonlyArray<StandardSchemaV1.Issue>

  constructor(opts: { code: T; message: string; cause?: unknown; issues?: ReadonlyArray<StandardSchemaV1.Issue> }) {
    super(opts.message)
    this.code = opts.code
    this.cause = opts.cause
    this.issues = opts.issues ?? []
  }

  /** Convert an error to an RPCError. */
  public static from(e: unknown): RPCError {
    if (e instanceof RPCError) return e
    if (e instanceof Error) return new RPCError({ code: 'RPC_INTERNAL_SERVER_ERROR', message: e.message, cause: e })
    return new RPCError({ code: 'RPC_INTERNAL_SERVER_ERROR', message: 'Unknown error', cause: e })
  }
}

/* ---------------------------------------------
 * Response
 * --------------------------------------------- */

export type RPCResType<TData, TCode extends RPCCode = RPCCode> =
  | {
      ok: true
      data: TData
      code: TCode
    }
  | {
      ok: false
      code: TCode
      error: Omit<RPCError<TCode>, 'name'>
    }

export class RPCRes {
  public static ok<TData>(data: TData, code: RPCCode): RPCResType<TData> {
    return { ok: true, data, code }
  }

  public static err<const TCode extends RPCCode>(
    code: TCode,
    message?: string,
    issues?: ReadonlyArray<StandardSchemaV1.Issue>,
  ): RPCResType<never, TCode> {
    return { ok: false, code, error: { code, message: message ?? 'NOT_PROVIDED', issues: issues ?? [] } }
  }

  public static toErr(e: unknown): [RPCResType<never>, number] {
    const de = RPCError.from(e)
    console.log(de)
    const status = RPC_CODES[de.code as never] ?? RPC_CODES.RPC_INTERNAL_SERVER_ERROR
    return [RPCRes.err(de.code, de.message, de.issues), status]
  }

  public static toLog(res: RPCResType<any>): string {
    return JSON.stringify(res)
  }
}
