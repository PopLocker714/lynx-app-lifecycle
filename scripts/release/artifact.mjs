import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export function requireValue(condition, message) {
    if (!condition) throw new Error(message)
}

export function sha256(file) {
    return createHash('sha256').update(readFileSync(file)).digest('hex')
}

export function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

export function readJson(file) {
    return JSON.parse(readFileSync(file, 'utf8'))
}

export function validateMetadata(metadata, changelog) {
    requireValue(metadata.private !== true, 'Private packages cannot be released')
    requireValue(/^@lynx-lab\/[a-z-]+$/.test(metadata.name), 'Unexpected package name')
    requireValue(
        /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(metadata.version),
        'Commit a final stable version before preparation'
    )
    const escaped = metadata.version.replaceAll('.', '\\.')
    requireValue(
        new RegExp(`^#{1,3} (?:\\[)?${escaped}(?:\\]| |$)`, 'm').test(changelog),
        'CHANGELOG.md must contain the final version heading'
    )
}

export function requireCleanSource() {
    requireValue(
        git('status', '--porcelain') === '',
        'Commit all source changes before preparation'
    )
}

export function validatePrepareRun(run, repository, runId) {
    requireValue(String(run.id) === String(runId), 'Prepare run ID mismatch')
    requireValue(
        run.repository?.full_name === repository && run.head_repository?.full_name === repository,
        'Prepare run repository mismatch'
    )
    requireValue(
        run.event === 'workflow_dispatch' && run.path === '.github/workflows/release.yml',
        'Prepare run must come from manual release.yml'
    )
    requireValue(
        run.head_branch === 'main' && run.status === 'completed' && run.conclusion === 'success',
        'Prepare run must successfully complete on main'
    )
    requireValue(/^[a-f0-9]{40}$/.test(run.head_sha), 'Invalid prepare source commit')
    return run.head_sha
}

export function validateManifest(
    manifest,
    archive,
    { sourceCommit, runId, repository, expectedHash, metadata, policyHash }
) {
    requireValue(manifest.schemaVersion === 1, 'Unsupported manifest version')
    requireValue(
        manifest.sourceCommit === sourceCommit && /^[a-f0-9]{40}$/.test(sourceCommit),
        'Candidate source mismatch'
    )
    requireValue(
        manifest.prepareRunId === String(runId) && manifest.repository === repository,
        'Candidate run/repository mismatch'
    )
    requireValue(
        manifest.name === metadata.name && manifest.version === metadata.version,
        'Candidate name/version mismatch'
    )
    requireValue(manifest.policySha256 === policyHash, 'Candidate policy mismatch')
    requireValue(
        /^[a-f0-9]{64}$/.test(expectedHash) &&
            manifest.sha256 === expectedHash &&
            sha256(archive) === expectedHash,
        'Candidate archive hash mismatch'
    )
    const archived = JSON.parse(
        execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' })
    )
    requireValue(
        archived.name === metadata.name &&
            archived.version === metadata.version &&
            archived.private !== true,
        'Archive metadata mismatch/private package'
    )
}

function evidenceFile(root, entry) {
    requireValue(
        entry && typeof entry.path === 'string' && !isAbsolute(entry.path),
        'Evidence must use relative paths'
    )
    requireValue(
        entry.path.startsWith('release/evidence/'),
        'Evidence must live under release/evidence'
    )
    const file = resolve(root, entry.path)
    const rel = relative(realpathSync(root), realpathSync(file))
    requireValue(
        rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel),
        'Evidence escapes checkout'
    )
    requireValue(
        lstatSync(file).isFile() && lstatSync(file).size > 0,
        'Evidence must be a nonempty regular file'
    )
    requireValue(
        /^[a-f0-9]{64}$/.test(entry.sha256) && sha256(file) === entry.sha256,
        'Evidence hash mismatch'
    )
}

export function validateAcceptance(receipt, manifest, policy, root) {
    requireValue(receipt.schemaVersion === 1, 'Unsupported QA receipt version')
    for (const key of ['name', 'version', 'sourceCommit', 'sha256', 'prepareRunId']) {
        requireValue(receipt[key] === manifest[key], `QA ${key} mismatch`)
    }
    requireValue(
        typeof receipt.acceptedBy === 'string' && receipt.acceptedBy.trim().length > 0,
        'QA responsible person required'
    )
    requireValue(
        typeof receipt.acceptedAt === 'string' && Number.isFinite(Date.parse(receipt.acceptedAt)),
        'QA acceptance date required'
    )
    requireValue(
        Array.isArray(receipt.gaps) && receipt.gaps.length === 0,
        'Unresolved QA gaps block publication'
    )
    requireValue(Array.isArray(receipt.checks), 'QA checks required')
    const ids = receipt.checks.map((check) => check.id)
    requireValue(new Set(ids).size === ids.length, 'Duplicate QA check')
    requireValue(
        policy.schemaVersion === 1 &&
            Array.isArray(policy.requiredChecks) &&
            policy.requiredChecks.length > 0,
        'Invalid release policy'
    )
    for (const id of policy.requiredChecks) {
        const check = receipt.checks.find((row) => row.id === id)
        requireValue(check?.status === 'pass', `QA check must pass: ${id}`)
        requireValue(
            typeof check.profile === 'string' && check.profile.trim().length > 0,
            `QA profile required: ${id}`
        )
        requireValue(
            Array.isArray(check.evidence) && check.evidence.length > 0,
            `QA evidence required: ${id}`
        )
        for (const entry of check.evidence) evidenceFile(root, entry)
    }
    for (const check of receipt.checks)
        requireValue(check.status === 'pass', 'Nonpassing extra QA check')
}
