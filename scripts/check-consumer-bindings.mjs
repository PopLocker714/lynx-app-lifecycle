import { mkdirSync, writeFileSync } from 'node:fs'

import { verifyNativeBindings } from './consumer/bindings.mjs'

const { CONSUMER_ROOT: host, CONSUMER_TARBALL: tarball } = process.env
if (!host || !tarball)
    throw new Error('Set CONSUMER_ROOT and CONSUMER_TARBALL; see CONTRIBUTING.md')
const bindings = verifyNativeBindings(host, tarball)
mkdirSync('artifacts', { recursive: true })
writeFileSync(
    'artifacts/consumer-bindings.json',
    `${JSON.stringify({ status: 'binding-only', bindings, date: new Date().toISOString() }, null, 4)}\n`
)
console.log('Native source bindings verified. This is neither a compile nor a device QA result.')
