#!/usr/bin/env node
// Тарбол это весь деливерабл: autolink компилирует нативные исходники у
// потребителя. Если android/ или ios/ не уехали в пакет, библиотека мертва,
// и узнаешь ты об этом только в чужом приложении.
import { execFileSync } from 'node:child_process'

const out = execFileSync('npm', ['pack', '--dry-run', '--json'], {
  encoding: 'utf8',
})
const files = JSON.parse(out)[0].files.map((f) => f.path)

const required = [
  'lynx.lib.json',
  'dist/index.js',
  'dist/index.d.ts',
  'dist/testing/index.js',
  'dist/react/index.js',
  'android/build.gradle.kts',
  'android/consumer-rules.pro',
  'android/src/main/AndroidManifest.xml',
  'android/src/main/java/dev/lynxlab/lifecycle/LynxAppLifecycleModule.kt',
  'ios/LynxAppLifecycle.podspec',
  'ios/src/LynxAppLifecycleModule.h',
  'ios/src/LynxAppLifecycleModule.m',
  'LICENSE',
  'README.md',
  'README.ru.md',
]

const forbidden = [
  /^android\/build\//,
  /^android\/\.gradle\//,
  /^src\/__tests__\//,
  /^android-check\//,
]

const missing = required.filter((f) => !files.includes(f))
const leaked = files.filter((f) => forbidden.some((re) => re.test(f)))

if (missing.length || leaked.length) {
  if (missing.length)
    console.error('MISSING from tarball:\n  ' + missing.join('\n  '))
  if (leaked.length)
    console.error('LEAKED into tarball:\n  ' + leaked.join('\n  '))
  process.exit(1)
}
console.log(`check-publishable: ok (${files.length} files)`)
