import { getNativeModule } from './native.js'
import { parseSnapshot } from './snapshot.js'
import type { AppStateSnapshot, PageVisibility, Unsubscribe } from './types.js'

export type { AppStateWire, LynxAppLifecycleNative } from './native.js'
export { setNativeModule } from './native.js'
export type {
    AppState,
    AppStateSnapshot,
    PageVisibility,
    Unsubscribe,
} from './types.js'

declare const lynx: {
    getJSModule?(name: string): {
        addListener(name: string, cb: (...args: unknown[]) => void): void
        removeListener(name: string, cb: (...args: unknown[]) => void): void
    } | null
    getCoreContext?(): {
        addEventListener(type: string, listener: (event: unknown) => void): void
        removeEventListener(type: string, listener: (event: unknown) => void): void
    } | null
}

let lastKnownGeneration = -1

/** Read the initialized native snapshot on the background thread. Throws when unavailable or malformed. */
export function getAppState(): AppStateSnapshot {
    'background only'
    const value: unknown = getNativeModule().getState()
    const snapshot = parseSnapshot(value)
    if (!snapshot) {
        throw new Error(
            '@lynx-lab/app-lifecycle: native state is unavailable or malformed. ' +
                'Ensure native lifecycle initialization has completed before reading the snapshot.'
        )
    }
    lastKnownGeneration = snapshot.generation
    return snapshot
}

/**
 * Subscribe to transitions on the background thread. Each listener owns its generation cursor.
 * The second callback argument is true when a generation gap indicates missed transitions.
 * Read the initial snapshot explicitly: events may be dropped before the JS emitter exists.
 */
export function subscribe(
    listener: (snapshot: AppStateSnapshot, missedEvents: boolean) => void
): Unsubscribe {
    'background only'
    const native = getNativeModule()
    const emitter = lynx.getJSModule?.('GlobalEventEmitter')
    if (!emitter) {
        throw new Error(
            '@lynx-lab/app-lifecycle: GlobalEventEmitter is unavailable, so this ' +
                'subscription is running on the main thread. Module scope in ReactLynx runs ' +
                'on both threads: call it from a component, from useEffect, or use the hooks ' +
                'from "@lynx-lab/app-lifecycle/react".'
        )
    }
    const eventName: unknown = native.getEventName()
    if (typeof eventName !== 'string' || eventName.length === 0) {
        throw new Error('@lynx-lab/app-lifecycle: native event name is malformed')
    }

    // Each subscriber owns its cursor. A getter or another listener must not consume its gap.
    let lastGeneration = lastKnownGeneration
    const handler = (...args: unknown[]): void => {
        const snapshot = parseSnapshot(args[0], true)
        if (!snapshot) return
        const missed = lastGeneration >= 0 && snapshot.generation > lastGeneration + 1
        lastGeneration = snapshot.generation
        lastKnownGeneration = snapshot.generation
        listener(snapshot, missed)
    }

    emitter.addListener(eventName, handler)
    return () => emitter.removeListener(eventName, handler)
}

/**
 * Observe this page's host CoreContext visibility events, without a native module.
 * Host page visibility is separate from application foreground/background state.
 */
export function subscribePageVisibility(
    listener: (visibility: PageVisibility) => void
): Unsubscribe {
    'background only'
    const core = lynx.getCoreContext?.()
    if (!core) {
        throw new Error(
            '@lynx-lab/app-lifecycle: lynx.getCoreContext() is unavailable, so this call ' +
                'is running on the main thread. Module scope in ReactLynx runs on both ' +
                'threads: call it from a component, from useEffect, or use the hooks from ' +
                '"@lynx-lab/app-lifecycle/react".'
        )
    }
    const onVisible = (): void => listener('visible')
    const onHidden = (): void => listener('hidden')

    core.addEventListener('__OnAppEnterForeground', onVisible)
    core.addEventListener('__OnAppEnterBackground', onHidden)

    return () => {
        core.removeEventListener('__OnAppEnterForeground', onVisible)
        core.removeEventListener('__OnAppEnterBackground', onHidden)
    }
}
