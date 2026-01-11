import { config } from '@gentleduck/tsdown-config'
import { defineConfig } from 'tsdown'

export default defineConfig({
  ...config,
  alias: {
    '~/rpc': './src',
  },
  entry: ['src/**/*.{ts,tsx}', '!src/**/__test__/**'],
  plugins: [],
})
