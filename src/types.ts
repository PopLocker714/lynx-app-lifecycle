/**
 * Состояние ПРИЛОЖЕНИЯ, не страницы.
 *
 * `active`     — приложение на переднем плане
 * `background` — свёрнуто
 *
 * Промежуточного `inactive` из React Native здесь нет намеренно: на Android
 * такого состояния не существует, а обещать одинаковое поведение и не давать
 * его хуже, чем не обещать.
 */
export type AppState = 'active' | 'background'

export interface AppStateSnapshot {
  readonly state: AppState
  /**
   * Монотонный счётчик. Разрыв означает пропущенное событие: перечитай
   * `getAppState()`. Нужен потому, что глобальные события Lynx дропаются,
   * если рантайм ещё не поднялся.
   */
  readonly generation: number
}

/**
 * Видимость СТРАНИЦЫ Lynx, а не приложения.
 *
 * Приходит из самого Lynx через CoreContext, нативного кода не требует.
 * Срабатывает, когда контейнер этой страницы показан или скрыт: переход
 * по роутеру, возврат назад. При сворачивании приложения НЕ срабатывает —
 * проверено на устройстве, Sparkling зовёт это из onshow/onHide контейнера,
 * а на UIApplication не подписан.
 */
export type PageVisibility = 'visible' | 'hidden'

export type Unsubscribe = () => void
