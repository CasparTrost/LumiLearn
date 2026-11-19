import { describe, it, expect, beforeEach } from 'vitest'

// a minimal localStorage for the node test environment
const store = new Map()
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
}
globalThis.window = globalThis
const { logError } = await import('../../src/lib/errorLog.js')
const { removeStore } = await import('../../src/hooks/safeStorage.js')
const log = () => JSON.parse(store.get('lumilearn_errors') ?? '[]')

describe('error log', () => {
  beforeEach(() => removeStore('lumilearn_errors'))
  it('keeps the newest first, at most 20', () => {
    for (let i = 0; i < 25; i++) logError(new Error(`boom ${i}`), 'maze')
    expect(log()).toHaveLength(20)
    expect(log()[0].message).toBe('boom 24')
    expect(log()[0].module).toBe('maze')
  })
  it('does not fill up with one error repeating', () => {
    for (let i = 0; i < 5; i++) logError(new Error('same'), 'clock')
    expect(log()).toHaveLength(1)
  })
  it('leaves out what is not a fault', () => {
    logError(new Error('The play() request was interrupted by a call to pause()'))
    logError(new Error('Failed to fetch dynamically imported module: x.js'))
    logError(new Error('ResizeObserver loop completed with undelivered notifications.'))
    expect(log()).toHaveLength(0)
  })
  it('survives a broken log', () => {
    store.set('lumilearn_errors', '{not json')
    logError(new Error('after'))
    expect(log()[0].message).toBe('after')
  })
})
