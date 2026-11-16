> [English](./README.md) · **Русский**

# @lynx-lab/app-lifecycle

[![npm](https://img.shields.io/npm/v/@lynx-lab/app-lifecycle?color=cb3837&logo=npm)](https://www.npmjs.com/package/@lynx-lab/app-lifecycle)
[![CI](https://github.com/PopLocker714/lynx-app-lifecycle/actions/workflows/ci.yml/badge.svg)](https://github.com/PopLocker714/lynx-app-lifecycle/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@lynx-lab/app-lifecycle?color=blue)](./LICENSE)

Состояние foreground/background приложения Lynx и отдельный API видимости страницы host.
App state подходит для возврата из банковского приложения или авторизации. Page visibility
означает показ/скрытие контейнера Lynx и не заменяет состояние приложения.

## Поддержка платформ

| Возможность | Android | iOS |
|---|---|---|
| Snapshot приложения и подписка на переходы | Реализовано | Реализовано |
| Несколько Lynx contexts | Общее состояние процесса, доставка каждому context | Общее состояние процесса, доставка каждому context |
| Состояние `inactive` | Не возвращается | Не возвращается; inactive считается foreground |
| Видимость страницы | События CoreContext host | События CoreContext host |
| Native минимум | Заявлен API 23; минимум не проверен на устройстве | Заявлен iOS 12; минимум не проверен на устройстве |

Текущая рабочая версия — **candidate**, без завершённого stable-профиля.
Physical Android/iOS Debug/Release прошли для зафиксированного consumer
ReactLynx 0.125 / Rsbuild 2. Точные архивы, сценарии и хвосты — в [совместимости](docs/compatibility.ru.md).
Основная платформа Lynx; Sparkling — первый consumer host. Остальные host требуют своих проверок.

## Требования и установка

Hooks объявляют `@lynx-js/react >=0.124.0`; optional type peer — `@lynx-js/types ^4.0.0`.
При разработке используется ReactLynx 0.125.0. Эти версии JS-пакетов отличаются от
native Lynx runtime host. Успешная native-сборка не делает старый ReactLynx проверенным.

```sh
bun add @lynx-lab/app-lifecycle
```

Для неопубликованного candidate выполните `bun run check:package` в checkout пакета,
затем установите через `bun add` точный `artifacts/app-lifecycle-<sha256>.tgz` в consumer.
Бейдж npm показывает опубликованную версию, а не эту ветку.

**Android:** autolink регистрирует модуль; объединённый manifest теперь содержит
неэкспортируемый initialization provider. Runtime permissions не нужны. Provider
подписывается на Activity до запуска первой Activity. Это заменяет прежнее ленивое
предположение об одной уже активной Activity.

Если host удаляет provider, вызовите на main thread до старта всех Activity:

```kotlin
LynxAppLifecycleModule.initialize(application)
```

Поздняя инициализация не восстанавливает пропущенные callbacks. Без инициализации
`getAppState()` завершается ошибкой вместо угаданного состояния. Ручная регистрация
модуля и инициализация процесса — разные действия.

**iOS:** установите Pods обычной командой CocoaPods вашего host. Observer процесса
запускается на main queue. Чтение до bootstrap завершается ошибкой; синхронный bridge
не ждёт main queue. App extensions и независимое состояние отдельных scenes не поддерживаются.

## Использование

Core API вызывается в background thread Lynx. Module scope выполняется также на
main thread: незащищённый top-level native вызов небезопасен. Hooks сохраняют прежние
fallback при недоступности native state и перечитывают состояние после подписки.

```ts
import { getAppState, subscribe } from '@lynx-lab/app-lifecycle'
import type { AppState } from '@lynx-lab/app-lifecycle'

export function observeApp(onState: (state: AppState) => void) {
    'background only'
    const initial = getAppState()
    const unsubscribe = subscribe(({ state }) => onState(state))
    return { initial, unsubscribe }
}
```

React hooks:

```ts
import { useAppState, useAppStateChange } from '@lynx-lab/app-lifecycle/react'

export function useCheckoutLifecycle(onActive: () => void) {
    const state = useAppState()
    useAppStateChange((snapshot) => {
        if (snapshot.state === 'active') onActive()
    })
    return state
}
```

## API

| API | Контракт |
|---|---|
| `getAppState()` | Синхронный `{ state, generation }` после native initialization; ошибка при недоступном/некорректном snapshot |
| `subscribe(listener)` | Только переходы; второй аргумент отмечает пропуск generation отдельно для каждого подписчика |
| `subscribePageVisibility(listener)` | `visible` / `hidden` из CoreContext host; native module не нужен |
| `useAppState()` | Реактивное состояние; initial fallback — `active` при ошибке native доступа |
| `useAppStateChange(listener)` | Callback переходов; ошибки подписки сохраняют прежний молчаливый fallback |
| `usePageVisibility()` | Видимость страницы; initial fallback — `visible` |
| `setNativeModule(module)` | Тестовый шов; `null` возвращает настоящий поиск |

Подписки возвращают unsubscribe. Начальный snapshot читайте явно: Lynx может потерять
события до создания JS emitter. Допустимы `active` и `background`. Некорректные события
игнорируются. Старое событие без generation доставляется с `generation: -1` и
`missedEvents: false`; следующая известная generation начинает новый cursor.
Пропуск измеряется относительно предыдущего события подписчика или последнего известного
snapshot на момент его подписки. Getter и другой listener не расходуют его cursor.

Android сохраняет foreground до **700 мс** после остановки последней Activity ради
configuration recreation. Новый start отменяет ожидание; сорванное/медленное пересоздание
переходит в background. Обычный stop последней Activity сообщает background сразу.
Это ограниченное ожидание, не гарантия для произвольно долгого recreation.

Диагностика установки, native ownership, точные проверки и участие:
[реализация](docs/implementation.ru.md), [совместимость](docs/compatibility.ru.md),
[contributing](CONTRIBUTING.ru.md). Лицензия: [MIT](LICENSE).
