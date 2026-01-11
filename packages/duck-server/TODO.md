# TODO

## Performance
- [x] Precompute a route map for `path -> proc` to avoid walking the router tree per request.
- Skip `req.json()` for GET requests and allow querystring input to avoid body parse overhead.
- Reuse a single JSON serializer (or avoid the trailing `\n`) to reduce allocations on large payloads.
- Avoid per-request `Proxy` where possible; pass a stable `Request` and read body via `c.req` methods only.
- Add optional input/output validation toggle to skip schema work in hot paths.

## Features
- Support batch calls (array of requests) for fewer round trips.
- Add `onError` hook for custom logging and error shaping.
- Add request/response middleware hooks at router/procedure level.
- Add standard error format with `meta` fields (requestId, path, type).
- Add support for GET queries with `?input=` JSON or `?input=` base64.

## DX / Testing
- Add unit tests for middleware ordering and context mutation.
- Add tests for bad JSON, missing type, and schema validation errors.
- Add integration test for `protectedProcedure` with auth headers.
