/**
 * Tests for router functionality.
 *
 * Covers:
 * - Router creation
 * - Procedure lookup
 * - Nested routers
 * - Router indexing
 */

import { describe, expect, it } from 'vitest'
import { createProcedure } from '../procedure'
import { RPCRes as R } from '../response'
import { createRouter, getProcedureAtPath, getRouterIndex } from '../router'

describe('createRouter', () => {
  it('should create a router', () => {
    const proc = createProcedure().query(async () => R.ok({}, 'RPC_OK'))
    const router = createRouter({ hello: proc })

    expect(router._kind).toBe('router')
    expect(router._def.record).toHaveProperty('hello')
  })

  it('should find procedures by path', () => {
    const proc = createProcedure().query(async () => R.ok({}, 'RPC_OK'))
    const router = createRouter({ hello: proc })

    const found = getProcedureAtPath(router, ['hello'])
    expect(found).toBe(proc)
  })

  it('should handle nested routers', () => {
    const innerProc = createProcedure().query(async () => R.ok({}, 'RPC_OK'))
    const innerRouter = createRouter({ world: innerProc })
    const outerRouter = createRouter({ hello: innerRouter })

    const found = getProcedureAtPath(outerRouter, ['hello', 'world'])
    expect(found).toBe(innerProc)
  })

  it('should return null for non-existent paths', () => {
    const router = createRouter({})
    const found = getProcedureAtPath(router, ['nonexistent'])
    expect(found).toBeNull()
  })

  it('should cache router index', () => {
    const proc = createProcedure().query(async () => R.ok({}, 'RPC_OK'))
    const router = createRouter({ hello: proc })

    const index1 = getRouterIndex(router)
    const index2 = getRouterIndex(router)

    // Should return the same cached index
    expect(index1).toBe(index2)
    expect(index1.procs.has('hello')).toBe(true)
  })

  it('should handle deep nesting', () => {
    const deepProc = createProcedure().query(async () => R.ok({}, 'RPC_OK'))
    const level3 = createRouter({ deep: deepProc })
    const level2 = createRouter({ level3 })
    const level1 = createRouter({ level2 })

    const found = getProcedureAtPath(level1, ['level2', 'level3', 'deep'])
    expect(found).toBe(deepProc)
  })
})
