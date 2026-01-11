import type { RPCCode } from './codes'
import type { StandardSchemaV1 } from './schema'

/** Typed RPC error shape used throughout the server. */
export interface RPCError extends Error {
  code: RPCCode
  cause?: unknown
  issues?: ReadonlyArray<StandardSchemaV1.Issue>
}

/** Constructor options for creating an {@link RPCError}. */
export type RPCErrorOptions = {
  code: RPCCode
  message: string
  cause?: unknown
  issues?: ReadonlyArray<StandardSchemaV1.Issue>
}

/** Signature for the RPCError constructor. */
export type RPCErrorConstructor = new (opts: RPCErrorOptions) => RPCError

/**
 * Create a typed RPC error without using classes.
 */
export function createRPCError(opts: RPCErrorOptions): RPCError {
  const err = new Error(opts.message) as RPCError
  err.name = 'RPCError'
  err.code = opts.code
  err.cause = opts.cause
  err.issues = opts.issues ?? []
  return err
}

/**
 * Back-compat constructor for schema code that does `new RPCError(...)`.
 */
export const RPCError: RPCErrorConstructor = function RPCErrorCtor(opts: RPCErrorOptions) {
  return createRPCError(opts)
} as unknown as RPCErrorConstructor

/** Runtime type guard for RPCError values. */
export function isRPCError(e: unknown): e is RPCError {
  return e instanceof Error && typeof (e as RPCError).code === 'string'
}

/** Convert an unknown error to an RPCError. */
export function rpcErrorFrom(e: unknown): RPCError {
  if (isRPCError(e)) return e
  if (e instanceof Error) {
    return createRPCError({ code: 'RPC_INTERNAL_SERVER_ERROR', message: e.message, cause: e })
  }
  return createRPCError({ code: 'RPC_INTERNAL_SERVER_ERROR', message: 'Unknown error', cause: e })
}
