[English](./releasing.md) · [Русский](./releasing.ru.md)

# Выпуск неизменяемого архива

Публикация ручная и недоступна без финальной версии, полного QA и удалённых настроек.
Локальные `release` / `prepublishOnly` намеренно завершаются ошибкой. `release:dry-run`
делает только анализ semantic-release и не разрешает выпуск. Версия автоматически не
меняется; pipeline не создаёт Git tag или GitHub release.

## Предварительные условия

Закоммитьте финальную stable-версию в `package.json` и её заголовок в `CHANGELOG.md` на main.
Небольшой модуль `scripts/release` отвечает только за filesystem/CLI; API и native код пакета
от него не зависят. `release/policy.json` задаёт обязательные проверки. Изменение policy
проходит review до подготовки кандидата.

Настройте npm Trusted Publishing для этого репозитория и **release.yml**. Publish job
использует GitHub environment **npm-release**; дополнительные reviewers/branch protections
настраиваются при необходимости политикой репозитория. Явный manual dispatch авторизованным
maintainer является согласованием выпуска; второй reviewer инструментом не требуется.
Администраторы контролируют настройки и workflow. Долгоживущих npm
токенов нет. Локальные unit tests не подтверждают эти настройки или запуск в GitHub.
Workflow использует GitHub-hosted runners, Node 22.14.0 и npm 11.21.2, установленный Bun из lockfile.

Установка, scripts и упаковка выполняются Bun. Единственный npm adapter публикует принятый
`.tgz` через Node: Bun пока не умеет генерировать provenance. Явно заданы
`NPM_CONFIG_PROVENANCE=true` и `--provenance`; `--ignore-scripts` исключает lifecycle-упаковку
и выполнение scripts при публикации.

## Подготовка, проверка, публикация

1. Запустите **Release → stage=prepare** на main. Reusable CI проверяет тот же commit:
   JS/package, зависимости, Android и iOS. После зелёного CI подготовка отвергает dirty,
   private и development-version source, один раз упаковывает через `check:package`,
   проверяет эти байты и сохраняет artifact **release-candidate** на 90 дней. В нём
   `package.tgz` и `manifest.json`: имя, версия, source commit, SHA256, hash policy,
   репозиторий и prepare run ID. Другие tarball из CI не являются release-кандидатами.
2. Скачайте **release-candidate** именно из этого run. Установите `package.tgz` в locked host
   fixture и выполните обязательный consumer/device QA. Для проверки готового архива без
   переупаковки: `RELEASE_TARBALL=/absolute/package.tgz bun run check:package`.
   Native-source-binding и Debug/Release device QA выполняются отдельно от mocked smoke
   упакованного API. Минимальные ОС и критичные сценарии должны быть действительно проверены.
3. Закоммитьте на main `release/qa.json` и непустые evidence в `release/evidence/`. Перенесите
   identity из manifest, вычислите SHA256 файлов evidence. После подготовки не меняйте
   package/runtime/docs/workflow: изменения за пределами receipt/evidence требуют нового
   prepare run. Evidence должны быть tracked, иметь относительные пути внутри checkout и
   совпадающие hashes. Секреты и тестовые токены не коммитить.
4. Запустите **Release → stage=publish** на main с **prepare_run_id** и принятым **sha256**.
   Gate проверяет GitHub run provenance (repo/workflow/event/main/success/source ancestry),
   manifest и байты tarball, неизменность source, policy исходного commit и полный QA.
   Отдельный publish job повторяет gate и публикует скачанный
   `package.tgz`, не вызывая pack/build/semantic-release. CI относится к успешному prepare
   run, а не к другому commit.
5. После публикации проверьте registry/provenance. Существующие name/version нельзя заменить.
   Если публикация прошла, но ответ потерялся, сначала проверьте registry. После истечения
   artifact подготовьте новый кандидат и заново подтвердите identity; нельзя восстановить
   архив и молча применить старый receipt.

## Контракт QA receipt

Receipt — проверенное утверждение названного ответственного, а не криптографическое
доказательство тестирования телефона. Hashes защищают identity и подмену по ошибке.
Reviewer проверяет содержание evidence и реальный профиль. Для каждого ID из
`release/policy.json.requiredChecks` нужна ровно одна строка pass с непустым profile и
списком evidence. Любая дополнительная nonpassing строка или непустой `gaps` блокирует выпуск.
В device evidence указывают host/runtime/ReactLynx, ОС/устройство, конфигурацию и hashes
артефактов. `native-source-bindings` доказывает реальные installed native roots; minimum
проверки покрывают заявленный нижний порог ОС. Independent review фиксирует findings/resolution.

Пример формы — **не подтверждение выпуска**, все placeholders заменяются фактическими данными:

```json
{
    "schemaVersion": 1,
    "name": "@lynx-lab/app-lifecycle",
    "version": "<final version>",
    "sourceCommit": "<40 hex source commit>",
    "sha256": "<64 hex tarball SHA256>",
    "prepareRunId": "<prepare run ID>",
    "acceptedBy": "<responsible reviewer>",
    "acceptedAt": "<ISO date>",
    "gaps": [],
    "checks": [
        {
            "id": "android-release-r8",
            "status": "pass",
            "profile": "<host/runtime, Android version/device, Release/R8>",
            "evidence": [
                { "path": "release/evidence/android-release.json", "sha256": "<64 hex>" }
            ]
        }
    ]
}
```

Повторное использование device QA при изменении только документации допустимо после явного
сравнения старого и нового архивов: сохраните прежний evidence и hashed equivalence report,
доказывающий неизменность runtime/native/declarations, назовите оба hash и объясните scope
в evidence нового receipt. Не представляйте старые прогоны как проверку нового tarball.
Изменения версии/metadata/runtime требуют применимых проверок; equivalence report не
закрывает критичные пробелы. Настоящий QA receipt автоматически не создаётся и сюда не включён.

## Источники

- [Bun: публикация и ограничение provenance](https://bun.sh/docs/pm/cli/publish)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [GitHub: скачивание artifacts](https://github.com/actions/download-artifact)
- [GitHub environment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)

Перед публикацией job повторяет `check:audit`: новые advisories и истёкшие исключения
блокируют выпуск даже пока prepare artifact ещё хранится. npm adapter находит существующую
проверенную зависимость semantic-release → @semantic-release/npm → npm 11.21.2, проверяет
точную версию и вызывает только CLI-публикацию готового tarball.

## Завершение Git identity после публикации

После подтверждения registry/provenance создайте version tag на точном
`manifest.sourceCommit`, а не на более позднем QA commit. Существующий tag должен указывать
туда же; не переносите его и не используйте force push. Push tag/GitHub release выполняется
только при явном разрешении выпуска. Это ручное завершение необходимо native podspec source
URL с version tag; workflow его не выполняет. SemVer выбирают и коммитят version/changelog до prepare.
