import { getNativeModule } from './native.js'
import type {
  AppState,
  AppStateSnapshot,
  PageVisibility,
  Unsubscribe,
} from './types.js'

export type { AppStateWire, LynxAppLifecycleNative } from './native.js'
export { setNativeModule } from './native.js'
export type {
  AppState,
  AppStateSnapshot,
  PageVisibility,
  Unsubscribe,
} from './types.js'

declare const lynx: {
  getJSModule?(name: string): {
    addListener(name: string, cb: (...args: unknown[]) => void): void
    removeListener(name: string, cb: (...args: unknown[]) => void): void
  } | null
  getCoreContext?(): {
    addEventListener(type: string, listener: (event: unknown) => void): void
    removeEventListener(type: string, listener: (event: unknown) => void): void
  } | null
}

let lastGeneration = -1

/**
 * Текущее состояние приложения. Синхронно, всегда авторитетно.
 *
 * Именно этим берётся НАЧАЛЬНОЕ значение. Подписка для этого не годится:
 * глобальные события Lynx дропаются, если рантайм ещё не поднялся, поэтому
 * первое состояние подпиской не приходит никогда.
 */
export function getAppState(): AppStateSnapshot {
  const wire = getNativeModule().getState()
  lastGeneration = wire.generation
  return { state: wire.state, generation: wire.generation }
}

/**
 * Подписка на смену состояния приложения.
 *
 * Колбэк получает снимок. Если поколение перескочило больше чем на единицу,
 * значит событие потерялось, и вторым аргументом придёт `true` — тогда стоит
 * перечитать состояние самому, если логика зависит от переходов, а не от
 * текущего значения.
 */
export function subscribe(
  listener: (snapshot: AppStateSnapshot, missedEvents: boolean) => void
): Unsubscribe {
  const native = getNativeModule()
  const emitter = lynx.getJSModule?.('GlobalEventEmitter')
  if (!emitter) {
    throw new Error(
      '@lynx-lab/app-lifecycle: GlobalEventEmitter недоступен, значит подписка ' +
        'идёт с главного потока. Модульная область в ReactLynx выполняется на ' +
        'обоих потоках: зови из компонента, из useEffect или бери хуки из ' +
        '"@lynx-lab/app-lifecycle/react".'
    )
  }
  const eventName = native.getEventName()

  const handler = (...args: unknown[]): void => {
    const payload = args[0] as
      | { state?: AppState; generation?: number }
      | undefined
    if (!payload || typeof payload.state !== 'string') return
    const generation =
      typeof payload.generation === 'number' ? payload.generation : -1
    const missed = lastGeneration >= 0 && generation > lastGeneration + 1
    lastGeneration = generation
    listener({ state: payload.state, generation }, missed)
  }

  emitter.addListener(eventName, handler)
  return () => emitter.removeListener(eventName, handler)
}

/**
 * Видимость ЭТОЙ СТРАНИЦЫ Lynx. Нативного кода не требует вообще: событие
 * приходит из самого Lynx через CoreContext.
 *
 * ВАЖНО: это НЕ состояние приложения. Срабатывает при показе и скрытии
 * контейнера страницы, а при сворачивании приложения не срабатывает.
 * Проверено на устройстве: Sparkling зовёт это из onshow/onHide контейнера,
 * а на UIApplication не подписан никто. Для «пользователь вернулся из
 * приложения банка» нужен `subscribe`, а не это.
 *
 * Имена событий взяты из `MessageEventType` в исходниках lynx-core; в публичных
 * типах они не объявлены, но `addEventListener` принимает обычную строку.
 */
export function subscribePageVisibility(
  listener: (visibility: PageVisibility) => void
): Unsubscribe {
  const core = lynx.getCoreContext?.()
  if (!core) {
    throw new Error(
      '@lynx-lab/app-lifecycle: lynx.getCoreContext() недоступен, значит вызов ' +
        'идёт с главного потока. Модульная область в ReactLynx выполняется на ' +
        'обоих потоках: зови из компонента, из useEffect или бери хуки из ' +
        '"@lynx-lab/app-lifecycle/react".'
    )
  }
  const onVisible = (): void => listener('visible')
  const onHidden = (): void => listener('hidden')

  core.addEventListener('__OnAppEnterForeground', onVisible)
  core.addEventListener('__OnAppEnterBackground', onHidden)

  return () => {
    core.removeEventListener('__OnAppEnterForeground', onVisible)
    core.removeEventListener('__OnAppEnterBackground', onHidden)
  }
}
