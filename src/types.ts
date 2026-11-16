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

/** Host page visibility from CoreContext, separate from process app state; see compatibility docs. */
export type PageVisibility = 'visible' | 'hidden'

export type Unsubscribe = () => void
