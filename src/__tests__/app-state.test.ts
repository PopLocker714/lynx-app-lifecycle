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
