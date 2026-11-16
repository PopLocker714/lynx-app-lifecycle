> **English** · [Русский](./README.ru.md)

# @lynx-lab/app-lifecycle

[![npm](https://img.shields.io/npm/v/@lynx-lab/app-lifecycle?color=cb3837&logo=npm)](https://www.npmjs.com/package/@lynx-lab/app-lifecycle)
[![CI](https://github.com/PopLocker714/lynx-app-lifecycle/actions/workflows/ci.yml/badge.svg)](https://github.com/PopLocker714/lynx-app-lifecycle/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@lynx-lab/app-lifecycle?color=blue)](./LICENSE)

App foreground/background state for Lynx, with a separate API for host page visibility.
Use app state to detect returning from a payment or authentication app. Page visibility
means that a Lynx container was shown or hidden; it is not interchangeable with app state.

## Platform support

| Capability | Android | iOS |
|---|---|---|
| App snapshot and transition subscriptions | Implemented | Implemented |
| Multiple Lynx contexts | Shared process state, per-context delivery | Shared process state, per-context delivery |
| `inactive` state | Not exposed | Not exposed; inactive maps to foreground |
| Page visibility | Host CoreContext events | Host CoreContext events |
| Native minimum | Declared API 23; minimum not device-verified | Declared iOS 12; minimum not device-verified |

This working revision is a **candidate**, not a completed stable verification profile.
Historical smoke and current checks are distinguished in [compatibility](docs/compatibility.md).
Lynx is the platform; Sparkling is the first consumer host. Other hosts require their own checks.

## Requirements and installation

React hooks declare `@lynx-js/react >=0.124.0`; the optional type peer is
`@lynx-js/types ^4.0.0`. Development uses ReactLynx 0.125.0. These are JS package
versions, separate from the host's native Lynx runtime. An older ReactLynx consumer
must not be marked verified merely because a native build succeeds.

```sh
bun add @lynx-lab/app-lifecycle
```

To evaluate this unpublished candidate, run `bun run check:package` in its checkout,
then install the exact `artifacts/app-lifecycle-<sha256>.tgz` in the consumer with `bun add`.
The npm badge describes the published version, not this branch.

**Android:** autolink registers the module; the merged manifest now includes a
non-exported initialization provider. No runtime permissions are requested. The
provider observes Activity startup before the first Activity. This replaces the old
lazy assumption that exactly one Activity was already active.

If your host removes the provider, initialize on the main thread before any Activity starts:

```kotlin
LynxAppLifecycleModule.initialize(application)
```

Late initialization cannot reconstruct Activities whose callbacks were missed.
Without initialization, `getAppState()` fails instead of reporting a guessed state.
Manual module registration is separate from process initialization.

**iOS:** install Pods using the host's normal CocoaPods command. The process observer
starts on the main queue. A read before bootstrap fails; no synchronous bridge call
waits on the main queue. App extensions and independent scene state are not supported.

## Usage

Call the core API from the Lynx background thread. Module scope also executes on the
main thread; an unguarded top-level native call is unsafe. Hooks preserve their
fallbacks when native state is unavailable and resynchronize after subscribing.

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

| API | Contract |
|---|---|
| `getAppState()` | Synchronous `{ state, generation }` from initialized native observation; throws on unavailable/malformed snapshot |
| `subscribe(listener)` | Transitions only; second argument reports a generation gap independently for each subscriber |
| `subscribePageVisibility(listener)` | `visible` / `hidden` from the host's CoreContext; no native module required |
| `useAppState()` | Reactive app state; initial fallback is `active` when native access fails |
| `useAppStateChange(listener)` | Transition callback; subscription errors retain the existing silent fallback |
| `usePageVisibility()` | Page visibility; initial fallback is `visible` |
| `setNativeModule(module)` | Test seam; `null` restores real lookup |

Subscriptions return an unsubscribe function. Read the initial snapshot explicitly;
Lynx can drop events before its JS emitter exists. Valid states are `active` and
`background`. Malformed events are ignored. Legacy events without generation deliver
`generation: -1` with `missedEvents: false`; the next known generation starts a new cursor.
A gap is measured from the subscriber's last event or the most recently known snapshot
when it subscribed. Calling the getter or another listener does not consume its gap.

Android keeps foreground state for up to **700 ms** after the last Activity stops for
configuration recreation. A new start cancels that grace; failed/slow recreation
settles to background. Ordinary last-Activity stops report background immediately.
This is a bounded policy, not a guarantee for arbitrarily slow recreation.

For installation diagnostics, native ownership, exact checks and contributions see:
[implementation](docs/implementation.md), [compatibility](docs/compatibility.md),
[contributing](CONTRIBUTING.md). License: [MIT](LICENSE).
