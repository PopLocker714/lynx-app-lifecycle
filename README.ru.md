# @lynx-lab/app-lifecycle

> [English](./README.md) · **Русский**

[![npm](https://img.shields.io/npm/v/@lynx-lab/app-lifecycle?color=cb3837&logo=npm)](https://www.npmjs.com/package/@lynx-lab/app-lifecycle)
[![CI](https://github.com/PopLocker714/lynx-app-lifecycle/actions/workflows/ci.yml/badge.svg)](https://github.com/PopLocker714/lynx-app-lifecycle/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@lynx-lab/app-lifecycle?color=blue)](./LICENSE)

Состояние переднего плана и фона для приложений на [Lynx](https://lynxjs.org),
плюс события видимости страницы, которые не стоят ни строчки нативного кода.

## Зачем это нужно

Глобальных событий в Lynx ровно четыре: `keyboardstatuschanged`, `onWindowResize`,
`exposure`, `disexposure`. Жизненного цикла среди них нет.

Выглядит так, будто сигнал уже есть. `lynx-core` подписывается на
`MessageEventType.ON_APP_ENTER_FOREGROUND` на core-контексте и зовёт
`onAppEnterForeground()`, а это пустая заглушка «override by subclass». Подписаться
на это событие из JS **действительно можно**, я проверил на устройстве.

Но означает оно не то, что написано в имени. Sparkling зовёт `onEnterForeground()`
из `onshow(params:)`, то есть из колбэка **видимости контейнера**, а не из нотификаций
`UIApplication` (`SPKWrapperLynxView.swift:383`). При сворачивании всего приложения
не срабатывает ничего. Проверено: **ноль** событий `__OnAppEnterBackground` при
настоящем уходе в фон.

Поэтому пакет отдаёт оба сигнала:

| API | Что означает | Нативный код |
|---|---|---|
| `getAppState`, `subscribe`, `useAppState` | **приложение** свернулось или вернулось | да |
| `subscribePageVisibility`, `usePageVisibility` | эта **страница Lynx** показана или скрыта | нет |

Если задача «понять, что пользователь вернулся из приложения банка дооплачивать»,
нужен первый.

## Установка

```sh
bun add @lynx-lab/app-lifecycle
```

**Android** — больше ничего. Ни разрешений, ни правок манифеста.

**iOS** — `pod install`.

## Использование

```tsx
import { useAppState, useAppStateChange } from '@lynx-lab/app-lifecycle/react'

function Checkout() {
  // перерисовывает при смене
  const state = useAppState()

  // либо реакция на переход без перерисовки
  useAppStateChange((snapshot) => {
    if (snapshot.state === 'active') refetchPaymentStatus()
  })
}
```

Без React:

```ts
import { getAppState, subscribe } from '@lynx-lab/app-lifecycle'

const { state } = getAppState()
const off = subscribe(({ state }) => console.log(state))
```

### Про поток

`NativeModules` существует **только на фоновом потоке (BTS)**, на главном он
`undefined`. Всё отсюда вызывается с фонового потока.

## API

| Функция | Что делает |
|---|---|
| `getAppState(): AppStateSnapshot` | Синхронно и авторитетно. **Именно этим берётся начальное значение** |
| `subscribe(cb): Unsubscribe` | Только переходы. Второй аргумент колбэка `true`, когда разрыв поколения говорит о потерянном событии |
| `subscribePageVisibility(cb): Unsubscribe` | Показ и скрытие страницы. Нативный модуль не нужен |
| `useAppState(): AppState` | Хук, перерисовывает при смене |
| `useAppStateChange(cb)` | Хук, только колбэк |
| `usePageVisibility(): PageVisibility` | Хук видимости страницы |
| `setNativeModule(m)` | Шов для тестов. `null` возвращает настоящий поиск |

Состояния `inactive` здесь нет. На Android такого не существует, а обещать
одинаковое поведение и не давать его хуже, чем не обещать.

### Почему начальное значение берётся геттером, а не подпиской

Lynx **дропает** глобальное событие, если рантайм ещё не поднялся, поэтому
**первое** состояние подпиской не приходит никогда. `getAppState()` читает
нативное состояние напрямую и работает всегда. Каждый снимок несёт монотонное
`generation`, разрыв означает потерянное событие.

## Если модуль не нашёлся

Пайплайн Lynx падает молча, поэтому ошибка сразу называет обе причины.

**Android** — `adb logcat | grep "Skip unavailable Lynx library provider"`. Значит
не отработал процессор аннотаций: библиотека объявляет
`kapt("org.lynxsdk.lynx:lynx-processor")` сама, потому что Gradle-плагин прокидывает
аргумент процессора, но сам процессор не добавляет.

**iOS** — проверь, что в `Pods/` есть сгенерированный реестр autolink с упоминанием
`LynxAppLifecycleModule`. Если нет, маркер `@LynxNativeModule("...")` не сматчился.

Ручной запасной путь:

```kotlin
LynxEnv.inst().registerModule("LynxAppLifecycleModule", LynxAppLifecycleModule::class.java)
```

```objc
[config registerModule:LynxAppLifecycleModule.class];
```

## Заметки о реализации

**На Android взят `ActivityLifecycleCallbacks`, а не `ProcessLifecycleOwner`.** Второй
потянул бы `androidx.lifecycle:lifecycle-process` в чужую сборку ради тридцати строк
логики, а шаблон Sparkling это AGP 7.4.2 и Kotlin 1.8.10, где лишний резолв реальный
риск. Подсчёт запущенных Activity даёт тот же ответ при нулевых зависимостях.
Поворот экрана ложного фона не даёт: `onStart` новой Activity успевает раньше,
чем `onStop` старой, и счётчик не проседает до нуля.

**На iOS модуль conform-ится к `LynxContextModule`.** Это не косметика:
`CommonModuleCreator` проверяет именно этот протокол и тогда сам зовёт
`initWithLynxContext:`, подставляя `LynxContext`. Autolink регистрирует модули
**без** param, поэтому `initWithParam:` не вызовется никогда, и без этого протокола
не будет ни контекста, ни `sendGlobalEvent`.

**Макрос `LynxNativeModule` объявлен под `#ifndef`.** Он появился только в Lynx 3.9.0,
а `latest`-шаблон Sparkling до сих пор пинит 3.6.0.

## Лицензия

MIT
