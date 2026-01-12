# Benchmark Enhancement Plan

## Overview

This plan outlines enhancements to make the benchmark suite more comprehensive and realistic, testing real-world scenarios including middleware, authentication, error handling, and advanced features.

## Current State Analysis

From the initial benchmark results:
- **Duck RPC advantages**: 1.13x - 2.01x faster in most scenarios
- **tRPC issues**: High error rates in "novalidate" scenarios (77k+ errors)
- **CBOR benefits**: ~8% smaller response sizes, similar performance
- **Memory efficiency**: Duck is 2.36x more efficient (26k vs 11k req/MB)

## Enhancement Categories

### 1. Middleware Testing

#### 1.1 Authentication Middleware
**Purpose**: Test performance impact of authentication checks

**Scenarios**:
- `auth-jwt`: JWT token validation on every request
- `auth-bearer`: Bearer token extraction and validation
- `auth-api-key`: API key validation from headers
- `auth-session`: Session-based authentication
- `auth-multi`: Multiple auth checks (JWT + API key)

**Implementation**:
```typescript
// Add to duck-server.ts and trpc-server.ts
const authProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const token = ctx.req.headers.get('authorization')
  if (!token || !validateToken(token)) {
    throw new Error('Unauthorized')
  }
  return next({ ctx: { ...ctx, user: decodeToken(token) } })
})
```

**Metrics to track**:
- Overhead per request (latency delta)
- CPU cost of token validation
- Memory impact of auth state

#### 1.2 Logging Middleware
**Purpose**: Test impact of request/response logging

**Scenarios**:
- `logging-basic`: Simple console.log per request
- `logging-structured`: Structured JSON logging
- `logging-async`: Async logging (fire-and-forget)
- `logging-buffered`: Buffered batch logging

**Implementation**:
```typescript
const loggingProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const start = Date.now()
  const result = await next()
  logger.info({ 
    path: ctx.req.url, 
    duration: Date.now() - start,
    status: result.ok ? 'ok' : 'error'
  })
  return result
})
```

#### 1.3 Rate Limiting Middleware
**Purpose**: Test performance with rate limiting checks

**Scenarios**:
- `ratelimit-memory`: In-memory rate limiting
- `ratelimit-redis`: Redis-based rate limiting (if available)
- `ratelimit-sliding`: Sliding window rate limiting

#### 1.4 Request ID & Tracing Middleware
**Purpose**: Test overhead of request tracking

**Scenarios**:
- `tracing-basic`: Generate request ID
- `tracing-full`: Full distributed tracing (OpenTelemetry-style)

#### 1.5 Middleware Chains
**Purpose**: Test cumulative impact of multiple middleware

**Scenarios**:
- `chain-2`: Auth + Logging
- `chain-3`: Auth + Logging + Rate Limit
- `chain-5`: Auth + Logging + Rate Limit + Tracing + Validation

### 2. Authentication Scenarios

#### 2.1 Token Validation Performance
**Scenarios**:
- `auth-jwt-verify`: JWT signature verification
- `auth-jwt-parse`: JWT parsing without verification (fast path)
- `auth-jwt-cached`: Cached JWT validation results

#### 2.2 Protected Procedures
**Scenarios**:
- `protected-zod`: Protected procedure with Zod validation
- `protected-cbor`: Protected procedure with CBOR
- `protected-novalidate`: Protected procedure without validation

#### 2.3 Role-Based Access Control (RBAC)
**Scenarios**:
- `rbac-simple`: Single role check
- `rbac-multi`: Multiple role checks
- `rbac-nested`: Nested permission checks

### 3. Error Handling & Edge Cases

#### 3.1 Validation Error Performance
**Scenarios**:
- `error-invalid-input`: Invalid input (should fail fast)
- `error-missing-field`: Missing required fields
- `error-type-mismatch`: Type validation errors
- `error-nested`: Nested object validation errors

**Metrics**:
- Error response time vs success response time
- Error serialization overhead
- Error message size impact

#### 3.2 Exception Handling
**Scenarios**:
- `error-thrown`: Thrown exceptions in handlers
- `error-async`: Async errors
- `error-timeout`: Request timeout handling
- `error-oom`: Simulated out-of-memory scenarios

#### 3.3 Error Recovery
**Scenarios**:
- `error-retry`: Automatic retry logic
- `error-fallback`: Fallback response handling

### 4. Advanced Features

#### 4.1 Batch Requests
**Purpose**: Test batch request handling (if supported)

**Scenarios**:
- `batch-small`: 10 requests in batch
- `batch-medium`: 50 requests in batch
- `batch-large`: 100 requests in batch

**Implementation**:
```typescript
// POST /rpc/batch
{
  "requests": [
    { "type": "query", "path": "heavy", "input": {...} },
    { "type": "query", "path": "heavy", "input": {...} },
    ...
  ]
}
```

#### 4.2 Concurrent Procedure Calls
**Scenarios**:
- `concurrent-2`: 2 concurrent procedures
- `concurrent-5`: 5 concurrent procedures
- `concurrent-10`: 10 concurrent procedures

#### 4.3 Streaming Responses
**Scenarios**:
- `stream-small`: Small streaming response
- `stream-large`: Large streaming response
- `stream-chunked`: Chunked transfer encoding

### 5. Real-World Workloads

#### 5.1 Mixed Workload
**Purpose**: Simulate realistic API usage patterns

**Scenarios**:
- `mixed-read-heavy`: 80% reads, 20% writes
- `mixed-balanced`: 50% reads, 50% writes
- `mixed-write-heavy`: 20% reads, 80% writes

#### 5.2 Database Integration
**Scenarios**:
- `db-simple`: Single database query
- `db-join`: Complex join query
- `db-transaction`: Transaction handling
- `db-connection-pool`: Connection pool stress test

**Note**: Requires test database setup

#### 5.3 External API Calls
**Scenarios**:
- `external-sync`: Synchronous external API call
- `external-async`: Async external API call
- `external-parallel`: Parallel external calls

### 6. Performance Stress Tests

#### 6.1 Memory Leak Detection
**Purpose**: Long-running tests to detect memory leaks

**Scenarios**:
- `leak-test-5min`: 5-minute sustained load
- `leak-test-15min`: 15-minute sustained load
- `leak-test-30min`: 30-minute sustained load

**Metrics**:
- Memory growth over time
- GC frequency and duration
- Heap fragmentation trends

#### 6.2 Connection Pool Exhaustion
**Scenarios**:
- `connections-256`: 256 concurrent connections
- `connections-512`: 512 concurrent connections
- `connections-1024`: 1024 concurrent connections

#### 6.3 Payload Stress Tests
**Scenarios**:
- `payload-1mb`: 1 MB payload
- `payload-5mb`: 5 MB payload
- `payload-10mb`: 10 MB payload

### 7. Network Condition Simulation

#### 7.1 Latency Simulation
**Scenarios**:
- `latency-10ms`: 10ms artificial latency
- `latency-50ms`: 50ms artificial latency
- `latency-100ms`: 100ms artificial latency

#### 7.2 Bandwidth Limitation
**Scenarios**:
- `bandwidth-1mbps`: 1 Mbps limit
- `bandwidth-10mbps`: 10 Mbps limit

#### 7.3 Packet Loss
**Scenarios**:
- `packetloss-1%`: 1% packet loss
- `packetloss-5%`: 5% packet loss

### 8. Comparison Enhancements

#### 8.1 Feature Parity Tests
**Purpose**: Ensure fair comparison

**Scenarios**:
- Same middleware stack for both frameworks
- Same validation library (Zod) for both
- Same error handling patterns

#### 8.2 Framework-Specific Features
**Purpose**: Test unique features

**Duck RPC**:
- CBOR serialization
- Multiple validation libraries
- Optional validation

**tRPC**:
- Subscriptions (if applicable)
- Batching (if applicable)
- Custom transformers

### 9. Reporting Enhancements

#### 9.1 Visualizations
- **Charts**: Throughput over time, latency distributions
- **Heatmaps**: Performance by payload size × validation
- **Comparison graphs**: Side-by-side framework comparison

#### 9.2 Statistical Analysis
- **Confidence intervals**: 95% CI for all metrics
- **Outlier detection**: Identify and report anomalies
- **Trend analysis**: Performance trends across scenarios

#### 9.3 Export Formats
- **CSV**: For spreadsheet analysis
- **JSON**: For programmatic analysis
- **HTML Report**: Interactive web report
- **Markdown**: For documentation

#### 9.4 Performance Regression Detection
- Compare against baseline results
- Alert on significant performance degradation
- Track performance over time (if running in CI)

### 10. CI/CD Integration

#### 10.1 Automated Benchmarking
- Run benchmarks on every PR
- Compare against main branch
- Fail PR if performance degrades >10%

#### 10.2 Performance Budgets
- Set performance budgets per scenario
- Alert when budgets are exceeded
- Track budget compliance over time

#### 10.3 Benchmark History
- Store historical results
- Generate performance trend reports
- Identify performance regressions

## Implementation Priority

### Phase 1: Core Enhancements (High Priority)
1. ✅ Basic benchmarks (completed)
2. 🔄 Middleware testing (auth, logging)
3. 🔄 Error handling scenarios
4. 🔄 Enhanced reporting

### Phase 2: Advanced Features (Medium Priority)
5. Batch request testing
6. Real-world workloads
7. Network condition simulation
8. Memory leak detection

### Phase 3: Polish & Automation (Lower Priority)
9. CI/CD integration
10. Visualizations
11. Performance regression detection
12. Historical tracking

## New Files to Create

### Server Enhancements
- `benchmarks/middleware.ts`: Reusable middleware for benchmarks
- `benchmarks/auth.ts`: Authentication helpers
- `benchmarks/duck-server-enhanced.ts`: Enhanced Duck server with middleware
- `benchmarks/trpc-server-enhanced.ts`: Enhanced tRPC server with middleware

### Test Scenarios
- `benchmarks/scenarios.ts`: Scenario definitions
- `benchmarks/workloads.ts`: Real-world workload generators

### Reporting
- `benchmarks/report.ts`: Enhanced reporting functions
- `benchmarks/visualize.ts`: Chart generation
- `benchmarks/analyze.ts`: Statistical analysis

### Utilities
- `benchmarks/utils.ts`: Shared utilities
- `benchmarks/fixtures.ts`: Test data fixtures

## Metrics to Add

### Middleware Metrics
- `middlewareOverheadMs`: Time spent in middleware
- `authLatencyMs`: Authentication check latency
- `middlewareCount`: Number of middleware layers

### Error Metrics
- `errorRate`: Percentage of requests that error
- `errorLatencyMs`: Average latency for error responses
- `errorSizeBytes`: Average error response size

### Advanced Metrics
- `p99_9LatencyMs`: 99.9th percentile latency
- `p99_99LatencyMs`: 99.99th percentile latency
- `throughputVariance`: Variance in throughput
- `memoryLeakRate`: Memory growth rate (MB/s)

## Example Enhanced Scenario

```typescript
{
  name: 'small-json-zod-auth-logging',
  path: 'heavy',
  payload: smallPayload,
  format: 'json',
  validation: 'zod',
  middleware: ['auth', 'logging'],
  headers: {
    'authorization': 'Bearer test-token',
    'content-type': 'application/json'
  }
}
```

## Success Criteria

1. **Coverage**: Test all major use cases (auth, middleware, errors)
2. **Accuracy**: Results within 5% variance across runs
3. **Completeness**: Compare all framework features fairly
4. **Actionability**: Results provide clear optimization insights
5. **Maintainability**: Easy to add new scenarios

## Timeline Estimate

- **Phase 1**: 2-3 days
- **Phase 2**: 3-4 days
- **Phase 3**: 2-3 days
- **Total**: ~1-2 weeks for full implementation

## Notes

- Ensure middleware implementations are equivalent between frameworks
- Use realistic authentication tokens (not just strings)
- Consider using test databases for DB scenarios
- Mock external APIs to avoid network dependencies
- Run benchmarks on dedicated hardware for consistency
- Warm up JIT before each test run
- Run multiple iterations and average results

