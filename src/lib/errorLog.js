/**
 * The last 20 errors, for the parent area ("Fehler-Log"): what broke, when,
 * and in which game. Crashes while drawing come from the error boundaries;
 * everything else (a tap handler, a timer, a rejected promise) from the
 * window listeners installed in main.jsx — before those, such errors left no
 * trace at all.
 */
import { readStore, writeStore } from '../hooks/safeStorage.js'

const KEY = 'lumilearn_errors'

// Not faults: audio a browser refused to start (no tap yet, or a newer clip
// cut it short), a game's code that could not load without a connection,
// and a known harmless browser notice.
const NOISE = /play\(\) request was interrupted|NotAllowedError|AbortError|dynamically imported module|Importing a module script failed|Failed to fetch|Load failed|ResizeObserver loop/i

export function logError(error, where = 'app') {
  const message = String(error?.message ?? error ?? 'unbekannt')
  if (NOISE.test(message)) return
  let list = []
  try { list = JSON.parse(readStore(KEY, '[]')) } catch { /* a broken log starts over */ }
  if (!Array.isArray(list)) list = []
  // the same error in a loop (a timer) would push out everything else
  if (list[0]?.message === message && list[0]?.module === where) return
  list.unshift({ ts: new Date().toISOString(), message, stack: String(error?.stack ?? '').slice(0, 500), module: where })
  writeStore(KEY, JSON.stringify(list.slice(0, 20)))
}

export function installErrorLog(currentModule = () => 'app') {
  window.addEventListener('error', e => logError(e.error ?? e.message, currentModule()))
  window.addEventListener('unhandledrejection', e => logError(e.reason, currentModule()))
}
