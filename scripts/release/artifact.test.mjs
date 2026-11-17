import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
    sha256,
    validateAcceptance,
    validateManifest,
    validateMetadata,
    validatePrepareRun,
} from './artifact.mjs'

let root
let archive
let manifest
let receipt
const repository = 'PopLocker714/lynx-crypto'
const sourceCommit = 'a'.repeat(40)
const metadata = { name: '@lynx-lab/crypto', version: '1.2.3' }
const policy = { schemaVersion: 1, requiredChecks: ['android-release-r8', 'ios-release'] }
const policyHash = 'b'.repeat(64)

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'lynx-release-test-'))
    mkdirSync(join(root, 'package'))
    writeFileSync(join(root, 'package/package.json'), JSON.stringify(metadata))
    archive = join(root, 'package.tgz')
    execFileSync('tar', ['-czf', archive, '-C', root, 'package'])
    mkdirSync(join(root, 'release/evidence'), { recursive: true })
    writeFileSync(
        join(root, 'release/evidence/run.txt'),
        'Synthetic unit-test fixture; never release evidence'
    )
    manifest = {
        schemaVersion: 1,
        ...metadata,
        sourceCommit,
        sha256: sha256(archive),
        policySha256: policyHash,
        prepareRunId: '123',
        repository,
    }
    receipt = {
        schemaVersion: 1,
        ...metadata,
        sourceCommit,
        sha256: manifest.sha256,
        prepareRunId: '123',
        acceptedBy: 'unit-test fixture',
        acceptedAt: '2026-11-17T00:00:00Z',
        gaps: [],
        checks: policy.requiredChecks.map((id) => ({
            id,
            status: 'pass',
            profile: 'synthetic test profile',
            evidence: [
                {
                    path: 'release/evidence/run.txt',
                    sha256: sha256(join(root, 'release/evidence/run.txt')),
                },
            ],
        })),
    }
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

function validateCandidate() {
    validateManifest(manifest, archive, {
        sourceCommit,
        runId: '123',
        repository,
        expectedHash: manifest.sha256,
        metadata,
        policyHash,
    })
}

function validateQA() {
    validateAcceptance(receipt, manifest, policy, root)
}

describe('immutable candidate and reviewed QA', () => {
    test('accepts the exact archive and complete bound QA receipt', () => {
        validateMetadata(metadata, '## [1.2.3] release notes')
        validateCandidate()
        validateQA()
    })
    test.each(['0.0.0-development', '1.2.3-beta.1', '01.2.3', '1.2'])(
        'rejects unfinished/nonstable version %s',
        (version) => {
            expect(() => validateMetadata({ ...metadata, version }, '# 1.2.3')).toThrow()
        }
    )
    test('rejects private package and missing final changelog', () => {
        expect(() => validateMetadata({ ...metadata, private: true }, '# 1.2.3')).toThrow('Private')
        expect(() => validateMetadata(metadata, '# 1.2.30')).toThrow('CHANGELOG')
    })
    test('rejects changed tarball bytes', () => {
        writeFileSync(archive, Buffer.concat([readFileSync(archive), Buffer.from('changed')]))
        expect(validateCandidate).toThrow('hash')
    })
    test.each(['sourceCommit', 'prepareRunId', 'repository', 'name', 'version', 'policySha256'])(
        'rejects manifest %s mismatch',
        (field) => {
            manifest[field] = 'wrong'
            expect(validateCandidate).toThrow()
        }
    )
    test('rejects archive metadata even with updated hash', () => {
        writeFileSync(
            join(root, 'package/package.json'),
            JSON.stringify({ ...metadata, private: true })
        )
        execFileSync('tar', ['-czf', archive, '-C', root, 'package'])
        manifest.sha256 = sha256(archive)
        expect(validateCandidate).toThrow('metadata')
    })
    test.each(['sourceCommit', 'prepareRunId', 'sha256', 'version', 'name'])(
        'rejects stale QA %s',
        (field) => {
            receipt[field] = 'old'
            expect(validateQA).toThrow('mismatch')
        }
    )
    test('rejects missing, failed, duplicate and unresolved checks', () => {
        receipt.checks.pop()
        expect(validateQA).toThrow('must pass')
        receipt.checks.push({ ...receipt.checks[0], id: 'ios-release', status: 'blocked' })
        expect(validateQA).toThrow('must pass')
        receipt.checks[1].status = 'pass'
        receipt.gaps.push('rotation unverified')
        expect(validateQA).toThrow('gaps')
        receipt.gaps = []
        receipt.checks.push(receipt.checks[0])
        expect(validateQA).toThrow('Duplicate')
    })
    test('requires accountable reviewer/profile and actual unchanged evidence', () => {
        receipt.acceptedBy = ''
        expect(validateQA).toThrow('responsible')
        receipt.acceptedBy = 'fixture'
        receipt.checks[0].profile = ''
        expect(validateQA).toThrow('profile')
        receipt.checks[0].profile = 'fixture'
        writeFileSync(join(root, 'release/evidence/run.txt'), 'mutated')
        expect(validateQA).toThrow('hash')
    })
    test('rejects empty and escaping evidence', () => {
        receipt.checks[0].evidence = []
        expect(validateQA).toThrow('evidence')
        receipt.checks[0].evidence = [{ path: '/etc/hosts', sha256: 'c'.repeat(64) }]
        expect(validateQA).toThrow('relative')
        symlinkSync('/etc/hosts', join(root, 'release/evidence/link'))
        receipt.checks[0].evidence[0].path = 'release/evidence/link'
        expect(validateQA).toThrow('escapes')
    })
})

describe('prepare provenance', () => {
    const run = {
        id: 123,
        repository: { full_name: repository },
        head_repository: { full_name: repository },
        event: 'workflow_dispatch',
        path: '.github/workflows/release.yml',
        head_branch: 'main',
        status: 'completed',
        conclusion: 'success',
        head_sha: sourceCommit,
    }
    test('accepts only the identified successful manual main run', () => {
        expect(validatePrepareRun(run, repository, '123')).toBe(sourceCommit)
    })
    test.each(['id', 'event', 'path', 'head_branch', 'status', 'conclusion', 'head_sha'])(
        'rejects wrong %s',
        (field) => {
            expect(() =>
                validatePrepareRun({ ...run, [field]: 'wrong' }, repository, '123')
            ).toThrow()
        }
    )
    test('rejects cross-repository and fork artifacts', () => {
        expect(() =>
            validatePrepareRun(
                { ...run, repository: { full_name: 'another/repo' } },
                repository,
                '123'
            )
        ).toThrow()
        expect(() =>
            validatePrepareRun(
                { ...run, head_repository: { full_name: 'fork/repo' } },
                repository,
                '123'
            )
        ).toThrow()
    })
    test('rejects dirty source before preparing an archive', () => {
        const module = resolve('scripts/release/artifact.mjs')
        execFileSync('git', ['init', '-q', root])
        writeFileSync(join(root, 'dirty.txt'), 'uncommitted')
        const child = Bun.spawnSync(
            [
                'bun',
                '-e',
                `import { requireCleanSource } from ${JSON.stringify(module)}; requireCleanSource()`,
            ],
            { cwd: root }
        )
        expect(child.exitCode).not.toBe(0)
        expect(child.stderr.toString()).toContain('Commit all source')
    })
})

test('prepare → committed QA → verify entrypoints, without registry or GitHub writes', () => {
    const prepare = resolve('scripts/release/prepare.mjs')
    const verify = resolve('scripts/release/verify.mjs')
    const fixture = join(root, 'fixture')
    mkdirSync(join(fixture, 'scripts'), { recursive: true })
    mkdirSync(join(fixture, 'release'), { recursive: true })
    writeFileSync(join(fixture, '.gitignore'), 'artifacts/\n')
    writeFileSync(
        join(fixture, 'package.json'),
        JSON.stringify({ ...metadata, scripts: { 'check:package': 'bun scripts/check.mjs' } })
    )
    writeFileSync(join(fixture, 'CHANGELOG.md'), '# 1.2.3\n')
    writeFileSync(join(fixture, 'release/policy.json'), JSON.stringify({ ...policy, repository }))
    writeFileSync(
        join(fixture, 'scripts/check.mjs'),
        `
        import { execFileSync } from 'node:child_process';
        import { createHash } from 'node:crypto';
        import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
        mkdirSync('artifacts/package', {recursive:true});
        copyFileSync('package.json','artifacts/package/package.json');
        execFileSync('tar',['-czf','artifacts/package.tgz','-C','artifacts','package']);
        writeFileSync('artifacts/package-evidence.json',JSON.stringify({
            sourceCommit: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
            mode:'pack',dirty:false,tarball:'artifacts/package.tgz',
            sha256:createHash('sha256').update(readFileSync('artifacts/package.tgz')).digest('hex')
        }));
    `
    )
    const gitFixture = (...args) =>
        execFileSync('git', ['-C', fixture, ...args], { encoding: 'utf8' }).trim()
    gitFixture('init', '-q')
    gitFixture('add', '.')
    const commit = () =>
        gitFixture(
            '-c',
            'user.name=Fixture',
            '-c',
            'user.email=fixture@example.invalid',
            'commit',
            '-qm',
            'fixture'
        )
    commit()
    const sha = gitFixture('rev-parse', 'HEAD')
    const env = {
        ...process.env,
        GITHUB_SHA: sha,
        GITHUB_REF: 'refs/heads/main',
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_RUN_ID: '123',
        GITHUB_REPOSITORY: repository,
        RELEASE_TARBALL: undefined,
    }
    let child = Bun.spawnSync(['bun', prepare], { cwd: fixture, env })
    expect(child.stderr.toString()).not.toContain('error:')
    expect(child.exitCode).toBe(0)
    const candidate = JSON.parse(
        readFileSync(join(fixture, 'artifacts/release-candidate/manifest.json'), 'utf8')
    )
    expect(candidate.sourceCommit).toBe(sha)
    receipt = { ...receipt, sourceCommit: sha, sha256: candidate.sha256 }
    mkdirSync(join(fixture, 'release/evidence'), { recursive: true })
    writeFileSync(
        join(fixture, 'release/evidence/run.txt'),
        readFileSync(join(root, 'release/evidence/run.txt'))
    )
    writeFileSync(join(fixture, 'release/qa.json'), JSON.stringify(receipt))
    gitFixture('add', 'release')
    commit()
    const preload = join(root, 'github-stub.mjs')
    writeFileSync(
        preload,
        `globalThis.fetch = async () => ({ok:true,json:async () => (${JSON.stringify({ id: 123, repository: { full_name: repository }, head_repository: { full_name: repository }, event: 'workflow_dispatch', path: '.github/workflows/release.yml', head_branch: 'main', status: 'completed', conclusion: 'success', head_sha: sha })})});`
    )
    const verifyEnv = { ...env, PREPARE_RUN_ID: '123', EXPECTED_SHA256: candidate.sha256 }
    child = Bun.spawnSync(['bun', '--preload', preload, verify], { cwd: fixture, env: verifyEnv })
    expect(child.stderr.toString()).not.toContain('error:')
    expect(child.exitCode).toBe(0)
    child = Bun.spawnSync(['bun', prepare], {
        cwd: fixture,
        env: { ...env, RELEASE_TARBALL: archive },
    })
    expect(child.exitCode).not.toBe(0)
    expect(child.stderr.toString()).toContain('inspection-only')
    writeFileSync(join(fixture, 'CHANGELOG.md'), '# 1.2.3\nChanged package documentation\n')
    gitFixture('add', 'CHANGELOG.md')
    commit()
    child = Bun.spawnSync(['bun', '--preload', preload, verify], { cwd: fixture, env: verifyEnv })
    expect(child.exitCode).not.toBe(0)
    expect(child.stderr.toString()).toContain('Only QA receipt/evidence')
})
