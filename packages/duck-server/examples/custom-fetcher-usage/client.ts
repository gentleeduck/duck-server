import { createRPCClient } from '../../src/client'

type GreetingRes = { greeting: string }

const loggingFetch: typeof fetch = async (input, init) => {
  console.log('RPC request:', input)
  return fetch(input, init)
}

async function main() {
  const client = createRPCClient({
    baseUrl: 'http://localhost:3000',
    fetch: loggingFetch,
  })

  const res = await client.query<GreetingRes>('greeting', { name: 'Ada' })
  console.log(res)
}

main().catch((error) => {
  console.error('custom-fetcher client failed:', error)
  process.exitCode = 1
})
