import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hashFile, verifyConsumerPackage, verifyConsumerProfile } from '../consumer-package.mjs'

const scripts = dirname(fileURLToPath(import.meta.url))
const packageName = '@lynx-lab/app-lifecycle'
const pod = 'LynxAppLifecycle'
const moduleName = 'LynxAppLifecycleModule'
const namespace = 'dev.lynxlab.lifecycle'
const kotlinFiles = [
    'LynxAppLifecycleModule.kt',
    'ActivityStateTracker.kt',
    'AppLifecycleStore.kt',
    'AppLifecycleInitProvider.kt',
]
const variants = ['Debug', 'Release']

function requireBinding(condition, message) {
    if (!condition) throw new Error(`Consumer source binding: ${message}`)
}

function samePaths(actual, expected, message) {
    requireBinding(
        JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()),
        message
    )
}

function fileEvidence(paths) {
    return paths.map((path) => ({ path, sha256: hashFile(path) }))
}

function compactSource(path) {
    return readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\s+/g, '')
}

export function validateAndroidBinding(host, installed, model) {
    const directory = join(installed, 'android')
    const selected = model.projects.filter((project) => project.directory === directory)
    requireBinding(selected.length === 1, 'Gradle projectDir differs from installed tarball')
    const project = selected[0]
    const sources = kotlinFiles.map((file) =>
        join(directory, 'src/main/java', namespace.replaceAll('.', '/'), file)
    )
    const registries = []
    for (const variant of variants) {
        samePaths(project.sources[variant], sources, `${variant} Kotlin compiler sources differ`)
        requireBinding(
            model.variants[variant].projects.includes(project.path),
            `${variant} app runtime does not link package project`
        )
        const registry = join(
            host,
            'android/app/build/generated/source/lynxLibraryRegistry',
            variant.toLowerCase(),
            'com/lynx/tasm/library/LynxAutolinkGenerated.java'
        )
        samePaths(
            model.variants[variant].registry,
            [registry],
            `${variant} registry compiler input`
        )
        const code = compactSource(registry)
        requireBinding(
            code.includes(`"${namespace}.LynxLibraryProviderImpl"`) &&
                code.includes('LynxLibraryRegistry.setupGlobal(context,PROVIDERS);') &&
                code.includes('LynxLibraryRegistry.setup(builder,PROVIDERS);'),
            `${variant} compiled registry does not register ${packageName}`
        )
        registries.push(registry)
    }
    return { project: project.path, directory, files: fileEvidence([...sources, ...registries]) }
}

export function validateIOSBinding(host, installed, model) {
    requireBinding(Array.isArray(model.sourceConfigurations), 'Missing source configuration inputs')
    const directory = join(installed, 'ios')
    requireBinding(model.podPath === directory, 'Podfile.lock points outside installed tarball')
    const support = join(host, 'ios/Pods/Target Support Files', pod)
    const source = join(directory, 'src', `${moduleName}.m`)
    const header = join(directory, 'src', `${moduleName}.h`)
    const storeSource = join(directory, 'src/LALAppStateStore.m')
    const storeHeader = join(directory, 'src/LALAppStateStore.h')
    samePaths(
        model.sources,
        [source, storeSource, join(support, `${pod}-dummy.m`)],
        'Pod source build phase differs from installed tarball'
    )
    samePaths(
        model.headers,
        [header, storeHeader, join(support, `${pod}-umbrella.h`)],
        'Pod header build phase differs from installed tarball'
    )
    const registry = join(host, 'ios/generated/lynx-library/LynxGeneratedLibraryRegistry.m')
    samePaths(
        model.registry,
        [
            registry,
            join(
                host,
                'ios/Pods/Target Support Files/LynxLibraryRegistry/LynxLibraryRegistry-dummy.m'
            ),
        ],
        'Registry source build phase differs'
    )
    requireBinding(
        compactSource(registry).includes(
            `[configregisterModule:NSClassFromString(@"${moduleName}")withName:@"${moduleName}"];`
        ),
        'Compiled iOS registry does not register package module'
    )
    const projectFiles = [
        `${model.project}/project.pbxproj`,
        join(host, 'ios/Pods/Pods.xcodeproj/project.pbxproj'),
        join(host, 'ios/Pods/LynxLibraryRegistry.xcodeproj/project.pbxproj'),
        join(host, 'ios/SparklingGo.xcodeproj/project.pbxproj'),
        join(host, 'ios/Podfile.lock'),
        ...Object.values(model.linkedTargets).flatMap(Object.values),
        ...model.sourceConfigurations,
    ]
    return {
        directory,
        files: fileEvidence([source, storeSource, header, storeHeader, registry, ...projectFiles]),
    }
}

// This adapter intentionally rejects other host layouts. It never edits the consumer.
export function verifyNativeBindings(hostPath, tarball, platforms = ['android', 'ios']) {
    const host = realpathSync(hostPath)
    const jsProfile = verifyConsumerProfile(host)
    const sha256 = verifyConsumerPackage(host, tarball)
    const installed = realpathSync(join(host, 'node_modules', packageName))
    const temporary = mkdtempSync(join(tmpdir(), 'lynx-native-bindings-'))
    const evidence = { profile: 'sparkling-2.1.0-rc.36-lynx-3.9.0', jsProfile, sha256 }
    try {
        if (platforms.includes('android')) {
            const output = join(temporary, 'android.json')
            execFileSync(
                join(host, 'android/gradlew'),
                [
                    '-p',
                    join(host, 'android'),
                    '-I',
                    resolve(scripts, 'inspect-android.gradle'),
                    '--no-daemon',
                    '--max-workers=4',
                    'lynxConsumerBindings',
                ],
                {
                    cwd: host,
                    stdio: 'inherit',
                    env: { ...process.env, LYNX_BINDING_OUTPUT: output },
                }
            )
            evidence.android = validateAndroidBinding(
                host,
                installed,
                JSON.parse(readFileSync(output))
            )
        }
        if (platforms.includes('ios')) {
            execFileSync('bundle', ['exec', 'ruby', join(scripts, 'source-filters.test.rb')], {
                cwd: join(host, 'ios'),
                stdio: 'inherit',
            })
            const output = execFileSync(
                'bundle',
                ['exec', 'ruby', join(scripts, 'inspect-ios.rb'), pod],
                { cwd: join(host, 'ios'), encoding: 'utf8' }
            )
            evidence.ios = validateIOSBinding(host, installed, JSON.parse(output))
        }
        return evidence
    } finally {
        rmSync(temporary, { recursive: true, force: true })
    }
}

export function assertBindingFilesUnchanged(evidence) {
    for (const platform of ['android', 'ios']) {
        for (const file of evidence[platform]?.files ?? []) {
            requireBinding(hashFile(file.path) === file.sha256, `Build input changed: ${file.path}`)
        }
    }
}
