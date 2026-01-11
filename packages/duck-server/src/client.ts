import { pathToFileURL } from 'node:url'
import { createRPCProxyClient } from './client/'
import type { AppRouter } from './index'

export async function exampleClientCalls() {
  const client = createRPCProxyClient<AppRouter>({ baseUrl: 'http://localhost:3000', format: 'cbor' })

  const res = await client.upload.deleteBucket.mutation({
    bucketId: 'my-bucket-id',
    bucket: 'my-bucket-name',
  })

  console.log(res)
}

const isDirectRun = () =>
  typeof process !== 'undefined' &&
  typeof process.argv?.[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun()) {
  exampleClientCalls().catch((error) => {
    console.error('Client example failed:', error)
    process.exitCode = 1
  })
}
