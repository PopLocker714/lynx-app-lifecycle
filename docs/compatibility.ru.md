> [English](./compatibility.md) · **Русский**

# Совместимость и проверки

Поддержка означает Lynx и явно проверенные host. Package peers, native compile SDK, runtime,
ОС и toolchain — отдельные оси. Миграция остаётся candidate: physical consumer Debug/Release прошёл на одном профиле;
минимальные ОС и дополнительный поддерживаемый профиль ещё не проверены.

| Параметр | Evidence / статус |
|---|---|
| Baseline source | `b3dbc23`, версия пакета 1.0.0; прошли 14 JS tests/typecheck/build |
| Исторический lifecycle smoke | Наблюдались foreground/background; iOS evidence был simulator smoke, не physical Debug/Release |
| Текущая JS-разработка | Bun 1.4.0, TS 5.9.3, Biome 2.5.9, ReactLynx 0.125.0, Lynx types 4.2.1 |
| Android compile profile | SDK 35 / min 23; Lynx compileOnly/processor 4.0.1; AGP 8.7.0, Kotlin 2.0.21, JDK 17 |
| iOS compile profile | Настоящие framework headers Lynx 3.9.0; объявлен deployment 12.0; локально Xcode 27.2 |
| Детерминированные native checks | JVM Activity tracker; настоящий iOS store запускается на macOS Foundation с test adapters UIKit/Lynx |
| Candidate consumer | Обязан соблюдать React peer >=0.124.0 и types ^4.0.0; старый probe React 0.116.5 не подходит |
| Статус consumer | Принят для точного профиля/сценариев ниже; оставшиеся device gaps указаны отдельно |
| Release | Заблокирован до цепочки final version/changelog → immutable tarball → consumer QA → publish того же tarball |

Consumer acceptance: связь точного архива с установленными файлами и native source,
Android/iOS Debug/Release (Android R8), два одновременных contexts, destroy/recreate LynxView,
инициализация в background, обычные foreground/background, recreation Activity внутри и
за пределами grace 700 мс, несколько Activity, удалённый provider с ручным startup init,
React render/effect gap и unsubscribe. Page visibility проверяется отдельно от app state.
Проверка на новой ОС не подтверждает minimum SDK/runtime и независимые scenes.

Machine receipts в `artifacts/` содержат source commit, clean status и SHA256 tarball.
Consumer evidence дополнительно указывает commit/lock, ReactLynx/native runtime, bundle hash,
toolchain, ОС/устройство, варианты сборки и реальные сценарии. GitHub CI рабочей ветки
не запускался; локальные проверки не означают успешный remote workflow.

При обновлении host сохраните предыдущий verified profile, установите старый tarball в
зафиксированный candidate host, отличите дефект пакета от host, исправьте/review/перепроверьте
затронутое и предыдущий maintained profile. Матрица обновляется по фактам. Прекращение
поддержки — breaking change. Обновление только документации проверки не требует npm release.

## Зафиксированная consumer-приёмка (2026-11-17)

Source `87a7b93`, tarball `c8cabd693d35b308b53aa166e7644b8c5b555e78fd8dc4b1daa936e452b93529`, прошёл physical Pixel 9 / Android 17 и iPhone 11 / iOS 18.4.1 Debug/Release, Android R8. Профиль: Sparkling 2.1.0-rc.36 / Lynx 3.9.0, ReactLynx 0.125.0 / types 4.2.1 / Rsbuild 2.1.10. Две JS-подписки получают одинаковые generation при background/resume; отписка и повторная подписка прошли. Отдельная Android instrumentation подтверждает initial background/0 до первой Activity, настоящее recreation с новым instance и одной started Activity, затем background при закрытии. Это не проверка двух физических Lynx view.

Evidence: probe source `616c66a`, evidence `51ae596`, `docs/evidence/lifecycle-2026-11-17/results.json` (68 файлов в индексе); main bundle `69a1c6861341bfaf3fb7f63479ed5a2dd265eaa31ee70ad98bc44aea22c8d01d`. У host остаются три baseline TS-ошибки и один устаревший App test failure. Metadata-only patch `3cb55f3` объявляет отсутствующий optional Vitest peer для React testing-library; 692 runtime файла идентичны. Minimum OS, physical multi-view/scene teardown, manual init без provider, медленное recreation за пределами grace и page-visibility device-сценарии этим smoke не доказаны. Adapter evidence учитывается отдельно.

Это обновление документации не меняет проверенный runtime. Hash выше относится к прежнему точному архиву; упаковка обновлённой документации получает новый hash.
