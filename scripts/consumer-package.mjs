import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const hashFile = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

export function verifyConsumerPackage(host, tarball) {
    const temporary = mkdtempSync(join(tmpdir(), 'lynx-app-lifecycle-consumer-'))
    try {
        execFileSync('tar', ['-xzf', resolve(tarball), '-C', temporary])
        const files = execFileSync('tar', ['-tzf', resolve(tarball)], { encoding: 'utf8' })
            .trim()
            .split('\n')
        for (const file of files) {
            if (file.endsWith('/')) continue
            const relative = file.replace(/^package\//, '')
            const installed = join(host, 'node_modules/@lynx-lab/app-lifecycle', relative)
            if (!existsSync(installed) || hashFile(installed) !== hashFile(join(temporary, file))) {
                throw new Error(`Installed consumer package differs from tarball: ${relative}`)
            }
        }
        return hashFile(tarball)
    } finally {
        rmSync(temporary, { recursive: true, force: true })
    }
}

// This is a checked candidate profile, not the full public peer support range.
export function verifyConsumerProfile(host) {
    const versions = {}
    for (const [name, expected] of Object.entries({
        '@lynx-js/react': '0.125.0',
        '@lynx-js/types': '4.2.1',
    })) {
        const actual = JSON.parse(
            readFileSync(join(host, 'node_modules', name, 'package.json'), 'utf8')
        ).version
        if (actual !== expected) {
            throw new Error(
                `Unsupported consumer JS profile: ${name} ${actual}; expected ${expected}. Validate a separate profile before widening this gate.`
            )
        }
        versions[name] = actual
    }
    return versions
}
