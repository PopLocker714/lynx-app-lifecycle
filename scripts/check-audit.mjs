import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

// Owner: Lynx Lab. Reassess by 2026-12-16 and before enabling publication.
if (new Date() >= new Date('2026-12-17T00:00:00Z')) {
    throw new Error(
        'Audit exceptions expired; reassess GHSA-3g3m-2fjr-6pw4 and GHSA-g3hv-75wg-m249'
    )
}
const auditedLock = 'a6ff0794034967b2b071c2fb4b08269973a05458074473b55281e47368be2891'
if (createHash('sha256').update(readFileSync('bun.lock')).digest('hex') !== auditedLock) {
    throw new Error('Dependency graph changed: reassess the two audit exceptions')
}
const release = createRequire(import.meta.resolve('semantic-release'))
const plugin = createRequire(release.resolve('@semantic-release/npm'))
const npmPath = plugin.resolve('npm/package.json')
if (JSON.parse(readFileSync(npmPath, 'utf8')).version !== '11.21.2') {
    throw new Error('Reassess the actual npm bundle')
}
const expected = {
    'brace-expansion': '5.0.12',
    glob: '13.0.6',
    minimatch: '10.2.5',
    'postcss-selector-parser': '7.1.6',
    undici: '6.29.1',
    'ip-address': '10.7.5',
}
for (const [name, version] of Object.entries(expected)) {
    const actual = JSON.parse(
        readFileSync(join(dirname(npmPath), 'node_modules', name, 'package.json'), 'utf8')
    )
    if (actual.version !== version) throw new Error(`Reassess bundled ${name}: ${actual.version}`)
}
const result = spawnSync(
    'bun',
    ['audit', '--ignore', 'GHSA-3g3m-2fjr-6pw4', '--ignore', 'GHSA-g3hv-75wg-m249'],
    { stdio: 'inherit' }
)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
