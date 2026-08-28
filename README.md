# @lynx-lab/app-lifecycle

> **English** · [Русский](./README.ru.md)

[![npm](https://img.shields.io/npm/v/@lynx-lab/app-lifecycle?color=cb3837&logo=npm)](https://www.npmjs.com/package/@lynx-lab/app-lifecycle)
[![CI](https://github.com/PopLocker714/lynx-app-lifecycle/actions/workflows/ci.yml/badge.svg)](https://github.com/PopLocker714/lynx-app-lifecycle/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@lynx-lab/app-lifecycle?color=blue)](./LICENSE)

Foreground/background state for [Lynx](https://lynxjs.org) apps, plus page-visibility
events that cost no native code at all.

## Why this exists

Lynx has exactly four global events — `keyboardstatuschanged`, `onWindowResize`,
`exposure`, `disexposure` — and none of them is app lifecycle.

It *looks* like the signal is already there. `lynx-core` subscribes to
`MessageEventType.ON_APP_ENTER_FOREGROUND` on the core context and calls
`onAppEnterForeground()`, which is an empty "override by subclass" stub. Subscribing to
that event from JS works — I verified it on a device.

But it does not mean what the name says. Sparkling calls `onEnterForeground()` from
`onshow(params:)`, the **container visibility** callback, not from `UIApplication`
notifications ([`SPKWrapperLynxView.swift:383`](https://github.com/tiktok/sparkling)).
Backgrounding the whole app fires nothing. Verified: zero `__OnAppEnterBackground`
events across a real background transition.

So this package ships both:

| API | Means | Native code |
|---|---|---|
| `getAppState`, `subscribe`, `useAppState` | the **app** went to background or came back | yes |
| `subscribePageVisibility`, `usePageVisibility` | this **Lynx page** was shown or hidden | none |

If you are detecting "the user came back from their bank app to finish a payment",
you want the first one.

## Install

```sh
bun add @lynx-lab/app-lifecycle
```

**Android** — nothing else. No permissions, nothing merged into your manifest.

**iOS** — `pod install`.

## Usage

```tsx
import { useAppState, useAppStateChange } from '@lynx-lab/app-lifecycle/react'

function Checkout() {
  // re-renders on change
  const state = useAppState()

  // or react to the transition without re-rendering
  useAppStateChange((snapshot) => {
    if (snapshot.state === 'active') refetchPaymentStatus()
  })
}
```

Without React:

```ts
import { getAppState, subscribe } from '@lynx-lab/app-lifecycle'

const { state } = getAppState()
const off = subscribe(({ state }) => console.log(state))
```

### Thread requirement

`NativeModules` exists **only on the background (BTS) thread** and is `undefined` on the
main thread. Everything here must be called from the background thread.

**The trap:** in ReactLynx, code at **module scope runs on BOTH threads**. So this fails
every time, on the main thread half:

```ts
// ❌ top level of a file — also runs on the main thread
const { state } = getAppState()
```

Call it from inside a component, from an effect, or from anything that is background-thread
by construction. The hooks in `@lynx-lab/app-lifecycle/react` already handle this.

## API

| Function | What it does |
|---|---|
| `getAppState(): AppStateSnapshot` | Synchronous and authoritative. **This is how you get the initial value** |
| `subscribe(cb): Unsubscribe` | Transitions only. The callback's second argument is `true` when a generation gap says an event was lost |
| `subscribePageVisibility(cb): Unsubscribe` | Page shown/hidden. No native module needed |
| `useAppState(): AppState` | React hook, re-renders on change |
| `useAppStateChange(cb)` | React hook, callback only |
| `usePageVisibility(): PageVisibility` | React hook for page visibility |
| `setNativeModule(m)` | Test seam. `null` restores real lookup |

There is no `inactive` state. Android has no such thing, and promising identical
behaviour while not delivering it is worse than not promising it.

### Why the initial value comes from a getter, not a subscription

Lynx drops a global event when the runtime is not up yet, so the **first** state never
arrives by subscription. `getAppState()` reads native state directly and always works.
Every snapshot carries a monotonic `generation`; a gap means an event was lost.

## When the module is not found

The Lynx pipeline fails silently, so the error names both causes.

**Android** — `adb logcat | grep "Skip unavailable Lynx library provider"`. That means the
annotation processor did not run: the library declares
`kapt("org.lynxsdk.lynx:lynx-processor")` itself, because the Gradle plugin passes the
processor argument but never adds the processor.

**iOS** — check that `Pods/` has a generated autolink registry naming
`LynxAppLifecycleModule`. If not, the `@LynxNativeModule("...")` marker was not matched.

Manual fallback:

```kotlin
LynxEnv.inst().registerModule("LynxAppLifecycleModule", LynxAppLifecycleModule::class.java)
```

```objc
[config registerModule:LynxAppLifecycleModule.class];
```

## Implementation notes

**Android uses `ActivityLifecycleCallbacks`, not `ProcessLifecycleOwner`.** The latter
would pull `androidx.lifecycle:lifecycle-process` into someone else's build for thirty
lines of logic, and the Sparkling template is AGP 7.4.2 with Kotlin 1.8.10, where an extra
resolve is a real risk. Counting started activities gives the same answer with zero
dependencies. Rotation does not produce a false background because the new activity's
`onStart` runs before the old one's `onStop`, so the counter never reaches zero.

**iOS conforms to `LynxContextModule`.** That is not cosmetic: `CommonModuleCreator`
checks for exactly that protocol and then calls `initWithLynxContext:` itself, handing
over the `LynxContext`. Autolink registers modules **without** a param, so
`initWithParam:` is never called — without this protocol there is no context, and
therefore no `sendGlobalEvent`.

**The `LynxNativeModule` macro is defined under `#ifndef`.** It only exists from Lynx
3.9.0, and the `latest` Sparkling template still pins 3.6.0.

## License

MIT
