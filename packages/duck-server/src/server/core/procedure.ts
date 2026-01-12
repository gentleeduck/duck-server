import { composeMiddlewares, type MiddlewareFn } from './middleware'
import { type RPCResType, rpcToErr } from './response'
import { type AnySchema, type InferOut, parseInput, parseOutput } from './schema'

/** Procedure type. */
export type ProcedureType = 'query' | 'mutation'

/** Procedure definition. */
export type ProcedureDef<TCtx, TInput, TOutput, TType extends ProcedureType = ProcedureType> = {
  _kind: 'procedure'
  _type: TType
  _input: TInput
  _output: TOutput
  _call: (opts: { ctx: TCtx; rawInput: TInput }) => Promise<RPCResType<TOutput>>
}

/** Any procedure. */
export type AnyProc = ProcedureDef<any, any, any, ProcedureType>

/** Resolver type. */
export type Resolver<TCtx, TInput, TOutput> = (opts: {
  ctx: TCtx
  input: TInput
}) => Promise<RPCResType<TOutput>> | RPCResType<TOutput>

/** Fluent procedure builder with middleware and schema configuration. */
export type Procedure<TCtx, TInput, TOutput> = {
  /** Attach a middleware that can refine the context type. */
  use<TNewCtx extends TCtx>(middleWare: MiddlewareFn<TCtx, TNewCtx>): Procedure<TNewCtx, TInput, TOutput>
  /** Add an input schema that parses incoming raw input. */
  input<TSchema extends AnySchema>(schema: TSchema): Procedure<TCtx, InferOut<TSchema>, TOutput>
  /** Add an output schema that validates resolver output. */
  output<TSchema extends AnySchema>(schema: TSchema): Procedure<TCtx, TInput, InferOut<TSchema>>
  /** Create a query procedure definition. */
  query<TOut extends TOutput>(resolver: Resolver<TCtx, TInput, TOut>): ProcedureDef<TCtx, TInput, TOut, 'query'>
  /** Create a mutation procedure definition. */
  mutation<TOut extends TOutput>(resolver: Resolver<TCtx, TInput, TOut>): ProcedureDef<TCtx, TInput, TOut, 'mutation'>
  /** Turn of validation for this procedure's input and output. */
  validation(value: 'on' | 'off'): Procedure<TCtx, TInput, TOutput>
}

/** Internal builder state for middleware and schema configuration. */
type ProcedureState = {
  middlewares: MiddlewareFn<any, any>[]
  inputSchema?: AnySchema | undefined
  outputSchema?: AnySchema | undefined
  validation?: 'on' | 'off' | undefined
}

/** Create a new procedure builder with optional base state. */
export function createProcedure<TCtx, TInput = unknown, TOutput = unknown>(
  state: ProcedureState = { middlewares: [], validation: 'on' },
): Procedure<TCtx, TInput, TOutput> {
  const use = <TNewCtx>(middleWare: MiddlewareFn<TCtx, TNewCtx>) =>
    createProcedure<TNewCtx, TInput, TOutput>({
      middlewares: [...state.middlewares, middleWare],
      inputSchema: state.inputSchema,
      outputSchema: state.outputSchema,
      validation: state.validation,
    })

  const input = <TSchema extends AnySchema>(schema: TSchema) =>
    createProcedure<TCtx, InferOut<TSchema>, TOutput>({
      middlewares: state.middlewares,
      inputSchema: schema,
      outputSchema: state.outputSchema,
      validation: state.validation,
    })

  const output = <TSchema extends AnySchema>(schema: TSchema) =>
    createProcedure<TCtx, TInput, InferOut<TSchema>>({
      middlewares: state.middlewares,
      inputSchema: state.inputSchema,
      outputSchema: schema,
      validation: state.validation,
    })

  const make = <TOut extends TOutput, TType extends ProcedureType>(
    type: TType,
    resolver: Resolver<TCtx, TInput, TOut>,
  ): ProcedureDef<TCtx, TInput, TOut, TType> => {
    // Pre-compose middleware chain once at procedure creation time
    // This avoids creating the dispatch function and next closures on every request
    const run = composeMiddlewares<TCtx, TOut>(state.middlewares)

    return {
      _kind: 'procedure',
      _type: type,
      _input: undefined as TInput,
      _output: undefined as TOut,
      _call: async ({ ctx, rawInput }) => {
        try {
          // Validate input if needed
          let validatedInput = rawInput
          if (state.inputSchema && state.validation === 'on') {
            validatedInput = await parseInput(state.inputSchema, rawInput)
          }

          // Create resolver with validated input - this closure is created per request
          // but the middleware chain structure itself is pre-composed
          const resolverWithInput = async (nextCtx: TCtx): Promise<RPCResType<TOut>> => {
            const out = await resolver({ ctx: nextCtx, input: validatedInput })
            if (!state.outputSchema || !out.ok) return out
            const data = state.validation === 'on' ? await parseOutput(state.outputSchema, out.data) : out.data
            return { ...out, data }
          }

          // Run the pre-composed chain with the request-specific resolver
          return await run(ctx, resolverWithInput)
        } catch (e: unknown) {
          return rpcToErr(e)[0]
        }
      },
    }
  }

  const query = <TOut extends TOutput>(resolver: Resolver<TCtx, TInput, TOut>) => make('query', resolver)
  const mutation = <TOut extends TOutput>(resolver: Resolver<TCtx, TInput, TOut>) => make('mutation', resolver)
  const validation = (value: 'on' | 'off' = 'on') => {
    return createProcedure<TCtx, TInput, TOutput>({ middlewares: state.middlewares, validation: value })
  }

  return {
    use,
    input,
    output,
    query,
    mutation,
    validation,
  }
}

/** Runtime type guard for procedure definitions. */
export function isProcedure(x: unknown): x is AnyProc {
  return !!x && typeof x === 'object' && (x as AnyProc)._kind === 'procedure'
}
