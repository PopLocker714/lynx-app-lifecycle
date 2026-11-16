> **English** · [Русский](./compatibility.ru.md)

# Compatibility and verification

Support means Lynx plus explicitly verified hosts. Package peers, native compile SDK, runtime,
OS and toolchain are separate axes. This standard migration is a candidate; physical consumer
Debug/Release, minimum OS and an additional maintained profile remain unverified.

| Item | Evidence / status |
|---|---|
| Baseline package source | `b3dbc23`, package version 1.0.0; 14 JS tests/typecheck/build passed |
| Historical lifecycle smoke | Foreground/background observed; iOS evidence was simulator smoke, not physical Debug/Release |
| Current JS development | Bun 1.4.0, TS 5.9.3, Biome 2.5.9, ReactLynx 0.125.0, Lynx types 4.2.1 |
| Android compile profile | SDK 35 / min 23; Lynx compileOnly/processor 4.0.1; AGP 8.7.0, Kotlin 2.0.21, JDK 17 |
| iOS compile profile | Real Lynx 3.9.0 framework headers; deployment declaration 12.0; Xcode 27.2 locally |
| Native deterministic checks | JVM Activity tracker; macOS Foundation runs the actual iOS store with UIKit/Lynx test adapters |
| Candidate consumer | Must satisfy React peer >=0.124.0 and types ^4.0.0; older probe React 0.116.5 does not |
| Consumer status | Pending. Build success and adapter tests do not prove physical lifecycle, R8, or host linking |
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
