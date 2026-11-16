> [English](./compatibility.md) · **Русский**

# Совместимость и проверки

Поддержка означает Lynx и явно проверенные host. Package peers, native compile SDK, runtime,
ОС и toolchain — отдельные оси. Миграция остаётся candidate: physical consumer Debug/Release,
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
| Статус consumer | Pending. Сборка и adapter tests не доказывают physical lifecycle, R8 или linking host |
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
