> **English** · [Русский](./compatibility.ru.md)

# Compatibility and verification

Support means Lynx plus explicitly verified hosts. Package peers, native compile SDK, runtime,
OS and toolchain are separate axes. This standard migration is a candidate; physical consumer
Debug/Release passed on one recorded profile; minimum OS and an additional maintained profile remain unverified.

| Item | Evidence / status |
|---|---|
| Baseline package source | `b3dbc23`, package version 1.0.0; 14 JS tests/typecheck/build passed |
| Historical lifecycle smoke | Foreground/background observed; iOS evidence was simulator smoke, not physical Debug/Release |
| Current JS development | Bun 1.4.0, TS 5.9.3, Biome 2.5.9, ReactLynx 0.125.0, Lynx types 4.2.1 |
| Android compile profile | SDK 35 / min 23; Lynx compileOnly/processor 4.0.1; AGP 8.7.0, Kotlin 2.0.21, JDK 17 |
| iOS compile profile | Real Lynx 3.9.0 framework headers; deployment declaration 12.0; Xcode 27.2 locally |
| Native deterministic checks | JVM Activity tracker; macOS Foundation runs the actual iOS store with UIKit/Lynx test adapters |
| Candidate consumer | Must satisfy React peer >=0.124.0 and types ^4.0.0; older probe React 0.116.5 does not |
| Consumer status | Accepted for the exact profile/scenarios recorded below; remaining device gaps are explicit |
| Release | Blocked until final version/changelog → immutable tarball → consumer QA → publish same tarball |

Required consumer acceptance: exact archive/installed-file/native-source binding, Debug/Release
on Android and iOS (Android R8), two simultaneous contexts, destroyed/recreated LynxView,
initialization while backgrounded, normal foreground/background, Activity recreation within
and beyond the 700 ms grace, multiple Activities, missing provider with manual startup init,
React render/effect transition gap and unsubscribe. Test page visibility separately from app state.
Minimum SDK/runtime range and independent-scene behavior are not inferred from a current device.

Machine receipts in `artifacts/` record the source commit, clean status and exact tarball SHA256.
Consumer evidence must additionally identify its commit/lock, ReactLynx/native runtime versions,
bundle hash, toolchain, OS/device, build variants and actual scenarios. GitHub CI has not been
run for this working branch; local checks do not imply remote workflow success.

For host upgrades preserve the previous verified profile, install the old tarball into a locked
candidate host, locate package versus host regressions, fix/review/retest affected behavior,
then verify the previous maintained profile. Update the matrix only from real results. Removing
support is a breaking change. A docs-only verification update does not require an npm release.

## Recorded consumer acceptance (2026-11-17)

Source `87a7b93`, tarball `c8cabd693d35b308b53aa166e7644b8c5b555e78fd8dc4b1daa936e452b93529`, passed physical Pixel 9 / Android 17 and iPhone 11 / iOS 18.4.1 Debug/Release, Android R8. Profile: Sparkling 2.1.0-rc.36 / Lynx 3.9.0, ReactLynx 0.125.0 / types 4.2.1 / Rsbuild 2.1.10. Two JS subscribers receive matching generations through background/resume; unsubscribe and resubscribe passed. Separate Android instrumentation proves initial background/0 before any Activity, real Activity recreation with a new instance and one started Activity, and background on close. It does not represent two physical Lynx views.

Evidence: probe source `616c66a`, evidence `51ae596`, `docs/evidence/lifecycle-2026-11-17/results.json` (68 indexed files); main bundle `69a1c6861341bfaf3fb7f63479ed5a2dd265eaa31ee70ad98bc44aea22c8d01d`. The host retains three baseline TS errors and one obsolete App test failure. Metadata-only patch `3cb55f3` declares React testing-library's missing optional Vitest peer; 692 runtime files are unchanged. Minimum OS, physical multi-view/scene teardown, manual init without provider, slow recreation beyond the grace and page-visibility device scenarios are not proven by this smoke. Adapter evidence is separate.

This documentation-only update does not change the tested runtime. Archive hashes above identify earlier exact artifacts; newly packed documentation gets a new hash.
