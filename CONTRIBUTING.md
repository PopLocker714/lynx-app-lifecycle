> **English** · [Русский](./CONTRIBUTING.ru.md)

# Contributing

This package applies Lynx Lab package standard v1 (`b7afc39`, with consumer-binding
requirements from `ca5d237`). Keep the small TS facade → native adapters structure and
separate React hooks/testing entrypoints. Public JS signatures are preserved. Separate
mechanical formatting from behavior changes; review native ownership and every bridge input.
Do not claim a device/host/version verified from a mock or standalone compile.

## Tools and fast checks

Bun 1.4.0, TypeScript 5.9.3, Biome 2.5.9; 4 spaces, 100 columns. YAML keeps 2 spaces.
Install with `bun install --frozen-lockfile`. Prefer the shared Bun isolated store; verify
local overrides before changing linker behavior. Check free space before installs/builds:
start at 15 GiB for dependency installation, 25 GiB for unknown native build peaks, retain
at least 10 GiB afterwards. Serialize heavy work when another agent owns the build queue.

| Command | Checks |
|---|---|
| `bun run check` | Lint with warnings as errors, strict runtime/test TS, declaration compatibility control, tests, build, real tarball |
| `bun run check:audit` | Raw graph plus exact temporary exceptions and actual npm bundle versions |
| `bun dedupe --check` / `bun pm licenses` | Duplicate resolutions / dependency license inventory |
| `bun run format` / `bun run format:native` | TS/JSON and own Kotlin/ObjC formatting |
| `bun run check:android` | ktlint, own Kotlin warnings-as-errors, JVM tests, Debug/Release compile and Android Lint |
| `bun run check:ios` | clang-format, macOS deterministic store harness, iOS arm64 compile and Clang analysis using real consumer framework headers |
| `bun run check:ios:store` | Actual store implementation with UIKit/Lynx adapters on macOS; no device proof |
| `bun run check:package` | Actual Bun archive, exports/files/autolink/docs/import smoke and compiled README examples, repeatable receipt |
| `bun run check:types-compat` | Version/expiry and negative control for the upstream missing declaration |

`check:package` runs prepack build. It writes `artifacts/package-evidence.json` and a
SHA256-named archive, not `package.json` inside artifacts (which changes Node package scope).
Core/testing entries are imported directly; React hooks require their real Lynx consumer.
No source-only symlink proves packaged installation. Consumer Debug/Release/device acceptance
and exact native source binding are separate from these local package checks.

Native tools are pinned: ktlint 1.7.1 (SHA256 verified) and clang-format 21.1.8.
Set `JAVA_HOME` to JDK 17, `ANDROID_HOME` to the installed SDK; standalone uses compileSdk 35.
`KTLINT_JAR` may point to a verified existing jar; otherwise the script downloads into `.tools`.
Install clang-format locally, for example a Python venv `.tools/clang-format` with
`pip install clang-format==21.1.8`, or set `CLANG_FORMAT` to that exact executable.

Set `LYNX_FRAMEWORKS_DIR` to a locked consumer's `Build/Products/Debug-iphoneos` containing
`Lynx/Lynx.framework` and its dependency frameworks. `check:ios` uses those real SDK headers;
it does not mock headers for the standalone compile. Only the explicitly separate macOS
store test uses adapters. The `ios-check` CI fixture pins Lynx 3.9.0 and builds SDK/frameworks
before analysis. Its full CI build has not been executed locally; local analysis used existing
consumer frameworks. Generated Xcode projects/Pods/builds are reproducible local outputs.

## Scoped compatibility exceptions

Owner for these exceptions: **Lynx Lab**. Review by **2026-12-16**, remove or reassess before
updating the relevant dependencies or enabling a release. `skipLibCheck` stays false.

- ReactLynx 0.125.0 references `ElementNode` but omits its declaration from npm. The dev-only
  `types/reactlynx-0.125.d.ts` restores the exact one-line declaration from
  [upstream db8f978](https://github.com/lynx-family/lynx-stack/blob/db8f978aba9b2e896a71d835ebcb0f2dcc9b68c2/packages/react/runtime/src/worklet-runtime/types/elementApi.d.ts#L4),
  tag `@lynx-js/react@0.125.0`, under [Apache-2.0](https://github.com/lynx-family/lynx-stack/blob/db8f978aba9b2e896a71d835ebcb0f2dcc9b68c2/LICENSE).
  The negative control removes it in memory and confirms the original missing-name diagnostic.
  It is included explicitly by package development configs, excluded from the published archive,
  and does not appear in public declarations. The guard expires 2026-12-17T00:00:00Z.
- ReactLynx's declaration exports React 18 names removed by React 19 types. Development pins
  `@types/react 18.3.28`, within its declared `^18 || ^19` peer. The unchanged package peer
  does not prove every React/host combination. Its aliased internal-preact imports itself as
  `preact`; a dev alias to the exact upstream version and TS `paths` resolves that self-import
  under isolated storage. No application runtime dependency or handwritten substitute API is added.
- `@lynx-js/types` 4.2.1 includes a legacy `react.JSX` augmentation that conflicts with
  React 18 DOM input refs and shadows Lynx `SVGProps` during hoisted installs. The dev-only
  Apache-2.0 patch removes that augmentation; all exported Lynx element types remain intact.
  ReactLynx 0.125 uses its own `@lynx-js/react/jsx-runtime` JSX namespace. A strict fixture
  verifies native input/SVG types and keeps DOM and native refs distinct. The compatibility
  check binds the patch to the exact version and declaration SHA256. Reassess on either Lynx
  types or ReactLynx upgrade; remove when upstream separates these JSX namespaces correctly.
  This root development patch is not shipped to or applied in consumer installations; those
  must verify their own renderer/type profile. Both hoisted and isolated development layouts
  are checked with `skipLibCheck: false`. No dependency resolution or runtime byte changes.
- Standalone KGP 2.0.21 kapt falls back to language 1.9. The opt-in strict check sets 1.9 only
  for that check; host defaults stay unchanged. Third-party annotation processor RELEASE_8/source11
  and installed SDK XML tool-version diagnostics are recorded in native logs; own Kotlin/Clang/Lint
  warnings remain errors. The annotation 1.9.1 dependency has a targeted GradleDependency
  suppression to retain the previously supported host profile pending a separate host upgrade.

## Supply-chain and publication

Compatible dev-tool updates were checked independently for this package. The resolved npm
11.21.2 physical bundle contains brace-expansion 5.0.12, glob 13.0.6, minimatch 10.2.5,
postcss-selector-parser 7.1.6, undici 6.29.1 and ip-address 10.7.5. Lock entries alone are not proof.
Raw audit still reports two moderate advisories:

- [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4): glob cancellation can leave filesystem traversal running.
- [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): attacker-controlled patterns with optimizationLevel >= 2 can amplify minimatch work.

They occur in the development release/npm graph. Package checks use Bun pack, tar and fixed
paths, with no untrusted glob patterns or cancellation assumption through that release path.
Publication remains blocked. The fixed glob 14.0.2/minimatch 11.0.1 cross upstream major ranges;
no forced major override is applied. The two exceptions are bound to this package's lock hash,
physical bundle versions and expiry 2026-12-17T00:00:00Z. Changed graph/expiry must fail until
reassessed; this is not a zero-findings raw audit.

Direct `release` and `prepublishOnly` remain blocked. The manual prepare → QA → publish
workflow now preserves one immutable archive; see [Releasing](./docs/releasing.md).
Choose SemVer explicitly and commit the final version/changelog before preparation.
`release:dry-run` provides advisory analysis only. Complete source-bound QA and explicit
manual publish approval are required; passing local checks does not authorize publication.

## Consumer source binding

The consumer adapter is limited to Sparkling 2.1.0-rc.36 / Lynx 3.9.0 with
ReactLynx 0.125.0 and `@lynx-js/types` 4.2.1. The historical probe's ReactLynx
0.116.5/types 3.9 profile does not satisfy this package's peers; preserve it and
prepare a separate candidate consumer. The public peer range is unchanged.

Install the exact candidate tarball into that consumer, regenerate Sparkling's native
registries, then resolve its Gradle/Pods configuration. Set `CONSUMER_ROOT` and
`CONSUMER_TARBALL` to absolute paths. `bun run check:consumer:bindings` validates
installed bytes, both Gradle compiler source sets/runtime graph and compiled registries,
Pod lock paths, Xcode source/header phases, framework linkage and registry registration.
It includes all four Kotlin sources and both Objective-C implementations/headers.
Xcode source filters, conditional filters, includes and platform filters are unsupported
and fail closed. Source/configuration hashes are recorded and rechecked after compilation.

`bun run check:consumer` runs the host JS build, binding checks, Android Debug/Release
with R8, and iOS Debug/Release. It writes `artifacts/consumer-build.json`; binding-only
runs write `artifacts/consumer-bindings.json`. Both are distinct from physical-device QA.
The helper was adapted from reviewed secure-store commit `ef61633`; its negative
fixtures run via `bun run test:tooling`, and Ruby source-filter checks run before iOS inspection.

The CI-only iOS lock currently resolves Lynx 3.9.0, LynxBase/LynxServiceAPI 4.0.3,
and PrimJS 3.8.0-alpha.6. This fixture is separate from the consumer's exact lock/profile.

The primary compiler is Xcode 27.2 locally and on the `xcode-27` GitHub image.
The locked `ios-check` fixture uses
`IPHONEOS_DEPLOYMENT_TARGET=15.0` for its build because this Xcode rejects older
transitive Pod targets. This fixture override does not change the library podspec
or verify the declared iOS 12 minimum. Record macOS/SDK versions with each run.
The pinned Lynx 3.9 fixture retains `c99-designator` and `deprecated-declarations`
diagnostics as warnings only in target Lynx. `unused-result` is downgraded only in
`parallel_parse_task_scheduler.cc` and `LynxTemplateRender.mm`, and
`deprecated-implementations` only in `LynxTextLayoutManager.m`. These exceptions
come from compiling the locked SDK with Xcode 27.2; see `ios-check/Podfile`.
Our module checks retain `-Werror`; no warning is suppressed and no runtime source
is changed. Owner: Lynx Lab; observed 2026-11-18; reassess by 2026-12-18 or when
changing Lynx/Xcode, before merge if the exception has expired.
