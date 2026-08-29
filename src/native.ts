import type { AppState } from './types.js'

export interface AppStateWire {
  state: AppState
  generation: number
}

export interface LynxAppLifecycleNative {
  /** Синхронно. Текущее состояние плюс поколение. */
  getState(): AppStateWire
  /** Имя глобального события, чтобы строка не расходилась с нативом. */
  getEventName(): string
}

/**
 * Объявлено, но никогда не импортируется.
 *
 * `NativeModules` это `declare global` в @lynx-js/types: в тарболе пакета нет
 * ни одного `.js`, поэтому `import { NativeModules } from '@lynx-js/types'`
 * это падение в рантайме, а не ошибка типов, которую заметишь.
 */
declare const NativeModules: Record<string, unknown> | undefined

const MODULE_NAME = 'LynxAppLifecycleModule'

let injected: LynxAppLifecycleNative | null = null

/** Шов для тестов. `setNativeModule(null)` возвращает настоящий поиск. */
export function setNativeModule(module: LynxAppLifecycleNative | null): void {
  injected = module
}

export function getNativeModule(): LynxAppLifecycleNative {
  if (injected) return injected

  if (typeof NativeModules === 'undefined' || NativeModules === null) {
    throw new Error(
      '@lynx-lab/app-lifecycle: `NativeModules` is unavailable, so this call is ' +
        'running on the main thread.\n' +
        '  In ReactLynx, code at MODULE SCOPE runs on BOTH threads, so a call at ' +
        'the top level of a file fails exactly like this.\n' +
        '  Call it from inside a component, from useEffect, or from anything that ' +
        'is background-thread (BTS) by construction.\n' +
        '  Or use the hooks from "@lynx-lab/app-lifecycle/react" — they already ' +
        'handle this.'
    )
  }

  const candidate = NativeModules[MODULE_NAME] as
    | Partial<LynxAppLifecycleNative>
    | undefined

  if (
    !candidate ||
    typeof candidate.getState !== 'function' ||
    typeof candidate.getEventName !== 'function'
  ) {
    throw new Error(
      `@lynx-lab/app-lifecycle: native module "${MODULE_NAME}" is not registered.\n` +
        '  Android: check `adb logcat | grep "Skip unavailable Lynx library provider"`. ' +
        'That message means the kapt annotation processor did not run — the library ' +
        'must declare id("org.jetbrains.kotlin.kapt") and ' +
        'kapt("org.lynxsdk.lynx:lynx-processor").\n' +
        '  iOS: check that Pods/ contains a generated Lynx autolink registry naming ' +
        'LynxAppLifecycleModule. If not, the @LynxNativeModule("...") marker was not ' +
        'matched.\n' +
        '  Manual fallback for both platforms: see the README.'
    )
  }

  return candidate as LynxAppLifecycleNative
}
