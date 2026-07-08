import { existsSync, readFileSync } from 'node:fs'
import { allKinds } from '../dist/index.js'

const ROOT = new URL('../../..', import.meta.url)
const files = [
  new URL('packages/lingo/llms.txt', ROOT),
  new URL('apps/site/public/llms-small.txt', ROOT),
]
const expectedKinds = allKinds.map((kind) => kind.kind).join(' ')
let failed = false

for (const file of files) {
  if (!existsSync(file)) {
    console.error(`Docs sync check failed: missing ${relative(file)}`)
    failed = true
    continue
  }
  const text = readFileSync(file, 'utf8')
  const actualKinds = text.match(/^Kinds: ([^.]+)\./m)?.[1]
  if (actualKinds !== expectedKinds) {
    console.error(
      `Docs sync check failed: ${relative(file)} Kinds line is ${JSON.stringify(actualKinds)}, expected ${JSON.stringify(expectedKinds)}`,
    )
    failed = true
  }
}

if (failed) {
  process.exit(1)
}

console.log('Docs sync gate ok: llms.txt kind lists match allKinds.')

function relative(url) {
  return url.pathname.replace(ROOT.pathname, '')
}
