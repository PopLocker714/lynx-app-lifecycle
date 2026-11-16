import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAppState, setNativeModule, subscribe } from '../index.js'
import { createFakeLifecycle } from '../testing/index.js'

afterEach(() => setNativeModule(null))

describe('getAppState', () => {
    it('читает синхронно и авторитетно', () => {
        setNativeModule(createFakeLifecycle('background'))
        expect(getAppState()).toEqual({ state: 'background', generation: 0 })
    })

    it('без нативного модуля падает с внятным текстом про BTS', () => {
        setNativeModule(null)
        expect(() => getAppState()).toThrowError(/BTS/)
    })

    it('текст ошибки называет и причину, и выход', () => {
        setNativeModule(null)
        let message = ''
        try {
            getAppState()
        } catch (e) {
            message = (e as Error).message
        }
        // причина
        expect(message).toMatch(/main thread/)
        // почему это случилось именно здесь
        expect(message).toMatch(/MODULE SCOPE|BOTH threads/)
        // что делать
        expect(message).toMatch(/useEffect/)
        expect(message).toMatch(/app-lifecycle\/react/)
    })
})

describe('subscribe', () => {
    it('доставляет переход', () => {
        const fake = createFakeLifecycle('active')
        setNativeModule(fake)
        const seen: string[] = []
        const off = subscribe((s) => seen.push(s.state))
        fake.emit('background')
        fake.emit('active')
        expect(seen).toEqual(['background', 'active'])
        off()
    })

    it('отписка снимает слушателя', () => {
        const fake = createFakeLifecycle('active')
        setNativeModule(fake)
        const off = subscribe(() => {})
        expect(fake.listenerCount).toBe(1)
        off()
        expect(fake.listenerCount).toBe(0)
    })

    it('одно и то же состояние не порождает события', () => {
        const fake = createFakeLifecycle('active')
        setNativeModule(fake)
        const cb = vi.fn()
        const off = subscribe(cb)
        fake.emit('active')
        expect(cb).not.toHaveBeenCalled()
        off()
    })

    it('разрыв поколения помечается как пропуск', () => {
        const fake = createFakeLifecycle('active')
        setNativeModule(fake)
        getAppState() // зафиксировали поколение 0
        const missed: boolean[] = []
        const off = subscribe((_s, m) => missed.push(m))
        fake.emitSkipping('background', 3)
        expect(missed).toEqual([true])
        off()
    })

    it('последовательные поколения пропуском не считаются', () => {
        const fake = createFakeLifecycle('active')
        setNativeModule(fake)
        getAppState()
        const missed: boolean[] = []
        const off = subscribe((_s, m) => missed.push(m))
        fake.emit('background')
        fake.emit('active')
        expect(missed).toEqual([false, false])
        off()
    })

    it('мусорный payload игнорируется, а не роняет', () => {
        const fake = createFakeLifecycle('active')
        setNativeModule(fake)
        const cb = vi.fn()
        const off = subscribe(cb)
        fake.emitRaw(undefined)
        fake.emitRaw(null)
        fake.emitRaw({})
        fake.emitRaw({ state: 42 })
        fake.emitRaw('строка')
        expect(cb).not.toHaveBeenCalled()
        // и после мусора подписка всё ещё жива
        fake.emit('background')
        expect(cb).toHaveBeenCalledTimes(1)
        off()
    })

    it('payload без generation не считается пропуском', () => {
        const fake = createFakeLifecycle('active')
        setNativeModule(fake)
        const missed: boolean[] = []
        const off = subscribe((_s, m) => missed.push(m))
        fake.emitRaw({ state: 'background' })
        expect(missed).toEqual([false])
        off()
    })
})

describe('snapshot and listener boundaries', () => {
    it('reports a gap independently to every subscriber', () => {
        const fake = createFakeLifecycle()
        setNativeModule(fake)
        getAppState()
        const first = vi.fn()
        const second = vi.fn()
        const offFirst = subscribe(first)
        const offSecond = subscribe(second)
        fake.emitSkipping('background', 3)
        expect(first).toHaveBeenCalledWith({ state: 'background', generation: 3 }, true)
        expect(second).toHaveBeenCalledWith({ state: 'background', generation: 3 }, true)
        offFirst()
        offSecond()
    })

    it('a snapshot read in one callback cannot consume another subscriber gap', () => {
        const fake = createFakeLifecycle()
        setNativeModule(fake)
        getAppState()
        const offFirst = subscribe(() => getAppState())
        const second = vi.fn()
        const offSecond = subscribe(second)
        fake.emitSkipping('background', 4)
        expect(second).toHaveBeenCalledWith({ state: 'background', generation: 4 }, true)
        offFirst()
        offSecond()
    })

    it.each([
        { state: 'invalid', generation: 1 },
        { state: 'active', generation: NaN },
        { state: 'active', generation: Infinity },
        { state: 'active', generation: -2 },
        { state: 'active', generation: 0.5 },
        { state: 'active', generation: Number.MAX_SAFE_INTEGER + 1 },
        { state: 'active', generation: '1' },
        { state: 'active', generation: null },
    ])('ignores invalid event %# without consuming the cursor', (payload) => {
        const fake = createFakeLifecycle()
        setNativeModule(fake)
        getAppState()
        const listener = vi.fn()
        const off = subscribe(listener)
        fake.emitRaw(payload)
        expect(listener).not.toHaveBeenCalled()
        fake.emitSkipping('background', 3)
        expect(listener).toHaveBeenCalledWith({ state: 'background', generation: 3 }, true)
        off()
    })

    it.each([
        null,
        {},
        { error: 'NOT_INITIALIZED' },
        { state: 'active' },
        { state: 'invalid', generation: 0 },
        { state: 'active', generation: NaN },
    ])('rejects an unavailable or malformed synchronous snapshot %#', (value) => {
        // The bridge is an untyped transport; this stub intentionally violates its TS contract.
        const fake = createFakeLifecycle()
        const getState = vi.fn(() => value)
        Object.defineProperty(fake, 'getState', { value: getState })
        setNativeModule(fake)
        expect(() => getAppState()).toThrow(/unavailable or malformed/)
    })

    it('preserves the missing-generation sentinel and resets gap tracking', () => {
        const fake = createFakeLifecycle()
        setNativeModule(fake)
        getAppState()
        const listener = vi.fn()
        const off = subscribe(listener)
        fake.emitRaw({ state: 'background' })
        expect(listener).toHaveBeenLastCalledWith({ state: 'background', generation: -1 }, false)
        fake.emitSkipping('background', 8)
        expect(listener).toHaveBeenLastCalledWith({ state: 'background', generation: 8 }, false)
        off()
    })
})

it.each([undefined, null, '', 42])('rejects malformed native event name %#', (value) => {
    const fake = createFakeLifecycle()
    Object.defineProperty(fake, 'getEventName', { value: () => value })
    setNativeModule(fake)
    expect(() => subscribe(() => {})).toThrow(/event name is malformed/)
    expect(fake.listenerCount).toBe(0)
})
