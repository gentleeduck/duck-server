import { createRPCProxyClient } from '../../src/client'
import type { AppRouter } from './server'

async function main() {
  const client = createRPCProxyClient<AppRouter>({ baseUrl: 'http://localhost:3000' })

  const res = await client.greeting.query({ : 'wildduck' })

  console.log(res)
}

main().catch((error) => {
  console.error('basic-usage client failed:', error)
  process.exitCode = 1
})
