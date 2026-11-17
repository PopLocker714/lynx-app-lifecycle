import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
    git,
    readJson,
    requireCleanSource,
    requireValue,
    validateAcceptance,
    validateManifest,
    validateMetadata,
    validatePrepareRun,
} from './artifact.mjs'

requireCleanSource()
const runId = process.env.PREPARE_RUN_ID
const repository = process.env.GITHUB_REPOSITORY
requireValue(/^\d+$/.test(runId ?? ''), 'Numeric prepare run ID required')
requireValue(repository === readJson('release/policy.json').repository, 'Repository mismatch')
requireValue(
    process.env.GITHUB_REF === 'refs/heads/main' &&
        process.env.GITHUB_EVENT_NAME === 'workflow_dispatch',
    'Verify only manual main release'
)
const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${runId}`, {
    headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
    },
})
requireValue(response.ok, `Cannot read prepare run: HTTP ${response.status}`)
const sourceCommit = validatePrepareRun(await response.json(), repository, runId)
execFileSync('git', ['merge-base', '--is-ancestor', sourceCommit, 'HEAD'])
const manifest = readJson('artifacts/release-candidate/manifest.json')
const metadata = JSON.parse(git('show', `${sourceCommit}:package.json`))
validateMetadata(metadata, git('show', `${sourceCommit}:CHANGELOG.md`))
const policyBytes = execFileSync('git', ['show', `${sourceCommit}:release/policy.json`])
const policy = JSON.parse(policyBytes.toString('utf8'))
// A later QA commit may add receipts/evidence only. A changed package or workflow
// requires a new prepare run, avoiding accidental release of stale package source.
const changed = git('diff', '--name-only', sourceCommit, 'HEAD').split('\n').filter(Boolean)
requireValue(
    changed.every((file) => file === 'release/qa.json' || file.startsWith('release/evidence/')),
    'Only QA receipt/evidence may change after candidate preparation'
)
validateManifest(manifest, 'artifacts/release-candidate/package.tgz', {
    sourceCommit,
    runId,
    repository,
    expectedHash: process.env.EXPECTED_SHA256,
    metadata,
    policyHash: createHash('sha256').update(policyBytes).digest('hex'),
})
validateAcceptance(readJson('release/qa.json'), manifest, policy, resolve('.'))
// All evidence must be tracked in the reviewed QA commit, not downloaded inputs.
for (const check of readJson('release/qa.json').checks) {
    for (const entry of check.evidence ?? [])
        execFileSync('git', ['ls-files', '--error-unmatch', entry.path])
}
requireValue(readFileSync('artifacts/release-candidate/package.tgz').length > 0, 'Empty archive')
console.log(
    `Verified ${manifest.name}@${manifest.version}, source ${sourceCommit}, SHA256 ${manifest.sha256}`
)
