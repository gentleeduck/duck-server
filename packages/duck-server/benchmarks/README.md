# Comprehensive Benchmarks

This folder contains comprehensive, repeatable benchmarks that compare Duck RPC and tRPC across multiple dimensions including serialization formats, validation libraries, payload sizes, load patterns, and performance metrics.

## What it measures

### Request Metrics (via autocannon)
- **Throughput**: requests/sec and bytes/sec
- **Latency**: p50, p90, p95, p99, p99.9, min, max
- **Error rate**: errors, timeouts, non-2xx responses

### Server Resource Metrics
- **CPU**: User and system CPU time (milliseconds)
- **Memory**: RSS delta, heap used/total deltas (bytes)
- **Event Loop**: Mean, p95, p99, max delay (milliseconds)

### Advanced Metrics
- **GC Statistics**: Heap size limits, fragmentation ratio, available heap
- **Response Sizes**: Min, max, average response sizes (bytes)
- **Memory Efficiency**: Requests per MB of memory used

## Scenarios

### Payload Sizes
- `tiny-*`: 100 bytes
- `small-*`: 1 KB
- `medium-*`: 4 KB
- `large-*`: 16 KB
- `xlarge-*`: 64 KB
- `xxlarge-*`: 256 KB

### Serialization Formats
- `*-json-*`: JSON serialization (both frameworks)
- `*-cbor-*`: CBOR serialization (Duck RPC only)

### Validation Libraries
- `*-zod`: Zod validation (default, both frameworks)
- `*-valibot`: Valibot validation (Duck RPC only)
- `*-arktype`: Arktype validation (Duck RPC only)
- `*-typebox`: TypeBox validation (Duck RPC only)
- `*-novalidate`: No validation (both frameworks)

### Example Scenario Names
- `small-json-zod`: 1 KB JSON with Zod validation
- `large-cbor-zod`: 16 KB CBOR with Zod validation
- `medium-json-valibot`: 4 KB JSON with Valibot validation
- `xlarge-json-novalidate`: 64 KB JSON without validation

## Load Patterns

### Sustained (default)
Steady load for the full duration.

```bash
pnpm bench -- --load-pattern sustained
```

### Burst
Short, high-intensity load (1/4 of duration).

```bash
pnpm bench -- --load-pattern burst
```

### Ramp-up
Gradually increasing connections (16 → 32 → 64 → 128 → max).

```bash
pnpm bench -- --load-pattern rampup
```

### Mixed
Combination of connection counts and pipelining levels.

```bash
pnpm bench -- --load-pattern mixed
```

### Connections
Tests multiple connection counts: 16, 32, 64, 128, 256.

```bash
pnpm bench -- --load-pattern connections
```

### Pipelining
Tests multiple pipelining levels: 1, 4, 8, 16.

```bash
pnpm bench -- --load-pattern pipelining
```

## Running

### Basic Usage

Install deps (from the repo root):

```bash
pnpm install
```

Run all benchmarks:

```bash
pnpm bench
```

### Filtering Scenarios

Run specific scenarios:

```bash
pnpm bench -- --scenario small-json-zod,large-cbor-zod
```

Filter by format:

```bash
pnpm bench -- --format json
pnpm bench -- --format cbor
```

Filter by validation library:

```bash
pnpm bench -- --validation zod
pnpm bench -- --validation valibot,arktype
```

Filter by framework:

```bash
pnpm bench -- --framework duck
pnpm bench -- --framework trpc
```

### Custom Load Settings

```bash
pnpm bench -- --connections 128 --duration 30 --pipelining 4 --warmup 5
```

### Save Results

```bash
pnpm bench -- --output benchmarks/results.json
```

### Combined Example

```bash
# Test CBOR with sustained load, 128 connections, save results
pnpm bench -- --format cbor --load-pattern sustained --connections 128 --output results.json
```

## Environment Variables

- `BENCH_CONNECTIONS` (default: 64) - Number of concurrent connections
- `BENCH_DURATION` (default: 20) - Test duration in seconds
- `BENCH_PIPELINING` (default: 1) - HTTP pipelining level
- `BENCH_WARMUP` (default: 5) - Warmup duration in seconds
- `BENCH_LOAD_PATTERN` (default: sustained) - Load pattern name
- `DUCK_PORT` (default: 4001) - Duck RPC server port
- `TRPC_PORT` (default: 4002) - tRPC server port

## Output

### Console Output

The benchmark prints:
1. **Per-scenario tables** with key metrics
2. **Comprehensive summary** with:
   - Speedup ratios (Duck vs tRPC)
   - Best/worst performance cases
   - Memory efficiency comparisons
   - Percentage improvements

### JSON Output

When using `--output`, results include:
- All autocannon metrics
- All server metrics (CPU, memory, GC, event loop)
- Response size statistics
- Load pattern and configuration details

## Key Features

### Duck RPC Advantages

1. **CBOR Support**: More efficient binary serialization
2. **Multiple Validators**: Zod, Valibot, Arktype, TypeBox support
3. **Flexible Validation**: Optional validation for performance-critical paths
4. **Response Size Tracking**: Automatic comparison of JSON vs CBOR sizes

### Comparison Metrics

The benchmark automatically calculates:
- **Speedup ratios**: How much faster Duck is vs tRPC
- **Memory efficiency**: Requests per MB of memory
- **Latency percentiles**: Detailed latency distribution
- **GC impact**: Heap fragmentation and GC statistics

## Notes

- The tRPC server is configured with `allowMethodOverride: true` so POST is allowed for queries.
- Each framework runs in its own process; CPU/memory and event loop metrics are collected per server process.
- CBOR scenarios only run for Duck RPC (tRPC doesn't support CBOR).
- Custom validation libraries (Valibot, Arktype, TypeBox) only run for Duck RPC.
- Error handling scenarios test invalid input performance.
- Results are averaged across multiple connection/pipelining configurations when using load patterns.
