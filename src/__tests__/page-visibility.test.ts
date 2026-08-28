import { afterEach, describe, expect, it } from 'vitest'
import { setNativeModule, subscribePageVisibility } from '../index.js'
import { createFakeLifecycle } from '../testing/index.js'

afterEach(() => setNativeModule(null))

describe('subscribePageVisibility', () => {
  it('доставляет обе стороны видимости страницы', () => {
    const fake = createFakeLifecycle()
    const seen: string[] = []
    const off = subscribePageVisibility((v) => seen.push(v))
    fake.emitCore('__OnAppEnterForeground')
    fake.emitCore('__OnAppEnterBackground')
    fake.emitCore('__OnAppEnterForeground')
    expect(seen).toEqual(['visible', 'hidden', 'visible'])
    off()
  })

  it('подписывается ровно на два события CoreContext', () => {
    const fake = createFakeLifecycle()
    const off = subscribePageVisibility(() => {})
    expect(fake.coreListenerCount('__OnAppEnterForeground')).toBe(1)
    expect(fake.coreListenerCount('__OnAppEnterBackground')).toBe(1)
    off()
    expect(fake.coreListenerCount('__OnAppEnterForeground')).toBe(0)
    expect(fake.coreListenerCount('__OnAppEnterBackground')).toBe(0)
  })

  it('нативного модуля не требует вообще', () => {
    const fake = createFakeLifecycle()
    setNativeModule(null)
    const seen: string[] = []
    const off = subscribePageVisibility((v) => seen.push(v))
    fake.emitCore('__OnAppEnterBackground')
    expect(seen).toEqual(['hidden'])
    off()
  })

  it('без getCoreContext падает с внятным текстом', () => {
    const g = globalThis as Record<string, unknown>
    const saved = g.lynx
    g.lynx = {}
    expect(() => subscribePageVisibility(() => {})).toThrowError(
      /getCoreContext/
    )
    g.lynx = saved
  })
})
