import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setNativeModule } from '../native.js'
import { useAppState } from '../react/index.js'
import { createFakeLifecycle } from '../testing/index.js'

const hooks = vi.hoisted(() => ({
    effects: [] as Array<() => undefined | (() => void)>,
    setState: vi.fn(),
}))

vi.mock('@lynx-js/react', () => ({
    useState: (initial: unknown) => [
        typeof initial === 'function' ? initial() : initial,
        hooks.setState,
    ],
    useEffect: (effect: () => undefined | (() => void)) => hooks.effects.push(effect),
}))

beforeEach(() => {
    hooks.effects.length = 0
    hooks.setState.mockReset()
})
afterEach(() => setNativeModule(null))

describe('useAppState effect lifecycle', () => {
    it('closes the transition gap between render and effect registration', () => {
        const fake = createFakeLifecycle()
        setNativeModule(fake)
        expect(useAppState()).toBe('active')
        fake.emit('background')
        const cleanup = hooks.effects[0]?.()
        expect(hooks.setState).toHaveBeenLastCalledWith('background')
        fake.emit('active')
        expect(hooks.setState).toHaveBeenLastCalledWith('active')
        expect(fake.listenerCount).toBe(1)
        cleanup?.()
        expect(fake.listenerCount).toBe(0)
        hooks.setState.mockClear()
        fake.emit('background')
        expect(hooks.setState).not.toHaveBeenCalled()
    })

    it('retains the documented fallback before native initialization and observes later readiness', () => {
        const fake = createFakeLifecycle()
        const original = fake.getState
        Object.defineProperty(fake, 'getState', {
            value: () => ({ error: 'NOT_INITIALIZED' }),
            configurable: true,
        })
        setNativeModule(fake)
        expect(useAppState()).toBe('active')
        const cleanup = hooks.effects[0]?.()
        expect(hooks.setState).not.toHaveBeenCalled()
        Object.defineProperty(fake, 'getState', { value: original })
        fake.emit('background')
        expect(hooks.setState).toHaveBeenLastCalledWith('background')
        cleanup?.()
        expect(fake.listenerCount).toBe(0)
    })
})
