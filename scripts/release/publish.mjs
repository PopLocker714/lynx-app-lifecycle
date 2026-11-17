import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { readJson, requireValue, sha256 } from './artifact.mjs'

// No local bypass flag. The manually dispatched publish job supplies OIDC;
// verify repeats the complete receipt and artifact gate.
requireValue(
    process.env.GITHUB_ACTIONS === 'true' &&
        process.env.ACTIONS_ID_TOKEN_REQUEST_URL &&
        process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    'Publication requires GitHub OIDC'
)
requireValue(
    process.env.NPM_TOKEN === undefined && process.env.NODE_AUTH_TOKEN === undefined,
    'Token authentication is not accepted'
)
execFileSync('bun', ['scripts/release/verify.mjs'], { stdio: 'inherit' })
const manifest = readJson('artifacts/release-candidate/manifest.json')
const archive = resolve('artifacts/release-candidate/package.tgz')
const release = createRequire(import.meta.resolve('semantic-release'))
const plugin = createRequire(release.resolve('@semantic-release/npm'))
const npmRoot = dirname(plugin.resolve('npm/package.json'))
requireValue(
    readJson(resolve(npmRoot, 'package.json')).version === '11.21.2',
    'Pinned npm publisher required'
)
requireValue(sha256(archive) === manifest.sha256, 'Archive changed before publish')
execFileSync(
    'node',
    [
        resolve(npmRoot, 'bin/npm-cli.js'),
        'publish',
        archive,
        '--ignore-scripts',
        '--access',
        'public',
        '--tag',
        'latest',
        '--registry',
        'https://registry.npmjs.org/',
        '--provenance',
    ],
    {
        stdio: 'inherit',
        env: { ...process.env, NPM_CONFIG_PROVENANCE: 'true' },
    }
)
requireValue(sha256(archive) === manifest.sha256, 'Archive changed during publish')
