import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { verifyConsumerProfile } from '../consumer-package.mjs'

import {
    assertBindingFilesUnchanged,
    validateAndroidBinding,
    validateIOSBinding,
} from './bindings.mjs'

const temporary = []
afterEach(() => {
    for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true })
})

function fixture() {
    const host = realpathSync(mkdtempSync(join(tmpdir(), 'lynx-binding-test-')))
    temporary.push(host)
    const installed = join(host, 'node_modules/@lynx-lab/app-lifecycle')
    const write = (path, value = '') => {
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, value)
        return path
    }
    const sources = [
        'LynxAppLifecycleModule.kt',
        'ActivityStateTracker.kt',
        'AppLifecycleStore.kt',
        'AppLifecycleInitProvider.kt',
    ].map((name) =>
        write(join(installed, 'android/src/main/java/dev/lynxlab/lifecycle', name), name)
    )
    const project = {
        path: ':lynx_library__lynx_lab_app_lifecycle',
        directory: join(installed, 'android'),
        sources: { Debug: sources, Release: sources },
    }
    const android = { projects: [project], variants: {} }
    for (const variant of ['Debug', 'Release']) {
        android.variants[variant] = {
            projects: [project.path],
            registry: [
                write(
                    join(
                        host,
                        'android/app/build/generated/source/lynxLibraryRegistry',
                        variant.toLowerCase(),
                        'com/lynx/tasm/library/LynxAutolinkGenerated.java'
                    ),
                    '"dev.lynxlab.lifecycle.LynxLibraryProviderImpl"; ' +
                        'LynxLibraryRegistry.setupGlobal(context, PROVIDERS); ' +
                        'LynxLibraryRegistry.setup(builder, PROVIDERS);'
                ),
            ],
        }
    }
    const ios = {
        podPath: join(installed, 'ios'),
        project: join(host, 'ios/Pods/LynxAppLifecycle.xcodeproj'),
        sources: [
            write(join(installed, 'ios/src/LynxAppLifecycleModule.m')),
            write(join(installed, 'ios/src/LALAppStateStore.m')),
            write(
                join(
                    host,
                    'ios/Pods/Target Support Files/LynxAppLifecycle/LynxAppLifecycle-dummy.m'
                )
            ),
        ],
        headers: [
            write(join(installed, 'ios/src/LynxAppLifecycleModule.h')),
            write(join(installed, 'ios/src/LALAppStateStore.h')),
            write(
                join(
                    host,
                    'ios/Pods/Target Support Files/LynxAppLifecycle/LynxAppLifecycle-umbrella.h'
                )
            ),
        ],
        registry: [
            write(
                join(host, 'ios/generated/lynx-library/LynxGeneratedLibraryRegistry.m'),
                '[config registerModule:NSClassFromString(@"LynxAppLifecycleModule") withName:@"LynxAppLifecycleModule"];'
            ),
            write(
                join(
                    host,
                    'ios/Pods/Target Support Files/LynxLibraryRegistry/LynxLibraryRegistry-dummy.m'
                )
            ),
        ],
        linkedTargets: {},
        sourceConfigurations: [write(join(host, 'ios/Pods/Target Support Files/Source.xcconfig'))],
    }
    for (const path of [
        'ios/Pods/LynxAppLifecycle.xcodeproj/project.pbxproj',
        'ios/Pods/Pods.xcodeproj/project.pbxproj',
        'ios/Pods/LynxLibraryRegistry.xcodeproj/project.pbxproj',
        'ios/SparklingGo.xcodeproj/project.pbxproj',
        'ios/Podfile.lock',
    ])
        write(join(host, path))
    return { host, installed, android, ios, write }
}

test('binds compiler inputs and records hashes; changed inputs fail after build', () => {
    const f = fixture()
    const evidence = {
        android: validateAndroidBinding(f.host, f.installed, f.android),
        ios: validateIOSBinding(f.host, f.installed, f.ios),
    }
    expect(() => assertBindingFilesUnchanged(evidence)).not.toThrow()
    f.write(f.android.variants.Release.registry[0], 'stale')
    expect(() => assertBindingFilesUnchanged(evidence)).toThrow('Build input changed')
})

test('rejects a stale GlobalStore Gradle directory despite matching node_modules', () => {
    const f = fixture()
    f.android.projects[0].directory = '/old-global-store/android'
    expect(() => validateAndroidBinding(f.host, f.installed, f.android)).toThrow('projectDir')
})

test('detects changes to inspected iOS source configurations after build', () => {
    const f = fixture()
    const evidence = { ios: validateIOSBinding(f.host, f.installed, f.ios) }
    f.write(f.ios.sourceConfigurations[0], 'EXCLUDED_SOURCE_FILE_NAMES = Module.m')
    expect(() => assertBindingFilesUnchanged(evidence)).toThrow('Build input changed')
})

test('rejects package project absent from Release runtime graph', () => {
    const f = fixture()
    f.android.variants.Release.projects = []
    expect(() => validateAndroidBinding(f.host, f.installed, f.android)).toThrow('does not link')
})

test('rejects stale Kotlin source even with a correct projectDir', () => {
    const f = fixture()
    f.android.projects[0].sources.Release = ['/old/LynxAppLifecycleModule.kt']
    expect(() => validateAndroidBinding(f.host, f.installed, f.android)).toThrow('compiler sources')
})

test('rejects registry outside actual supported Java compiler input', () => {
    const f = fixture()
    f.android.variants.Debug.registry = ['/some/uncompiled/LynxAutolinkGenerated.java']
    expect(() => validateAndroidBinding(f.host, f.installed, f.android)).toThrow('compiler input')
})

test('rejects compiled registry without provider; a commented registration does not count', () => {
    const f = fixture()
    f.write(
        f.android.variants.Debug.registry[0],
        '// "dev.lynxlab.lifecycle.LynxLibraryProviderImpl"'
    )
    expect(() => validateAndroidBinding(f.host, f.installed, f.android)).toThrow(
        'does not register'
    )
})

test('rejects stale Pod lock path and stale PBXSources independently', () => {
    const f = fixture()
    expect(() =>
        validateIOSBinding(f.host, f.installed, { ...f.ios, podPath: '/old/ios' })
    ).toThrow('Podfile.lock')
    f.ios.sources[0] = '/old/ios/src/LynxAppLifecycleModule.m'
    expect(() => validateIOSBinding(f.host, f.installed, f.ios)).toThrow('source build phase')
})

test('rejects stale iOS registry source phase and missing module registration', () => {
    const f = fixture()
    expect(() =>
        validateIOSBinding(f.host, f.installed, { ...f.ios, registry: ['/old/registry.m'] })
    ).toThrow('Registry source build phase')
    f.write(
        f.ios.registry[0],
        '// [config registerModule:NSClassFromString(@"LynxAppLifecycleModule") withName:@"LynxAppLifecycleModule"];'
    )
    expect(() => validateIOSBinding(f.host, f.installed, f.ios)).toThrow('does not register')
})

test('rejects a missing Android provider compiler input', () => {
    const f = fixture()
    f.android.projects[0].sources.Release = f.android.projects[0].sources.Release.filter(
        (path) => !path.endsWith('/AppLifecycleInitProvider.kt')
    )
    expect(() => validateAndroidBinding(f.host, f.installed, f.android)).toThrow('compiler sources')
})

test('rejects missing iOS state owner source or header', () => {
    const f = fixture()
    expect(() =>
        validateIOSBinding(f.host, f.installed, {
            ...f.ios,
            sources: f.ios.sources.filter((path) => !path.endsWith('/LALAppStateStore.m')),
        })
    ).toThrow('source build phase')
    expect(() =>
        validateIOSBinding(f.host, f.installed, {
            ...f.ios,
            headers: f.ios.headers.filter((path) => !path.endsWith('/LALAppStateStore.h')),
        })
    ).toThrow('header build phase')
})

test('rejects the historical probe peer mismatch before native compilation', () => {
    const f = fixture()
    f.write(
        join(f.host, 'node_modules/@lynx-js/react/package.json'),
        JSON.stringify({ version: '0.116.5' })
    )
    expect(() => verifyConsumerProfile(f.host)).toThrow('Unsupported consumer JS profile')
    f.write(
        join(f.host, 'node_modules/@lynx-js/react/package.json'),
        JSON.stringify({ version: '0.125.0' })
    )
    f.write(
        join(f.host, 'node_modules/@lynx-js/types/package.json'),
        JSON.stringify({ version: '3.9.0' })
    )
    expect(() => verifyConsumerProfile(f.host)).toThrow('Unsupported consumer JS profile')
    f.write(
        join(f.host, 'node_modules/@lynx-js/types/package.json'),
        JSON.stringify({ version: '4.2.1' })
    )
    expect(verifyConsumerProfile(f.host)['@lynx-js/react']).toBe('0.125.0')
})
