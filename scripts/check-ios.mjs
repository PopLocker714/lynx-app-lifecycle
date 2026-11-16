import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { checkObjcFormat } from './native-tools.mjs'

checkObjcFormat()
execFileSync('bun', ['scripts/check-ios-store.mjs'], { stdio: 'inherit' })
const products = process.env.LYNX_FRAMEWORKS_DIR
if (!products || !existsSync(join(products, 'Lynx/Lynx.framework/Headers/LynxModule.h'))) {
    throw new Error(
        'Set LYNX_FRAMEWORKS_DIR to Debug-iphoneos products from the locked consumer build (CONTRIBUTING.md)'
    )
}
const frameworks = readdirSync(products, { withFileTypes: true })
    .filter(
        (entry) =>
            entry.isDirectory() &&
            readdirSync(join(products, entry.name)).some((name) => name.endsWith('.framework'))
    )
    .flatMap((entry) => ['-iframework', resolve(products, entry.name)])
const sdk = execFileSync('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path'], {
    encoding: 'utf8',
}).trim()
mkdirSync('artifacts/ios', { recursive: true })
for (const name of ['LynxAppLifecycleModule', 'LALAppStateStore']) {
    const args = [
        '-x',
        'objective-c',
        '-fobjc-arc',
        '-fmodules',
        '-arch',
        'arm64',
        '-isysroot',
        sdk,
        '-miphoneos-version-min=12.0',
        ...frameworks,
        '-Wall',
        '-Wextra',
        '-Werror',
        `ios/src/${name}.m`,
    ]
    execFileSync('xcrun', ['clang', ...args, '-c', '-o', `artifacts/ios/${name}.o`], {
        stdio: 'inherit',
    })
    execFileSync(
        'xcrun',
        [
            'clang',
            ...args,
            '--analyze',
            '-Xanalyzer',
            '-analyzer-werror',
            '-Xanalyzer',
            '-analyzer-output=plist',
            '-o',
            `artifacts/ios/${name}.plist`,
        ],
        { stdio: 'inherit' }
    )
}
console.log(
    `Standalone iOS compile/analysis passed against real frameworks at ${resolve(products)}; host linking/device QA are separate`
)
