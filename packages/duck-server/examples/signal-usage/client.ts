import { createRPCClient } from '../../src/client/'

type GreetingRes = { greeting: string }

async function main() {
  const client = createRPCClient({ baseUrl: 'http://localhost:3000' })
  const controller = new AbortController()

  const timer = setTimeout(() => controller.abort(), 50)

  try {
    const res = await client.query<GreetingRes>('greeting', { name: 'Sam' }, { signal: controller.signal })
    console.log(res)
  } catch (error) {
    console.error('request aborted:', error)
  } finally {
    clearTimeout(timer)
  }
}

main().catch((error) => {
  console.error('signal-usage client failed:', error)
  process.exitCode = 1
})
