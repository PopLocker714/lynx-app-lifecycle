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
      '@lynx-lab/app-lifecycle: `NativeModules` недоступен. Этот код обязан ' +
        'выполняться на фоновом потоке (BTS): на главном потоке NativeModules ' +
        'не существует.'
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
      `@lynx-lab/app-lifecycle: нативный модуль "${MODULE_NAME}" не зарегистрирован.\n` +
        '  Android: смотри `adb logcat | grep "Skip unavailable Lynx library provider"`. ' +
        'Это значит, что процессор аннотаций kapt не отработал: библиотека обязана ' +
        'объявить id("org.jetbrains.kotlin.kapt") и kapt("org.lynxsdk.lynx:lynx-processor").\n' +
        '  iOS: проверь, что в Pods/ есть сгенерированный реестр autolink с упоминанием ' +
        'LynxAppLifecycleModule. Если нет, маркер @LynxNativeModule("...") не сматчился.\n' +
        '  Ручной запасной путь для обеих платформ описан в README.'
    )
  }

  return candidate as LynxAppLifecycleNative
}
