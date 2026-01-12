import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const rootDir = resolve(fileURLToPath(new URL('.', import.meta.url)), 'src')

export default defineConfig({
  resolve: {
    alias: {
      '@duck-docs': rootDir,
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/__tests__/**',
        '**/tests/**',
        '**/examples/**',
        '**/benchmarks/**',
        '**/c_layer_for_cbor/**',
      ],
      include: ['src/**/*.ts'],
    },
    include: ['src/**/__tests__/**/*.test.ts', 'tests/**/*.test.ts', 'benchmarks/**/__tests__/**/*.test.ts'],
  },
})
