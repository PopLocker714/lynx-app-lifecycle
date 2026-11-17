> [English](./CONTRIBUTING.md) · **Русский**

# Участие в разработке

Применяется стандарт пакетов Lynx Lab v1 (`b7afc39`, требования consumer binding из
`ca5d237`). Сохраняйте небольшую структуру TS-фасад → native adapters и отдельные React
hooks/testing entrypoints. Публичные JS-сигнатуры сохранены. Форматирование отделяется
от изменения поведения; проверяйте native ownership и каждый вход bridge. Mock или
отдельная компиляция не подтверждают устройство, host или диапазон версий.

## Инструменты и быстрые проверки

Bun 1.4.0, TypeScript 5.9.3, Biome 2.5.9; 4 пробела, 100 колонок, YAML — 2 пробела.
Установка: `bun install --frozen-lockfile`. Предпочитайте общий Bun isolated store,
проверяйте local overrides до смены linker. До install/build проверяйте место: минимум
15 ГиБ перед зависимостями, 25 ГиБ перед native build с неизвестным пиком, минимум 10 ГиБ
после него. Тяжёлые операции согласуйте с агентом, владеющим очередью сборок.

| Команда | Проверки |
|---|---|
| `bun run check` | Lint с warnings-as-errors, strict runtime/test TS, negative declaration control, tests, build, настоящий tarball |
| `bun run check:audit` | Граф, точные временные исключения и фактические версии npm bundle |
| `bun dedupe --check` / `bun pm licenses` | Повторные resolutions / инвентаризация лицензий |
| `bun run format` / `bun run format:native` | TS/JSON и собственные Kotlin/ObjC |
| `bun run check:android` | ktlint, own Kotlin warnings-as-errors, JVM tests, Debug/Release compile, Android Lint |
| `bun run check:ios` | clang-format, macOS store harness, iOS arm64 compile и Clang analysis на настоящих framework headers consumer |
| `bun run check:ios:store` | Настоящий store с adapters UIKit/Lynx на macOS; без device proof |
| `bun run check:package` | Настоящий Bun archive, exports/files/autolink/docs/import smoke и компиляция README examples, повторяемый receipt |
| `bun run check:types-compat` | Версия/срок и negative control для недостающей upstream декларации |

`check:package` запускает prepack build. Результат — `artifacts/package-evidence.json`
и архив с SHA256 в имени. Имя `package.json` внутри artifacts не используется: оно меняет
Node package scope. Core/testing импортируются напрямую; hooks требуют настоящего Lynx
consumer. Source symlink не доказывает установку архива. Consumer Debug/Release/device
acceptance и binding native source — отдельные проверки.

Native tools закреплены: ktlint 1.7.1 с проверкой SHA256 и clang-format 21.1.8.
`JAVA_HOME` должен указывать JDK 17, `ANDROID_HOME` — установленный SDK; standalone compileSdk 35.
`KTLINT_JAR` может указывать существующий проверенный jar; иначе он загружается в `.tools`.
Clang-format ставится локально, например Python venv `.tools/clang-format` и
`pip install clang-format==21.1.8`, либо `CLANG_FORMAT` указывает исполняемый файл этой версии.

`LYNX_FRAMEWORKS_DIR` указывает на `Build/Products/Debug-iphoneos` зафиксированного consumer
с `Lynx/Lynx.framework` и dependency frameworks. `check:ios` использует реальные SDK headers.
Только отдельный macOS store test применяет adapters. CI fixture `ios-check` закрепляет
Lynx 3.9.0 и строит frameworks до анализа. Полная CI-сборка fixture локально не выполнялась;
локальный анализ использовал существующие consumer frameworks. Generated Xcode projects,
Pods и builds — воспроизводимые локальные результаты.

## Точечные исключения совместимости

Владелец: **Lynx Lab**. Пересмотр до **2026-12-16**, перед изменением затронутых зависимостей
или включением release. `skipLibCheck` остаётся false.

- ReactLynx 0.125.0 ссылается на ElementNode, но npm не содержит его declaration.
  Dev-only `types/reactlynx-0.125.d.ts` восстанавливает ровно одну строку из
  [upstream db8f978](https://github.com/lynx-family/lynx-stack/blob/db8f978aba9b2e896a71d835ebcb0f2dcc9b68c2/packages/react/runtime/src/worklet-runtime/types/elementApi.d.ts#L4),
  tag `@lynx-js/react@0.125.0`, лицензия [Apache-2.0](https://github.com/lynx-family/lynx-stack/blob/db8f978aba9b2e896a71d835ebcb0f2dcc9b68c2/LICENSE).
  Negative control исключает её в памяти и подтверждает исходную ошибку missing-name.
  Файл явно включён в development configs, не публикуется и не появляется в публичных
  declarations. Guard истекает 2026-12-17T00:00:00Z.
- ReactLynx экспортирует React 18 symbols, удалённые из типов React 19. Development pin
  `@types/react 18.3.28` соответствует peer `^18 || ^19`. Неизменённый peer пакета не
  подтверждает все сочетания React/host. Aliased internal-preact импортирует себя как
  `preact`; dev alias точно той же версии upstream и TS paths разрешают self-import при
  isolated storage. Runtime dependency приложения и выдуманный API не добавляются.
- `@lynx-js/types` 4.2.1 содержит устаревшее расширение `react.JSX`: при hoisted install
  оно смешивает refs React DOM input с Lynx и затеняет Lynx `SVGProps`. Dev-only patch под
  Apache-2.0 удаляет только это расширение, сохраняя все экспортируемые типы элементов Lynx.
  ReactLynx 0.125 использует собственный JSX namespace `@lynx-js/react/jsx-runtime`.
  Strict fixture проверяет native input/SVG и несовместимость DOM/native refs. Compatibility
  check привязан к точной версии и SHA256 declaration. Пересмотреть при обновлении Lynx types
  или ReactLynx; удалить, когда upstream корректно разделит JSX namespaces. Корневой dev patch
  не поставляется и не применяется в consumer: его renderer/type profile проверяется отдельно.
  Hoisted и isolated development layouts проверены с `skipLibCheck: false`; разрешённые
  версии зависимостей и runtime bytes не меняются.
- Standalone KGP 2.0.21 kapt переключается на language 1.9. Opt-in strict check явно задаёт
  1.9 только этой проверке; defaults host не меняются. Диагностики стороннего annotation
  processor RELEASE_8/source11 и установленного SDK XML tool-version записаны в native logs;
  own Kotlin/Clang/Lint warnings остаются errors. Для annotation 1.9.1 точечно подавлен
  GradleDependency, чтобы сохранить проверявшийся профиль host до отдельного обновления.

## Цепочка поставок и публикация

Совместимые dev-tool обновления проверены отдельно для этого пакета. Фактический bundle
npm 11.21.2 содержит brace-expansion 5.0.12, glob 13.0.6, minimatch 10.2.5,
postcss-selector-parser 7.1.6, undici 6.29.1 и ip-address 10.7.5. Одного lockfile недостаточно.
Raw audit всё ещё сообщает два moderate advisory:

- [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4): после отмены glob может продолжать обход файловой системы.
- [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): недоверенный pattern при optimizationLevel >= 2 усиливает работу minimatch.

Они относятся к development release/npm graph. Package checks используют Bun pack, tar
и фиксированные пути; не принимают через release path недоверенные glob patterns и не
полагаются там на отмену обхода. Публикация заблокирована. Исправленные glob 14.0.2 и
minimatch 11.0.1 выходят за upstream major ranges; принудительного major override нет.
Два исключения привязаны к собственному lock hash, реальным bundle versions и сроку
2026-12-17T00:00:00Z. Изменение графа/истечение срока дают failure до пересмотра.
Это не нулевой raw audit.

Прямые `release` и `prepublishOnly` остаются заблокированы. Ручной workflow
prepare → QA → publish сохраняет один неизменяемый архив; см. [порядок выпуска](./docs/releasing.ru.md).
Выберите SemVer и закоммитьте финальные version/changelog до подготовки.
`release:dry-run` — только рекомендательный анализ. Нужны полный source-bound QA и явный
manual publish; успешные локальные checks сами по себе не разрешают публикацию.

## Привязка исходников consumer

Адаптер ограничен Sparkling 2.1.0-rc.36 / Lynx 3.9.0 с ReactLynx 0.125.0 и
`@lynx-js/types` 4.2.1. Исторический probe с ReactLynx 0.116.5/types 3.9 не соответствует
peer dependencies пакета: сохраните его и подготовьте отдельный candidate consumer.
Публичный диапазон peer dependencies не меняется.

Установите точный tarball кандидата, пересоздайте native registries Sparkling и разрешите
Gradle/Pods configuration. Задайте абсолютные `CONSUMER_ROOT` и `CONSUMER_TARBALL`.
`bun run check:consumer:bindings` проверяет установленные байты, оба набора compiler sources
и runtime graph Gradle, компилируемые registries, пути Pod lock, source/header phases Xcode,
линковку frameworks и регистрацию модуля. Учтены четыре Kotlin-файла и обе ObjC-реализации
с заголовками. Source filters Xcode, условные фильтры, includes и platform filters
не поддерживаются и блокируют проверку. Хеши исходников/конфигурации сверяются после сборки.

`bun run check:consumer` запускает JS build consumer, binding checks, Android Debug/Release
с R8 и iOS Debug/Release. Результат — `artifacts/consumer-build.json`; отдельная проверка
привязки пишет `artifacts/consumer-bindings.json`. Проверки физических устройств остаются
отдельным этапом. Helper адаптирован из проверенного secure-store commit `ef61633`;
негативные fixtures запускаются через `bun run test:tooling`, Ruby-проверки source filters —
перед чтением iOS-проекта.

CI-only iOS lock разрешает Lynx 3.9.0, LynxBase/LynxServiceAPI 4.0.3 и PrimJS
3.8.0-alpha.6. Этот fixture отделён от точного lock/profile consumer.
