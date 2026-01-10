import type { MiddlewareFn } from './middleware'
import { RPCRes as R, type RPCResType } from './rpc-res'
import { type AnySchema, type InferOut, parseInput, parseOutput } from './rpc-schema'

/** Procedure type. */
export type ProcedureType = 'query' | 'mutation'

/** Procedure definition. */
export type ProcedureDef<TCtx, TInput, TOutput> = {
  _kind: 'procedure'
  _type: ProcedureType
  _input: TInput
  _output: TOutput
  _call: (opts: { ctx: TCtx; rawInput: TInput }) => Promise<RPCResType<TOutput>>
}

/** Any procedure. */
export type AnyProc = ProcedureDef<any, any, any>

/** Resolver type. */
export type Resolver<TCtx, TInput, TOutput> = (opts: {
  ctx: TCtx
  input: TInput
}) => Promise<RPCResType<TOutput>> | RPCResType<TOutput>

export class Procedure<TCtx, TInput, TOutput> {
  private middlewares: MiddlewareFn<any, any>[] = []
  private inputSchema?: AnySchema | undefined
  private outputSchema?: AnySchema | undefined

  constructor(opts?: {
    middlewares?: MiddlewareFn<any, any>[] | undefined
    inputSchema?: AnySchema | undefined
    outputSchema?: AnySchema | undefined
  }) {
    if (opts?.middlewares) this.middlewares = opts.middlewares
    if (opts?.inputSchema) this.inputSchema = opts.inputSchema
    if (opts?.outputSchema) this.outputSchema = opts.outputSchema
  }

  use<TNewCtx>(middleWare: MiddlewareFn<TCtx, TNewCtx>) {
    return new Procedure<TNewCtx, TInput, TOutput>({
      middlewares: [...this.middlewares, middleWare],
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
    })
  }

  input<TSchema extends AnySchema>(schema: TSchema) {
    return new Procedure<TCtx, InferOut<TSchema>, TOutput>({
      middlewares: this.middlewares,
      inputSchema: schema,
      outputSchema: this.outputSchema,
    })
  }

  output<TSchema extends AnySchema>(schema: TSchema) {
    return new Procedure<TCtx, TInput, InferOut<TSchema>>({
      middlewares: this.middlewares,
      inputSchema: this.inputSchema,
      outputSchema: schema,
    })
  }

  query<TOut>(resolver: Resolver<TCtx, TInput, TOut>): ProcedureDef<TCtx, TInput, TOut> {
    return this.#make('query', resolver)
  }

  mutation<TOut>(resolver: Resolver<TCtx, TInput, TOut>): ProcedureDef<TCtx, TInput, TOut> {
    return this.#make('mutation', resolver)
  }

  #make<TOut>(type: ProcedureType, resolver: Resolver<TCtx, TInput, TOut>): ProcedureDef<TCtx, TInput, TOut> {
    return {
      _kind: 'procedure',
      _type: type,
      _input: undefined as TInput,
      _output: undefined as TOut,
      _call: async ({ ctx, rawInput }) => {
        if (this.inputSchema) {
          rawInput = await parseInput(this.inputSchema, rawInput)
        }

        try {
          const callResolver = async (nextCtx: TCtx): Promise<RPCResType<TOut>> => {
            const out = await resolver({ ctx: nextCtx, input: rawInput })
            return (this.outputSchema ? await parseOutput(this.outputSchema, out) : out) as RPCResType<TOut>
          }

          const runMiddlewares = async (index: number, nextCtx: TCtx): Promise<RPCResType<TOut>> => {
            if (index >= this.middlewares.length) {
              return callResolver(nextCtx)
            }

            const mw = this.middlewares[index]!
            const result = await mw({
              ctx: nextCtx,
              next: async (opts) => {
                const updatedCtx = (opts?.ctx ?? nextCtx) as TCtx
                const data = await runMiddlewares(index + 1, updatedCtx)
                return { ok: true, data }
              },
            })

            if (result.ok) return result.data as RPCResType<TOut>
            return R.toErr(result.error)[0]
          }

          return await runMiddlewares(0, ctx)
        } catch (e: unknown) {
          return R.toErr(e)[0]
        }
      },
    }
  }

  public static isProcedure(x: unknown): x is AnyProc {
    return !!x && typeof x === 'object' && (x as any)._kind === 'procedure'
  }
}

// export type ExtractProcedures<T> = {
//   [K in keyof T]: T[K] extends ProcedureDef<any, infer I, infer O>
//     ? (input: I) => Promise<O>
//     : T[K] extends RPCRouterDef<any, infer R2>
//       ? ExtractProcedures<R2>
//       : never
// }
