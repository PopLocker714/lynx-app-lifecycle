> **English** · [Русский](./implementation.ru.md)

# Implementation and native integration

## Ownership and threading

The TS facade validates snapshots/events at the untyped bridge boundary. Each subscription
owns a generation cursor; reading a snapshot or notifying another subscription cannot consume
its missing-event signal. Hooks resynchronize after registering their effect subscription.
Their existing `active` / `visible` fallback and suppressed subscription errors are retained.

Android observes `Application.ActivityLifecycleCallbacks` from a manifest provider before
Activity startup. The process store survives module destruction. Activity tracking runs on
main; an immutable volatile snapshot makes state and generation one read from BTS. Listener
registration/removal is synchronized, delivery uses a copied list, and module destruction
marks its listener inactive before removal. The started set contains only currently started
Activity instances. Duplicate callbacks cannot underflow a counter.

A final `onStop` with `isChangingConfigurations` keeps foreground for a bounded 700 ms.
The next start cancels the timer; an ordinary final stop updates immediately. On timeout with
no replacement, background is emitted. This takes the AndroidX delay principle without
adding its dependency or delaying ordinary background transitions. Recreation exceeding the
grace can produce background/active. It is not equivalent to every ProcessLifecycleOwner state.
See [Android recreation](https://developer.android.com/guide/topics/resources/runtime-changes)
and [ProcessLifecycleOwner](https://developer.android.com/reference/androidx/lifecycle/ProcessLifecycleOwner).

The iOS process store starts from `+load` by asynchronously scheduling main-queue observation.
It reads `UIApplication.applicationState` there and listens to launch/active/background notifications
for the process lifetime, including periods with no modules. A lock protects an immutable
snapshot and the weak context registry; no getter synchronously waits for main. The initial
cache contains `NOT_INITIALIZED`, which the JS facade reports as an error. Once initialized,
non-background initial UIApplication state maps to `active`; intermediate inactive notifications
are not exposed. Every live context receives each transition's same generation. Destroyed
contexts are removed; the registry does not own them. A queued event may still be dropped by
Lynx after view destruction. Scene-specific lifecycle and app extensions are outside support.
See [Apple applicationState](https://developer.apple.com/documentation/uikit/uiapplication/applicationstate).

## Host integration and diagnostics

If native lookup fails, verify Android kapt/autolink generated registration and the iOS generated
registry for `LynxAppLifecycleModule`. Registering a module manually is possible:

```kotlin
LynxEnv.inst().registerModule("LynxAppLifecycleModule", LynxAppLifecycleModule::class.java)
```

```objc
[config registerModule:LynxAppLifecycleModule.class];
```

On Android this does not replace process initialization. Keep `AppLifecycleInitProvider`,
or call `LynxAppLifecycleModule.initialize(application)` on main before all Activities.
If a brownfield host integrates only after Activities start, accurate initial aggregate state
cannot be reconstructed; arrange startup integration first. Changing the process provider is
an installation change and must be checked in the merged manifest and Release/R8 consumer.
The provider has no exported data operations or permission requests.

The iOS class conforms to the real `LynxContextModule` protocol so autolink can supply context.
Synchronous methods preserve NSDictionary return values and ARC-neutral selector names.
Native API registration and store observation have separate lifetimes.

Page events come from the consumer's CoreContext. Historical Sparkling observation showed
container visibility rather than process foreground/background; this is not a claim about every
Lynx host or future host release. Both subscriptions return cleanup functions.

## Provenance

The Activity state tracker and iOS store are implemented locally. The Android provider layout
follows Lynx Lab edge-to-edge's early initialization pattern; its per-view inset store is not reused.
Android/Apple sources above informed lifecycle contracts. No upstream native implementation
was copied wholesale. The development-only missing ElementNode declaration is copied from
Lynx upstream; its exact revision and license are recorded in [contributing](../CONTRIBUTING.md).
