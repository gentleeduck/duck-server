# @gentleduck/rpc

Functional, type-safe RPC utilities for Hono-based servers.

## Install

```bash
pnpm add @gentleduck/rpc
```

## Quick Start

```ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { z } from 'zod'
import { initDuckRPC, rpcServer, RPCRes as R } from '@gentleduck/rpc'

type BaseContext = { req: Request; requestId: string }

const t = initDuckRPC<BaseContext>().create()
const publicProcedure = t.procedure()

const helloRouter = t.router({
  hello: publicProcedure.input(z.object({ name: z.string() })).mutation(async ({ input }) => {
    return R.ok({ greeting: `Hello ${input.name}` }, 'RPC_OK')
  }),
})

const appRouter = t.router({
  hello: helloRouter,
})

const app = new Hono()

app.use(
  '/rpc/*',
  rpcServer({
    router: appRouter,
    endpoint: '/rpc',
    createContext: ({ req }) => ({ req, requestId: crypto.randomUUID() }),
  }),
)

serve(app, () => console.log('Listening on port 3000'))
```

## API Notes

- Default endpoint is `/rpc`.
- Procedures support `query` and `mutation`.
- Middleware runs before the resolver and can refine `ctx`.

## Responses

All responses follow this shape:

```json
{ "ok": true, "data": { ... }, "code": "RPC_OK" }
```

Errors:

```json
{ "ok": false, "code": "RPC_BAD_REQUEST", "error": { "code": "RPC_BAD_REQUEST", "message": "...", "issues": [] } }
```

## License

MIT
