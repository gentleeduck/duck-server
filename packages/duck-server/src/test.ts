// type ResolverCtx = { userId?: string }
// type ResolverInput<I> = { ctx: ResolverCtx; input: I }
//
// type ProcDef<I, O> = {
//   _type: 'query' | 'mutation'
//   _input: I
//   _output: O
//   _schema?: AnySchema
//   resolve: (args: ResolverInput<I>) => Promise<O> | O
// }
//
// // A tiny caller to demonstrate runtime validation
// export function createCaller<T extends Record<string, ProcDef<any, any>>>(router: T, ctx: ResolverCtx) {
//   return new Proxy(
//     {},
//     {
//       get(_t, key: string) {
//         const proc = (router as any)[key] as ProcDef<any, any> | undefined
//         if (!proc) return undefined
//         return (input: unknown) => proc.resolve({ ctx, input })
//       },
//     },
//   ) as {
//     [K in keyof T]: (
//       input: T[K] extends ProcDef<infer I, any> ? I : never,
//     ) => Promise<T[K] extends ProcDef<any, infer O> ? O : never>
//   }
// }
