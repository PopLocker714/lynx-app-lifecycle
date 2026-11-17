import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
    git,
    readJson,
    requireCleanSource,
    requireValue,
    sha256,
    validateMetadata,
} from './artifact.mjs'

requireCleanSource()
requireValue(
    process.env.RELEASE_TARBALL === undefined,
    'Prepare must pack source; RELEASE_TARBALL is inspection-only'
)
const metadata = readJson('package.json')
validateMetadata(metadata, readFileSync('CHANGELOG.md', 'utf8'))
const sourceCommit = git('rev-parse', 'HEAD')
requireValue(
    process.env.GITHUB_SHA === sourceCommit &&
        process.env.GITHUB_REF === 'refs/heads/main' &&
        process.env.GITHUB_EVENT_NAME === 'workflow_dispatch',
    'Prepare runs only from committed main in GitHub Actions'
)
requireValue(/^\d+$/.test(process.env.GITHUB_RUN_ID ?? ''), 'GitHub run ID required')
requireValue(
    process.env.GITHUB_REPOSITORY === readJson('release/policy.json').repository,
    'Repository mismatch'
)
// The checker packs once, inspects those bytes, and records their digest.
execFileSync('bun', ['run', 'check:package'], { stdio: 'inherit' })
requireCleanSource()
const evidence = readJson('artifacts/package-evidence.json')
requireValue(
    evidence.sourceCommit === sourceCommit && evidence.dirty === false && evidence.mode === 'pack',
    'Package check did not use clean source'
)
requireValue(sha256(evidence.tarball) === evidence.sha256, 'Package changed after inspection')
const directory = resolve('artifacts/release-candidate')
mkdirSync(directory, { recursive: true })
copyFileSync(evidence.tarball, resolve(directory, 'package.tgz'))
writeFileSync(
    resolve(directory, 'manifest.json'),
    `${JSON.stringify(
        {
            schemaVersion: 1,
            name: metadata.name,
            version: metadata.version,
            sourceCommit,
            sha256: evidence.sha256,
            policySha256: sha256('release/policy.json'),
            prepareRunId: process.env.GITHUB_RUN_ID,
            repository: process.env.GITHUB_REPOSITORY,
        },
        null,
        4
    )}\n`
)
console.log(`Candidate ${metadata.name}@${metadata.version}: ${evidence.sha256}`)
