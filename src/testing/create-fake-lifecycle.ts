import type { AppStateWire, LynxAppLifecycleNative } from '../native.js'
import type { AppState } from '../types.js'

export interface FakeLifecycle extends LynxAppLifecycleNative {
  /** Сменить состояние. Поколение растёт само, как в нативе. */
  emit(state: AppState): void
  /** Пропустить событие: поколение прыгает, подписчик увидит missedEvents. */
  emitSkipping(state: AppState, skip: number): void
  /** Слушатели, зарегистрированные фейковым GlobalEventEmitter. */
  readonly listenerCount: number
  /** Отправить произвольный payload в глобальное событие, включая мусор. */
  emitRaw(payload: unknown): void
  /** Сымитировать событие CoreContext: видимость страницы. */
  emitCore(type: '__OnAppEnterForeground' | '__OnAppEnterBackground'): void
  /** Сколько слушателей CoreContext на данный тип. */
  coreListenerCount(type: string): number
}

/**
 * Фейк нативного модуля и GlobalEventEmitter для тестов и для работы
 * в Lynx Explorer, где нативной половины ещё нет.
 *
 * Устанавливает `globalThis.lynx.getJSModule` и `getCoreContext`, если их нет.
 */
export function createFakeLifecycle(
  initial: AppState = 'active'
): FakeLifecycle {
  let state: AppState = initial
  let generation = 0
  const listeners = new Map<string, Set<(...a: unknown[]) => void>>()
  const coreListeners = new Map<string, Set<(e: unknown) => void>>()
  const EVENT = 'lynxappstatechange'

  const g = globalThis as Record<string, unknown>
  const existing = (g.lynx ?? {}) as Record<string, unknown>
  g.lynx = {
    ...existing,
    getJSModule: (name: string) =>
      name === 'GlobalEventEmitter'
        ? {
            addListener(n: string, cb: (...a: unknown[]) => void) {
              if (!listeners.has(n)) listeners.set(n, new Set())
              listeners.get(n)?.add(cb)
            },
            removeListener(n: string, cb: (...a: unknown[]) => void) {
              listeners.get(n)?.delete(cb)
            },
          }
        : null,
    getCoreContext: () => ({
      addEventListener(type: string, cb: (e: unknown) => void) {
        if (!coreListeners.has(type)) coreListeners.set(type, new Set())
        coreListeners.get(type)?.add(cb)
      },
      removeEventListener(type: string, cb: (e: unknown) => void) {
        coreListeners.get(type)?.delete(cb)
      },
    }),
  }

  const fire = (next: AppState, bump: number): void => {
    if (next === state) return
    state = next
    generation += bump
    const payload = { state, generation }
    for (const cb of listeners.get(EVENT) ?? []) cb(payload)
  }

  return {
    getState(): AppStateWire {
      return { state, generation }
    },
    getEventName(): string {
      return EVENT
    },
    emit(next: AppState) {
      fire(next, 1)
    },
    emitSkipping(next: AppState, skip: number) {
      fire(next, skip)
    },
    get listenerCount() {
      return listeners.get(EVENT)?.size ?? 0
    },
    emitRaw(payload: unknown) {
      for (const cb of listeners.get(EVENT) ?? []) cb(payload)
    },
    emitCore(type) {
      for (const cb of coreListeners.get(type) ?? []) cb({ type })
    },
    coreListenerCount(type: string) {
      return coreListeners.get(type)?.size ?? 0
    },
  }
}
