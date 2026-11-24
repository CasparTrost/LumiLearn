import React, { createContext, useContext, useReducer, useEffect } from 'react'
import * as narrator from './narrator.js'
import { MODULES, MODULE_BY_ID, visibleModules, sortForAge } from './modules.js'
import { ENGLISH_ENABLED } from './i18n.js'
import { updateSkill, nextLevel, ratioOf, journeyFor, nextStopIndex } from './lib/learning.js'
import { stickerForDay } from './lib/stickers.js'

export const AppContext = createContext(null)

export const MAX_LEVELS = {
  'number-intro': 4,
  'letter-intro': 5,
  numbers:        10,
  letters:        10,
  listen:         10,
  words:          10,
  patterns:       10,
  shapes:         10,
  emotions:       10,
  maze:           10,
  shadows:        10,
  bubbles:        10,
  sort:           10,
  clock:          10,
  words2:         10,
  weight:         10,
  coloring:        10,
  'rocket-math': 10,
  'shapes-land': 10,
  'rhyme': 10,
  'initial-sound': 10,
  'empathy': 10,
  'shape-build': 10,
  trace:         10,
}

function freshProgress() {
  return { currentLevel: 1, levelStars: {}, completed: false }
}

const ALL_MODULE_IDS = Object.keys(MAX_LEVELS)

// Münzen gab es hier einmal. Sie waren ein reiner Zähler ohne Laden: man
// sammelte sie, sah sie an drei Stellen, und mehr passierte nicht. Ein Etikett,
// das eine Währung verspricht und keine ist, wirft bei jedem, der es sieht,
// dieselbe Frage auf — wofür? Fortschritt zeigen jetzt allein die Sterne.

// ── Datum ────────────────────────────────────────────────────────────────────
// Lokales Datum. toISOString() rechnet in UTC — in Deutschland begann der
// neue Tag (Serie, Tagesaufgaben) erst um 1 oder 2 Uhr nachts.
const pad = n => String(n).padStart(2, '0')
const dayStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export function todayStr() { return dayStr(new Date()) }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d) }

/** The streak as it stands today: a streak not continued yesterday is over. */
export function liveStreak(streak) {
  const s = streak ?? { count: 0, lastDate: null }
  return s.lastDate === todayStr() || s.lastDate === yesterdayStr() ? (s.count ?? 0) : 0
}

// ── Tagesaufgaben ────────────────────────────────────────────────────────────
// Zählen pro Kind und pro Tag, gespeichert im Profil. Vorher lagen die Zähler
// sitzungsweit im State: Geschwister erbten sie beim Profilwechsel, und nach
// dem Neuladen war alles weg.
//
// `goal` und `count` beschreiben den Fortschritt, damit die Startseite ihn
// zeigen kann (🎮🎮⬜ statt nur eines Textes). `kind`: an einem Tag nie zwei
// Aufgaben derselben Art ("3 Level" und "5 Level" zugleich).
const worldCount = world => d => (d.playedIds ?? []).filter(id => MODULE_BY_ID[id]?.world === world).length ? 1 : 0
export const ALL_MISSIONS = [
  { id: 'play3',            icon: '🎮', kind: 'plays',   goal: 3, count: d => d.plays ?? 0 },
  { id: 'play2diff',        icon: '🎲', kind: 'variety', goal: 2, count: d => (d.playedIds ?? []).length },
  { id: 'level3',           icon: '🎯', kind: 'levels',  goal: 3, count: d => d.levels ?? 0 },
  { id: 'stars3',           icon: '⭐', kind: 'stars',   goal: 1, count: d => (d.got3Stars ? 1 : 0) },
  { id: 'newgame',          icon: '✨', kind: 'new',     goal: 1, count: d => (d.newIds ?? []).length ? 1 : 0 },
  { id: 'world-zahlen',     icon: '🔢', kind: 'world',   goal: 1, count: worldCount('zahlen'),     world: 'zahlen' },
  { id: 'world-buchstaben', icon: '🔤', kind: 'world',   goal: 1, count: worldCount('buchstaben'), world: 'buchstaben' },
  // no longer handed out (it doubled "3 Level"), kept for days already saved
  { id: 'level5',           icon: '🏅', kind: 'levels',  goal: 5, count: d => d.levels ?? 0, retired: true },
]
export const missionDef = id => ALL_MISSIONS.find(m => m.id === id)

// A mission the child can't do with the games it sees is not handed out:
// parents can switch games off (a world without games, no new game left).
const hasPlayed = (profile, id) => (profile?.progress?.[id]?.plays ?? 0) > 0
  || Object.keys(profile?.progress?.[id]?.levelStars ?? {}).length > 0
function missionPossible(m, profile) {
  if (!m) return false
  const mods = visibleModules(profile)
  if (m.kind === 'world')   return mods.some(x => x.world === m.world)
  if (m.kind === 'variety') return mods.length >= 2
  if (m.kind === 'new')     return mods.some(x => !hasPlayed(profile, x.id))
  return true
}

// Every child gets its own three, different from day to day. `keep`: the
// missions of today that stay when the games change (parent area).
function pickMissions(dateStr, profile, keep = []) {
  let hash = 0
  for (const c of dateStr + (profile?.id ?? '')) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  const pool = ALL_MISSIONS.filter(m => !m.retired && !keep.some(k => k.id === m.id) && missionPossible(m, profile))
  const picked = [...keep]
  while (picked.length < 3 && pool.length) {
    const [m] = pool.splice(hash % pool.length, 1)
    hash = (hash * 1103515245 + 12345) >>> 0
    if (picked.some(p => missionDef(p.id)?.kind === m.kind)) continue
    picked.push({ id: m.id, icon: m.icon })
  }
  return picked
}

function freshDay(date, profile) {
  return { date, missions: pickMissions(date, profile), completedIds: [], plays: 0, levels: 0, playedIds: [], newIds: [], got3Stars: false }
}
function ensureDay(dm, profile) {
  const today = todayStr()
  if (dm?.date === today) return { plays: 0, levels: 0, playedIds: [], newIds: [], got3Stars: false, ...dm }
  return freshDay(today, profile)
}

// ── Sterne-Bonus ─────────────────────────────────────────────────────────────
// Früher wuchs damit ein Bauernhof auf der Startseite (mit den Sternen und
// Extra-Sternen für Tagesaufgaben). Der Hof ist weg, die Zählung bleibt im
// Spielstand, damit alte Spielstände gültig bleiben.
export const MISSION_BONUS = 2
export function totalStars(progress) {
  return Object.values(progress ?? {})
    .reduce((sum, p) => sum + Object.values(p?.levelStars ?? {}).reduce((a, b) => a + (b ?? 0), 0), 0)
}
export const farmPoints = profile => totalStars(profile?.progress) + (profile?.farmBonus ?? 0)

// ── Lumis Ideen für heute ────────────────────────────────────────────────────
// Der Tagesplan (lib/learning.js): vier Spiele und eine Bewegungspause,
// danach ein Sticker als Überraschung. Pro Kind und Tag einer.
export const JOURNEY_BONUS = 3
export function journeyContext(profile) {
  return { mods: sortForAge(visibleModules(profile), profile), maxLevels: MAX_LEVELS, today: todayStr() }
}
function withJourney(profile) {
  const j = journeyFor(profile, journeyContext(profile))
  return j === profile.journey ? profile : { ...profile, journey: j }
}
// A stop is done: mark it, and say what comes next
function markStop(journey, idx) {
  if (!journey || typeof idx !== 'number' || journey.date !== todayStr() || !journey.stops?.[idx]) return journey
  const done = Array.from(new Set([...(journey.done ?? []), idx]))
  return { ...journey, done }
}

/** Minutes played today. */
export const todayMs = profile => profile?.playLog?.[todayStr()]?.ms ?? 0

function freshProfile(overrides = {}) {
  return {
    id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: 'Kind',
    age: 5,
    avatar: '😊',
    createdAt: new Date().toISOString(),
    progress: Object.fromEntries(ALL_MODULE_IDS.map(id => [id, freshProgress()])),
    farmLevel: 1,
    farmBonus: 0,
    streak: { count: 0, lastDate: null },
    dailyMission: { date: null, missions: [], completedIds: [] },
    playLog: {},
    lastPlayed: null,
    // games the parents switched off for this child (parent area)
    hiddenGames: [],
    // today's journey (lib/learning.js) and the stickers from its treasure chests
    journey: null,
    stickers: [],
    ...overrides,
  }
}

const DEFAULT_SETTINGS = { parentPin: '1234', pinIsDefault: true, voiceVolume: 1, dailyLimitMin: 0 }

export const initialState = {
  screen:          'welcome',
  language:        'de',
  activeProfileId: null,
  profiles:        {},
  currentGame:     null,
  gameResult:      null,
  settings:        DEFAULT_SETTINGS,
  // not saved: whether the last save to the browser failed (storage full)
  _saveFailed:     false,
}

// Helper to update the active profile (or the one the parent area names)
function updateActiveProfile(state, updater, profileId) {
  const id = profileId ?? state.activeProfileId
  if (!id || !state.profiles[id]) return state
  return {
    ...state,
    profiles: {
      ...state.profiles,
      [id]: updater(state.profiles[id]),
    },
  }
}

// Keeps the play log to the last five weeks
function pruneLog(log) {
  const keys = Object.keys(log).sort()
  return keys.length <= 35 ? log : Object.fromEntries(keys.slice(-35).map(k => [k, log[k]]))
}

// The stars a game reported are the ones its first-try answers give (most
// games) — not a game that rates by something else (Memo by moves).
const providedStarsMatch = (stars, score, total) => {
  const share = score / total
  return (share >= 0.85 ? 3 : share >= 0.6 ? 2 : 1) === stars
}

export function reducer(state, action) {
  switch (action.type) {

    case 'RESET_ALL':
      return { ...initialState, language: state.language, settings: state.settings }

    case 'RESET_MODULE': {
      const id = action.payload?.id ?? action.payload
      return updateActiveProfile(state, p => ({
        ...p,
        progress: { ...p.progress, [id]: freshProgress() },
      }), action.payload?.profileId)
    }

    // Setting the level from the parent area only moves the starting point.
    // It used to set completed:false as well, so a mastered game lost its
    // trophy and the farm its animal, and the next round celebrated the
    // "first" mastery again.
    case 'SET_MODULE_LEVEL': {
      const { id, level, profileId } = action.payload
      return updateActiveProfile(state, p => {
        const prev = p.progress[id] ?? freshProgress()
        return {
          ...p,
          progress: { ...p.progress, [id]: { ...prev, currentLevel: level } },
        }
      }, profileId)
    }

    case 'SET_LANGUAGE':
      return { ...state, language: ENGLISH_ENABLED ? action.payload : 'de' }

    case 'ADD_PROFILE': {
      const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      const newProfile = freshProfile({
        id,
        name: action.payload.name,
        // may stay open in the onboarding; recommendations then assume 5
        age: action.payload.age ?? null,
        avatar: action.payload.emoji || action.payload.avatar || '😊',
      })
      newProfile.dailyMission = freshDay(todayStr(), newProfile)
      return {
        ...state,
        profiles: { ...state.profiles, [id]: newProfile },
        activeProfileId: id,
      }
    }

    case 'UPDATE_PROFILE': {
      const { id, name, age, avatar } = action.payload
      if (!state.profiles[id]) return state
      return {
        ...state,
        profiles: {
          ...state.profiles,
          [id]: {
            ...state.profiles[id],
            ...(name   !== undefined ? { name }   : {}),
            ...(age    !== undefined ? { age }    : {}),
            ...(avatar !== undefined ? { avatar } : {}),
          },
        },
      }
    }

    case 'SET_ACTIVE_PROFILE':
      return { ...state, activeProfileId: action.payload }

    case 'DELETE_PROFILE': {
      const { [action.payload]: _, ...rest } = state.profiles
      const remaining = Object.keys(rest)
      const newActive = state.activeProfileId === action.payload
        ? (remaining[0] ?? null)
        : state.activeProfileId
      return {
        ...state, profiles: rest, activeProfileId: newActive,
        ...(newActive ? {} : { screen: 'profile' }),
      }
    }

    case 'RESET_PROFILE': {
      const id = action.payload || state.activeProfileId
      if (!id || !state.profiles[id]) return state
      const reset = {
        ...state.profiles[id],
        progress: Object.fromEntries(ALL_MODULE_IDS.map(mid => [mid, freshProgress()])),
        farmLevel: 1,
        farmBonus: 0,
        streak: { count: 0, lastDate: null },
        // the "Weiterspielen" card pointed at a game whose progress is gone
        lastPlayed: null,
        journey: null,
        stickers: [],
      }
      reset.dailyMission = freshDay(todayStr(), reset)
      return { ...state, profiles: { ...state.profiles, [id]: reset } }
    }

    // Parent area: switch a game off (or on again) for one child. The last
    // game that is still on stays on. Open missions of today that can't be
    // done with the games left are swapped for others.
    case 'SET_GAME_HIDDEN': {
      const { id, hidden, profileId } = action.payload
      if (!MODULE_BY_ID[id]) return state
      return updateActiveProfile(state, p => {
        const was = p.hiddenGames ?? []
        const next = hidden ? Array.from(new Set([...was, id])) : was.filter(x => x !== id)
        if (MODULES.every(m => next.includes(m.id))) return p
        let q = { ...p, hiddenGames: next }
        // today's journey not started yet and one of its games is now off:
        // plan it again with the games left
        const j = q.journey
        if (j?.date === todayStr() && !(j.done ?? []).length && j.stops?.some(st => next.includes(st.moduleId))) {
          q = withJourney({ ...q, journey: null })
        }
        const dm = q.dailyMission
        if (dm?.date !== todayStr()) return q
        const missions = dm.missions ?? []
        const keep = missions.filter(m => (dm.completedIds ?? []).includes(m.id) || missionPossible(missionDef(m.id), q))
        return keep.length === missions.length ? q : { ...q, dailyMission: { ...dm, missions: pickMissions(dm.date, q, keep) } }
      }, profileId)
    }

    case 'NAVIGATE':
      return { ...state, screen: action.payload, ...(action.create ? { profileCreate: true } : { profileCreate: false }) }

    case 'START_GAME':
      return { ...state, screen: 'game', currentGame: action.payload }

    // The movement break of today's journey (screens/MoveBreakScreen.jsx)
    case 'START_MOVE':
      return { ...state, screen: 'move', moveStop: action.payload }

    case 'ENSURE_DAILY_MISSION': {
      const p0 = state.profiles[state.activeProfileId]
      if (!p0) return state
      const dm = p0.dailyMission
      const missionsOk = dm?.date === todayStr() && (dm.missions ?? []).length
      const journeyOk = p0.journey?.date === todayStr()
      if (missionsOk && journeyOk) return state
      return updateActiveProfile(state, p => withJourney(missionsOk ? p : { ...p, dailyMission: ensureDay(dm, p) }))
    }

    // The movement break of the journey is done
    case 'JOURNEY_STOP_DONE':
      return updateActiveProfile(state, p => ({ ...p, journey: markStop(p.journey, action.payload) }))

    // All stops done: the treasure chest gives today's sticker and a bonus
    // for the farm. Once a day.
    case 'OPEN_CHEST': {
      return updateActiveProfile(state, p => {
        const j = p.journey
        if (!j || j.date !== todayStr() || j.chest || nextStopIndex(j) !== -1) return p
        const sticker = stickerForDay(p.stickers ?? [], j.date + p.id)
        return {
          ...p,
          journey: { ...j, chest: sticker ?? 'none' },
          stickers: sticker ? [...(p.stickers ?? []), sticker] : (p.stickers ?? []),
          farmBonus: (p.farmBonus ?? 0) + JOURNEY_BONUS,
        }
      })
    }

    // Time spent in a game, for the parent area and the daily time limit.
    case 'ADD_PLAYTIME': {
      const ms = Math.max(0, Math.min(action.payload?.ms ?? 0, 60 * 60 * 1000))
      if (!ms) return state
      return updateActiveProfile(state, p => {
        const today = todayStr()
        const log = { ...(p.playLog ?? {}) }
        const day = log[today] ?? { ms: 0, games: 0 }
        log[today] = { ...day, ms: day.ms + ms }
        return { ...p, playLog: pruneLog(log) }
      })
    }

    case 'FINISH_GAME': {
      const { moduleId, level, stars, score, total } = action.payload
      const maxLevel = MAX_LEVELS[moduleId] ?? 5
      const profile = state.profiles[state.activeProfileId]
      if (!profile) return state
      const today = todayStr()

      const prev = profile.progress[moduleId] ?? freshProgress()
      const prevLevelStars = prev.levelStars ?? {}
      const prevBestStars  = prevLevelStars[level] ?? 0
      const neverPlayed    = !(prev.plays > 0) && Object.keys(prevLevelStars).length === 0

      const newLevelStars = stars > 0 || level in prevLevelStars
        ? { ...prevLevelStars, [level]: Math.max(prevBestStars, stars) }
        : prevLevelStars

      // The next suggested level and the review schedule (lib/learning.js):
      // up after a round with mostly first-try answers, the same level to
      // practise after a hard one, one down after two very hard ones.
      // Games that rate themselves (Memo) count by their stars.
      const ratio = total > 0 && providedStarsMatch(stars, score, total) ? ratioOf(score, total)
        : stars >= 3 ? 1 : stars === 2 ? 0.7 : 0.45
      const sameLevelRatios = prev.levelRatios?.[level] ?? []
      const newCurrentLevel = nextLevel({ level, currentLevel: prev.currentLevel, maxLevel, ratio, sameLevelRatios })
      const skill = updateSkill(prev.skill, { ratio, today })

      const levels = Array.from({ length: maxLevel }, (_, i) => i + 1)
      const completed = levels.every(l => (newLevelStars[l] ?? 0) >= 1)
      // Celebrated once: masteredAt stays when the parent area moves the level
      const justCompleted = completed && !prev.masteredAt
      // "Meister" only with mostly two or three stars; otherwise all levels
      // are done and there are stars left to win
      const masteredWell  = completed && levels.reduce((a, l) => a + (newLevelStars[l] ?? 0), 0) >= 2 * maxLevel
      const isNewBest     = stars > prevBestStars
      const isFirstPass   = prevBestStars === 0 && stars >= 1
      const nextLevelNum  = level < maxLevel ? level + 1 : null

      // The streak counts days on which the child played, not days the app
      // was opened (it used to grow by just picking a profile).
      const st = profile.streak ?? { count: 0, lastDate: null }
      const streak = st.lastDate === today ? st
        : { count: st.lastDate === yesterdayStr() ? (st.count ?? 0) + 1 : 1, lastDate: today }

      // ── Tagesaufgaben ──
      const day = ensureDay(profile.dailyMission, profile)
      const counted = {
        ...day,
        plays:     (day.plays ?? 0) + 1,
        levels:    (day.levels ?? 0) + (stars >= 1 ? 1 : 0),
        got3Stars: day.got3Stars || stars === 3,
        playedIds: Array.from(new Set([...(day.playedIds ?? []), moduleId])),
        newIds:    neverPlayed ? Array.from(new Set([...(day.newIds ?? []), moduleId])) : (day.newIds ?? []),
      }
      const newlyCompletedMissionIds = (counted.missions ?? [])
        .map(m => m.id)
        .filter(id => !(counted.completedIds ?? []).includes(id))
        .filter(id => { const d = missionDef(id); return d && d.count(counted) >= d.goal })
      counted.completedIds = [...(counted.completedIds ?? []), ...newlyCompletedMissionIds]

      const log = { ...(profile.playLog ?? {}) }
      log[today] = { ms: 0, ...log[today], games: (log[today]?.games ?? 0) + 1 }

      // Today's plan: this game was one of Lumi's ideas — started from the
      // idea, or picked freely on the home screen (the same game counts)
      const j0 = profile.journey
      const stopIdx = state.currentGame?.journeyStop ?? (j0?.date === today
        ? (j0.stops ?? []).findIndex((st, i) => st.moduleId === moduleId && !(j0.done ?? []).includes(i))
        : -1)
      const journey = markStop(profile.journey, stopIdx)
      const onJourney = journey !== profile.journey || (typeof stopIdx === 'number' && stopIdx >= 0 && profile.journey?.date === today)

      const updatedProfile = {
        ...profile,
        journey,
        streak,
        farmBonus: (profile.farmBonus ?? 0) + MISSION_BONUS * newlyCompletedMissionIds.length,
        dailyMission: counted,
        playLog: pruneLog(log),
        lastPlayed: { moduleId, ts: new Date().toISOString() },
        progress: {
          ...profile.progress,
          [moduleId]: {
            ...prev,
            currentLevel: newCurrentLevel,
            levelStars:   newLevelStars,
            completed,
            ...(completed && !prev.masteredAt ? { masteredAt: new Date().toISOString() } : {}),
            plays:    (prev.plays ?? 0) + 1,
            lastStars: stars,
            lastTs:   new Date().toISOString(),
            skill,
            levelRatios: { ...(prev.levelRatios ?? {}), [level]: [...sameLevelRatios, Math.round(ratio * 100) / 100].slice(-3) },
          },
        },
      }

      return {
        ...state,
        screen: 'results',
        profiles: { ...state.profiles, [state.activeProfileId]: updatedProfile },
        gameResult: {
          moduleId, level, stars, score, total,
          prevBestStars,
          isNewBest,
          isFirstPass,
          justCompleted,
          masteredWell,
          nextLevelNum,
          maxLevel,
          // what Lumi suggests next: higher, the same level to practise, or easier
          suggestedLevel: newCurrentLevel,
          ratio,
          journey: onJourney ? { next: nextStopIndex(journey), total: journey.stops.length } : null,
          newMissionsCompleted: newlyCompletedMissionIds,
          streakCount: streak.count,
          streakGrew: st.lastDate !== today,
          farmBefore: farmPoints(profile),
          farmAfter:  farmPoints(updatedProfile),
        },
      }
    }

    case 'SET_PARENT_PIN':
      return { ...state, settings: { ...state.settings, parentPin: action.payload, pinIsDefault: false } }

    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, ...action.payload } }

    case 'SAVE_STATUS':
      return state._saveFailed === !action.payload ? state : { ...state, _saveFailed: !action.payload }

    // Spielstand aus einer Sicherung (Elternbereich). Läuft durch dieselbe
    // Migration wie das Laden beim Start.
    case 'IMPORT_SAVE': {
      const migrated = migrateToV2(action.payload)
      const ids = Object.keys(migrated.profiles)
      if (!ids.length) return state
      return { ...state, ...migrated, screen: ids.length > 1 ? 'profile' : 'home' }
    }

    case 'LOAD_SAVE':
      return { ...state, ...action.payload }

    default:
      return state
  }
}

// ── V2 Migration ──────────────────────────────────────────────────────────────
function migrateProgress(rawProgress) {
  const migrated = {}
  for (const [id, val] of Object.entries(rawProgress || {})) {
    if (!val) { migrated[id] = freshProgress(); continue }
    if (typeof val.levelStars === 'object' && !Array.isArray(val.levelStars)) {
      // Mastered before masteredAt existed: already celebrated, don't again
      migrated[id] = val.completed && !val.masteredAt ? { ...val, masteredAt: 'before-2026-10' } : val
      continue
    }
    const oldStars  = val.stars ?? 0
    const oldLevel  = val.level ?? 1
    const completed = val.completedLevels ?? []
    const levelStars = {}
    completed.forEach(l => { levelStars[l] = Math.max(1, oldStars) })
    if (oldStars > 0 && completed.length === 0) levelStars[1] = oldStars
    migrated[id] = { currentLevel: oldLevel, levelStars, completed: false }
  }
  for (const id of ALL_MODULE_IDS) {
    if (!migrated[id]) migrated[id] = freshProgress()
  }
  return migrated
}

// Felder, die es nicht mehr gibt: die Münzen und der Merker, der den
// Münz-Bonus für Tagesserien einmalig machte. Sie werden beim Laden verworfen;
// weil der Speicher-Effekt den geladenen Zustand zurückschreibt, verschwinden
// sie damit beim nächsten Speichern auch aus dem Browser.
//
// Bewusst nur ein Entfernen von Schlüsseln — Fortschritt, Serie und alles
// andere bleibt unangetastet. Der Lade-Pfad ist die Stelle, an der ein Fehler
// echte Profildaten kosten würde.
const RETIRED_FIELDS = ['coins', 'streakLastBonus']

// Switched-off games (parent area): known games only, and never all of them.
// Saves from before the switch have none — every game stays visible.
function cleanHidden(list) {
  const ids = Array.isArray(list) ? Array.from(new Set(list.filter(id => MODULE_BY_ID[id]))) : []
  return ids.length < MODULES.length ? ids : []
}
function dropRetired(profile) {
  const out = { ...profile }
  for (const k of RETIRED_FIELDS) delete out[k]
  return out
}

// English is hidden until the games are translated (i18n.js); a saved
// "en" falls back to German.
const savedLanguage = lang => (ENGLISH_ENABLED && lang) || 'de'

export function migrateToV2(data) {
  if (data.version === 2) {
    // Ensure all profiles have all module progress keys. New fields
    // (farmBonus, playLog, the day counters of the missions) come from
    // freshProfile and ensureDay; nothing saved is overwritten.
    const profiles = {}
    for (const [id, p] of Object.entries(data.profiles || {})) {
      profiles[id] = dropRetired({
        ...freshProfile({ id }),
        ...p,
        progress: { ...Object.fromEntries(ALL_MODULE_IDS.map(mid => [mid, freshProgress()])), ...migrateProgress(p.progress) },
        hiddenGames: cleanHidden(p.hiddenGames),
      })
    }
    return {
      ...data,
      language: savedLanguage(data.language),
      settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
      profiles,
    }
  }

  // v1 → v2: old format had profiles[] array + global progress/streak
  const profiles = {}
  const oldProfilesArr = data.profiles && Array.isArray(data.profiles) ? data.profiles : []
  const globalProgress = migrateProgress(data.progress)

  if (oldProfilesArr.length > 0) {
    oldProfilesArr.forEach((p, i) => {
      const id = p.id || ('p_' + Date.now().toString(36) + '_' + i)
      const isFirst = i === 0
      profiles[id] = {
        ...freshProfile({ id }),
        name: p.name || 'Kind',
        age: p.age || 5,
        avatar: p.emoji || p.avatar || '😊',
        createdAt: p.createdAt || new Date().toISOString(),
        // First profile inherits the global progress
        progress: isFirst ? globalProgress : Object.fromEntries(ALL_MODULE_IDS.map(mid => [mid, freshProgress()])),
        farmLevel: isFirst ? (data.farmLevel || 1) : 1,
        streak: isFirst ? (data.streak || { count: 0, lastDate: null }) : { count: 0, lastDate: null },
        dailyMission: isFirst ? (data.dailyMission
          ? {
              date: data.dailyMission.date,
              missions: (data.dailyMission.missions || []).map(m => ({ id: m.id, icon: m.icon })),
              completedIds: data.dailyMission.completedIds || [],
            }
          : { date: null, missions: [], completedIds: [] })
          : { date: null, missions: [], completedIds: [] },
      }
    })
  } else if (data.profile) {
    // Single profile
    const id = 'p_legacy'
    profiles[id] = {
      ...freshProfile({ id }),
      name: data.profile.name || 'Kind',
      age: data.profile.age || 5,
      avatar: data.profile.emoji || data.profile.avatar || '😊',
      progress: globalProgress,
      farmLevel: data.farmLevel || 1,
      streak: data.streak || { count: 0, lastDate: null },
      dailyMission: data.dailyMission
        ? {
            date: data.dailyMission.date,
            missions: (data.dailyMission.missions || []).map(m => ({ id: m.id, icon: m.icon })),
            completedIds: data.dailyMission.completedIds || [],
          }
        : { date: null, missions: [], completedIds: [] },
    }
  }

  // Determine active profile
  let activeProfileId = Object.keys(profiles)[0] || null
  if (data.activeProfileId && profiles[data.activeProfileId]) {
    activeProfileId = data.activeProfileId
  }

  return {
    version: 2,
    screen: 'welcome',
    language: savedLanguage(data.language),
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    activeProfileId,
    profiles,
    currentGame: null,
    gameResult: null,
  }
}

export const SAVE_KEY = 'lumilearn_save'

/** What goes into the browser (and into a backup file). */
export function saveData(state) {
  return {
    version: 2,
    language: state.language,
    settings: state.settings,
    activeProfileId: state.activeProfileId,
    profiles: state.profiles,
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const saved = localStorage.getItem(SAVE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const migrated = migrateToV2(parsed)

        // Determine starting screen
        const hasProfile = migrated.activeProfileId && migrated.profiles[migrated.activeProfileId]
        const screen = hasProfile
          ? (Object.keys(migrated.profiles).length > 1 ? 'profile' : 'home')
          : 'welcome'

        return { ...init, ...migrated, screen }
      }
    } catch { /* ignore corrupt saves */ }
    return init
  })

  // Today's missions for the child who is playing (a new day, a new child)
  useEffect(() => {
    if (state.activeProfileId) dispatch({ type: 'ENSURE_DAILY_MISSION' })
  }, [state.activeProfileId, state.screen])

  // Lumi's voice volume (parent area)
  useEffect(() => {
    narrator.setVoiceVolume?.(state.settings?.voiceVolume ?? 1)
  }, [state.settings?.voiceVolume])

  useEffect(() => {
    let ok = true
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData(state)))
    } catch {
      // Storage full or blocked. This used to be swallowed: the child played
      // on and after a reload everything was gone. Now the parent area and
      // the home screen say so.
      ok = false
    }
    dispatch({ type: 'SAVE_STATUS', payload: ok })
  }, [state.language, state.settings, state.activeProfileId, state.profiles]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
