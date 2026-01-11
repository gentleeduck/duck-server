import { createRPCProxyClient } from '../../src/client'
import type { AppRouter } from './server'

async function main() {
  const client = createRPCProxyClient<AppRouter>({
    baseUrl: 'http://localhost:3000',
    format: 'cbor',
    headers: { 'x-user-id': 'user-1' },
  })

  const profile = await client.user.getProfile.query(undefined)
  console.log('profile:', profile)

  const post = await client.post.create.mutation({ title: 'Hello from the client' })
  console.log('post:', post)
}

main().catch((error) => {
  console.error('advanced-usage client failed:', error)
  process.exitCode = 1
})
