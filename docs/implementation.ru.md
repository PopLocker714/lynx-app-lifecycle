> [English](./implementation.md) · **Русский**

# Реализация и native integration

## Владение и потоки

TS-фасад проверяет snapshot и события на нетипизированной границе bridge. Каждая подписка
владеет cursor generation; getter или другой подписчик не расходует её сигнал пропуска.
Hooks перечитывают snapshot после регистрации в effect. Прежние fallback `active` / `visible`
и подавление ошибок подписки сохраняются.

Android наблюдает `Application.ActivityLifecycleCallbacks` через manifest provider до старта
Activity. Store процесса переживает уничтожение модулей. Activity учитываются на main;
immutable volatile snapshot позволяет BTS читать state и generation как одно значение.
Регистрация/удаление listeners синхронизированы, доставка использует копию списка; destroy
модуля сначала помечает listener неактивным. Set содержит только started Activity.
Повторные callbacks не могут увести счётчик ниже нуля.

Последний `onStop` с `isChangingConfigurations` сохраняет foreground максимум 700 мс.
Следующий start отменяет timer, обычный последний stop обновляет состояние сразу. Если
replacement не появился к timeout, отправляется background. Использован принцип задержки
AndroidX без новой dependency и задержки обычного background. Recreation дольше 700 мс
может дать background/active; это не эквивалент всех состояний ProcessLifecycleOwner.
См. [Android recreation](https://developer.android.com/guide/topics/resources/runtime-changes)
и [ProcessLifecycleOwner](https://developer.android.com/reference/androidx/lifecycle/ProcessLifecycleOwner).

iOS store запускает наблюдение из `+load` асинхронно на main queue. Там читается
`UIApplication.applicationState`, и наблюдаются launch/active/background notifications
на протяжении процесса, включая периоды без модулей. Lock защищает immutable snapshot
и weak registry contexts; getter не ждёт main синхронно. Начальный cache содержит
`NOT_INITIALIZED`, который JS превращает в ошибку. После bootstrap начальное состояние
UIApplication, отличное от background, считается `active`; промежуточный inactive не
публикуется. Все живые contexts получают одинаковую generation перехода. Уничтоженные
contexts удаляются, registry ими не владеет. Lynx может отбросить уже поставленное в очередь
событие после уничтожения view. Отдельные scenes и app extensions не поддерживаются.
См. [Apple applicationState](https://developer.apple.com/documentation/uikit/uiapplication/applicationstate).

## Интеграция host и диагностика

При ошибке native lookup проверьте Android kapt/autolink registration и iOS generated registry
с `LynxAppLifecycleModule`. Возможна ручная регистрация:

```kotlin
LynxEnv.inst().registerModule("LynxAppLifecycleModule", LynxAppLifecycleModule::class.java)
```

```objc
[config registerModule:LynxAppLifecycleModule.class];
```

На Android это не заменяет инициализацию процесса. Сохраните `AppLifecycleInitProvider`
либо вызовите `LynxAppLifecycleModule.initialize(application)` на main до всех Activity.
Если brownfield host подключает модуль после старта Activity, точное начальное общее
состояние восстановить нельзя: сначала обеспечьте startup integration. Изменение provider
требует проверки merged manifest и consumer Release/R8. Provider не экспортирует операции
с данными и не запрашивает permissions.

iOS-класс реализует настоящий `LynxContextModule`, чтобы autolink передал context.
Синхронные методы сохраняют NSDictionary return и ARC-neutral имена selectors.
Регистрация API и наблюдение store имеют разные lifetime.

Page events идут из CoreContext consumer. Историческая проверка Sparkling показала
видимость контейнера, а не foreground/background процесса. Это не утверждение обо всех
host Lynx и будущих версиях. Обе подписки возвращают cleanup.

## Происхождение

Activity tracker и iOS store реализованы локально. Структура Android provider повторяет
паттерн раннего запуска edge-to-edge Lynx Lab; его store inset не переиспользуется.
Контракты опираются на указанные Android/Apple источники. Полного копирования чужой
native реализации нет. Недостающая dev-only декларация ElementNode взята из Lynx upstream;
точная версия и лицензия — в [contributing](../CONTRIBUTING.ru.md).
