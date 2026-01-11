# RPC Client Architecture

This document explains how the Duck RPC client works, with a focus on the proxy-based API.

## Overview

There are two layers:

1. Low-level client: `createRPCClient` in `src/client/low-level-client.ts`
   - You call `client.query("user.get", input)` or `client.mutation("upload.delete", input)`.
   - This layer knows how to build URLs, encode the body, and decode the response.

2. Proxy client: `createRPCProxyClient` in `src/client/proxy-client.ts`
   - You call `client.user.get.query(input)` or `client.upload.delete.mutation(input)`.
   - This layer is only syntax sugar built on top of the low-level client.

Both layers share the same wire protocol: a POST request to `/rpc/<dotted.path>` with a body:

```json
{ "type": "query" | "mutation", "input": <any> }
```

## Low-level client (`createRPCClient`)

This is the transport and serialization layer.

### Inputs

- `baseUrl`: The server origin, ex: `http://localhost:3000`.
- `endpoint`: The RPC path prefix, default `"/rpc"`.
- `format`: `"json"` or `"cbor"`.
- `headers`: Default headers merged into every request.
- `fetch`: A custom `fetch` implementation (useful for tests or runtimes).

### How a call is constructed

1. `joinUrl(baseUrl, endpoint, path)` creates a URL like:
   - `http://localhost:3000` + `/rpc` + `/upload.deleteBucket`
   - Final: `http://localhost:3000/rpc/upload.deleteBucket`
2. The request body is built as:
   - `{ type: "query" | "mutation", input: <input> }`
3. The body is encoded:
   - JSON: `JSON.stringify(payload)`
   - CBOR: `cborEncode(payload)` (sent as `Uint8Array`)
4. The headers are set:
   - JSON: `content-type: application/json`, `accept: application/json`
   - CBOR: `content-type: application/cbor`, `accept: application/cbor`
5. `fetch` is executed with `method: "POST"`.

### Response decoding

`decodeResponse` reads the server `content-type`:

- `application/cbor` => `cborDecode(Uint8Array)`
- `application/json` => `res.json()`
- otherwise => `res.text()`

The decoded object is returned as `RPCResType<TData>`, so you always get the unified response shape:

```ts
{ ok: true, data: TData, code: string }
{ ok: false, error: { code, message, issues }, code: string }
```

### Error behavior

This client does not throw on RPC errors. It always resolves to `RPCResType<TData>`.
You are expected to check `res.ok`.

## Proxy client (`createRPCProxyClient`)

The proxy client creates a nested object that mirrors your router structure.
It uses JavaScript `Proxy` to build paths dynamically.

### How property access becomes a path

Each property access creates a new proxy with an extended path list:

```
client.upload.deleteBucket.mutation(...)
      ^      ^             ^
      |      |             |
   "upload" "deleteBucket" "mutation"
```

- When you access `client.upload`, the proxy records `["upload"]`.
- When you access `.deleteBucket`, it becomes `["upload", "deleteBucket"]`.
- When you access `.mutation`, it triggers a function call that uses the path
  `"upload.deleteBucket"`.

### Reserved properties

The proxy intercepts a few special property names:

- `query`: builds a query call.
- `mutation`: builds a mutation call.
- `then`: returns `undefined` to avoid being treated like a Promise.
- `Symbol.toStringTag`: identifies the proxy in tooling.

### Why a Proxy

Using a proxy avoids manual string paths and keeps the call-site aligned
with your router keys. It also enables typed inference from your router
definition (if you pass `createRPCProxyClient<AppRouter>(...)`).

### Type inference

The type-level mapping:

- walks the router record (`RouterClient`),
- maps procedures to either `{ query(...) }` or `{ mutation(...) }`,
- infers input and output types from `ProcedureDef`.

This gives you typed access like:

```ts
const client = createRPCProxyClient<AppRouter>(...)
const res = await client.upload.deleteBucket.mutation({ bucketId: "...", bucket: "..." })
```

No path strings are required and the input type is checked at compile time.

## CBOR vs JSON

The client chooses a wire format via `format`:

- `json` is the default, easy to debug, and widely supported.
- `cbor` is smaller and faster for large payloads or binary data.

The server will respond in CBOR when it sees `accept: application/cbor`
and in JSON otherwise.

## When to use each layer

- Use `createRPCClient` if you want minimal overhead or you already have
  string paths.
- Use `createRPCProxyClient` if you want tRPC-style ergonomics and type
  inference from the router.

## Files

- Low-level client: `src/client/low-level-client.ts`
- Proxy client: `src/client/proxy-client.ts`
- Barrel export: `src/client/index.ts`
- Example usage: `src/client.ts`
