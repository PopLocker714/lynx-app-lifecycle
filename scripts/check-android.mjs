import { execFileSync } from 'node:child_process'
import { checkKotlinFormat } from './native-tools.mjs'

checkKotlinFormat()
execFileSync(
    './android-check/gradlew',
    [
        '-PlynxLifecycleStrictChecks=true',
        '-p',
        'android-check',
        ':lynx-app-lifecycle:testDebugUnitTest',
        ':lynx-app-lifecycle:assembleDebug',
        ':lynx-app-lifecycle:assembleRelease',
        ':lynx-app-lifecycle:lintDebug',
        ':lynx-app-lifecycle:lintRelease',
        '--no-daemon',
        '--stacktrace',
    ],
    { stdio: 'inherit' }
)
