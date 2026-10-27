import { useEffect, useState } from 'react'

// localStorage that never takes the app down.
//
// With storage blocked (older Safari in private mode, cookie blockers, some
// embedded WebViews) every access throws a SecurityError. MusicControls read
// it unguarded while rendering, and the whole app stayed white. Everything
// that keeps a small setting goes through these helpers; when storage is
// unavailable the value lives in memory for this visit.

const memory = new Map()

export function readStore(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key)
    if (v !== null) return v
  } catch { /* blocked: fall through to memory */ }
  return memory.has(key) ? memory.get(key) : fallback
}

/** Returns false if the value could not be written to the browser. */
export function writeStore(key, value) {
  memory.set(key, String(value))
  try { window.localStorage.setItem(key, String(value)); return true } catch { return false }
}

export function removeStore(key) {
  memory.delete(key)
  try { window.localStorage.removeItem(key) } catch { /* ignore */ }
}

/** useState that remembers its value under `key` (parse/format as strings). */
export function useStoredState(key, initial, parse = v => v, format = String) {
  const [value, setValue] = useState(() => {
    const raw = readStore(key)
    if (raw === null) return initial
    const v = parse(raw)
    return v === undefined || Number.isNaN(v) ? initial : v
  })
  useEffect(() => { writeStore(key, format(value)) }, [key, value]) // eslint-disable-line react-hooks/exhaustive-deps
  return [value, setValue]
}
