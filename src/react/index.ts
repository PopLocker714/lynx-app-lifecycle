import { useEffect, useState } from '@lynx-js/react'
import { getAppState, subscribe, subscribePageVisibility } from '../index.js'
import type { AppState, AppStateSnapshot, PageVisibility } from '../types.js'

/**
 * Текущее состояние приложения, реактивно.
 *
 * Начальное значение берётся синхронным `getAppState()`, а не ожиданием
 * события: первое событие подпиской не приходит никогда.
 */
export function useAppState(): AppState {
  const [state, setState] = useState<AppState>(() => {
    try {
      return getAppState().state
    } catch {
      // Модуль не слинкован или главный поток. Не роняем рендер, но и не врём:
      // getAppState() бросит с внятным текстом, если позвать его напрямую.
      return 'active'
    }
  })

  useEffect(() => {
    let alive = true
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = subscribe((snapshot) => {
        if (alive) setState(snapshot.state)
      })
    } catch {
      /* см. выше */
    }
    return () => {
      alive = false
      unsubscribe?.()
    }
  }, [])

  return state
}

/**
 * Колбэк на переход, без перерисовки.
 *
 * Нужен, когда состояние не влияет на разметку: перезапросить статус платежа,
 * обновить токен, ресинкнуть корзину.
 */
export function useAppStateChange(
  onChange: (snapshot: AppStateSnapshot, missedEvents: boolean) => void
): void {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = subscribe(onChange)
    } catch {
      /* модуль не слинкован */
    }
    return () => unsubscribe?.()
  }, [onChange])
}

/**
 * Видимость этой страницы Lynx. Не состояние приложения, см. README.
 * Нативного кода не требует.
 */
export function usePageVisibility(): PageVisibility {
  const [visibility, setVisibility] = useState<PageVisibility>('visible')

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = subscribePageVisibility(setVisibility)
    } catch {
      /* главный поток */
    }
    return () => unsubscribe?.()
  }, [])

  return visibility
}
