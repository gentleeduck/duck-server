/**
 * Vitest setup file.
 *
 * Configures test environment and global test utilities.
 */

import { afterEach, beforeEach, vi } from 'vitest'

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

// Reset modules if needed
beforeEach(() => {
  // Add any setup needed before each test
})
