import React, { createContext, useContext, useReducer, useEffect } from 'react'

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
  stories:        10,
  sort:           10,
  clock:          10,
  words2:         10,
  weight:         10,
  coloring:        10,
}

function freshProgress() {
  return { currentLevel: 1, levelStars: {}, completed: false }
}

const ALL_MODULE_IDS = Object.keys(MAX_LEVELS)

// ── Coin helpers ──────────────────────────────────────────────────────────────
// Coins are a pure earned-achievement counter (shown in GameScreen,
// ResultsScreen, ProfileSwitcher) — not a currency with anywhere to spend
// them. There used to be an UPGRADE_FARM action + FARM_COSTS letting coins
// "buy" farm levels, but the farm (FarmProgress.jsx) already has its own
// complete, better-fitting progression tied to real achievement
// (getFarmLevel(completedCount) — see FarmProgress.jsx), so that dead
// parallel system was removed rather than built out into an actual shop.
export function starsToCoins(stars) {
  return stars >= 3 ? 18 : stars >= 2 ? 10 : stars >= 1 ? 5 : 0
}

// ── Daily Missions definition (functions NOT stored in localStorage) ──────────
export const ALL_MISSIONS = [
  { id:'play3',    icon:'🎮', check: (s) => (s._sessionPlays ?? 0) >= 3 },
  { id:'level5',   icon:'🏅', check: (s) => (s._sessionLevels ?? 0) >= 5 },
  { id:'stars3',   icon:'⭐', check: (s) => s._got3Stars ?? false },
  { id:'play2diff',icon:'🎲', check: (s) => (s._played ?? []).length >= 2 },
  { id:'level3',   icon:'🎯', check: (s) => (s._sessionLevels ?? 0) >= 3 },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function pickMissionsForDate(dateStr) {
  let hash = 0
  for (const c of dateStr) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  const pool = [...ALL_MISSIONS]
  const picked = []
  for (let i = 0; i < 3; i++) {
    const idx = (hash + i * 7) % (pool.length - i)
    const [m] = pool.splice(idx, 1)
    picked.push({ id: m.id, icon: m.icon })
  }
  return picked
}

function freshProfile(overrides = {}) {
  return {
    id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: 'Kind',
    age: 5,
    avatar: '😊',
    createdAt: new Date().toISOString(),
    progress: Object.fromEntries(ALL_MODULE_IDS.map(id => [id, freshProgress()])),
    coins: 0,
    farmLevel: 1,
    streak: { count: 0, lastDate: null },
    streakLastBonus: null,
    dailyMission: { date: null, missions: [], completedIds: [] },
    lastPlayed: null,
    ...overrides,
  }
}

const initialState = {
  screen:         'welcome',
  language:       null,
  activeProfileId: null,
  profiles:       {},
  currentGame:    null,
  gameResult:     null,
  settings:       { parentPin: '1234', pinIsDefault: true },
  // Session tracking (not persisted to localStorage)
  _sessionPlays:  0,
  _sessionLevels: 0,
  _got3Stars:     false,
  _played:        [],
}

// Helper to update the active profile
function updateActiveProfile(state, updater) {
  const id = state.activeProfileId
  if (!id || !state.profiles[id]) return state
  return {
    ...state,
    profiles: {
      ...state.profiles,
      [id]: updater(state.profiles[id]),
    },
  }
}

function reducer(state, action) {
  switch (action.type) {

    case 'RESET_ALL':
      return { ...initialState, language: state.language, settings: state.settings }

    case 'RESET_MODULE': {
      const id = action.payload
      return updateActiveProfile(state, p => ({
        ...p,
        progress: { ...p.progress, [id]: freshProgress() },
      }))
    }

    case 'SET_MODULE_LEVEL': {
      const { id, level } = action.payload
      return updateActiveProfile(state, p => {
        const prev = p.progress[id] ?? freshProgress()
        return {
          ...p,
          progress: { ...p.progress, [id]: { ...prev, currentLevel: level, completed: false } },
        }
      })
    }

    case 'SET_LANGUAGE':
      return { ...state, language: action.payload }

    case 'ADD_PROFILE': {
      const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      const newProfile = freshProfile({
        id,
        name: action.payload.name,
        age: action.payload.age ?? 5,
        avatar: action.payload.emoji || action.payload.avatar || '😊',
      })
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
      return { ...state, profiles: rest, activeProfileId: newActive }
    }

    case 'RESET_PROFILE': {
      const id = action.payload || state.activeProfileId
      if (!id || !state.profiles[id]) return state
      return {
        ...state,
        profiles: {
          ...state.profiles,
          [id]: {
            ...state.profiles[id],
            progress: Object.fromEntries(ALL_MODULE_IDS.map(mid => [mid, freshProgress()])),
            coins: 0,
            farmLevel: 1,
            streak: { count: 0, lastDate: null },
            streakLastBonus: null,
            dailyMission: { date: null, missions: [], completedIds: [] },
          },
        },
      }
    }

    case 'NAVIGATE':
      return { ...state, screen: action.payload }

    case 'START_GAME':
      return { ...state, screen: 'game', currentGame: action.payload }

    case 'CHECK_STREAK': {
      return updateActiveProfile(state, p => {
        const today = todayStr()
        const streak = p.streak ?? { count: 0, lastDate: null }
        if (streak.lastDate === today) return p
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yStr = yesterday.toISOString().slice(0, 10)
        const isConsecutive = streak.lastDate === yStr
        const newCount = isConsecutive ? (streak.count ?? 0) + 1 : 1
        return { ...p, streak: { count: newCount, lastDate: today } }
      })
    }

    case 'ENSURE_DAILY_MISSION': {
      return updateActiveProfile(state, p => {
        const today = todayStr()
        const dm = p.dailyMission ?? { date: null, missions: [], completedIds: [] }
        if (dm.date === today) return p
        return {
          ...p,
          dailyMission: { date: today, missions: pickMissionsForDate(today), completedIds: [] },
        }
      })
    }

    case 'FINISH_GAME': {
      const { moduleId, level, stars, score, total } = action.payload
      const maxLevel = MAX_LEVELS[moduleId] ?? 5
      const profile = state.profiles[state.activeProfileId]
      if (!profile) return state

      const prev = profile.progress[moduleId] ?? freshProgress()
      const prevLevelStars = prev.levelStars ?? {}
      const prevBestStars  = prevLevelStars[level] ?? 0

      const newLevelStars = {
        ...prevLevelStars,
        [level]: Math.max(prevBestStars, stars),
      }

      let newCurrentLevel = prev.currentLevel ?? 1
      if (stars >= 1 && level >= newCurrentLevel) {
        newCurrentLevel = Math.min(level + 1, maxLevel)
      }

      const completed = Array.from({ length: maxLevel }, (_, i) => i + 1)
        .every(l => (newLevelStars[l] ?? 0) >= 1)

      const justCompleted = completed && !(prev.completed ?? false)
      const isNewBest     = stars > prevBestStars
      const isFirstPass   = prevBestStars === 0 && stars >= 1
      const nextLevelNum  = level < maxLevel ? level + 1 : null

      // ── Coins ──
      let coinsEarned = starsToCoins(stars)
      if (isFirstPass) coinsEarned += 5
      else if (isNewBest) coinsEarned += 3

      // ── Streak bonus ──
      const streakCount = profile.streak?.count ?? 0
      let streakBonus = 0
      const streakLastBonus = profile.streakLastBonus ?? null
      if (stars >= 1) {
        if (streakCount >= 14 && streakLastBonus !== '14') streakBonus = 80
        else if (streakCount >= 7  && streakLastBonus !== '7'  && streakLastBonus !== '14') streakBonus = 40
        else if (streakCount >= 3  && streakLastBonus !== '3'  && streakLastBonus !== '7'  && streakLastBonus !== '14') streakBonus = 15
      }
      const newStreakLastBonus = streakBonus > 0
        ? (streakCount >= 14 ? '14' : streakCount >= 7 ? '7' : '3')
        : streakLastBonus

      // ── Session tracking ──
      const newSessionPlays  = (state._sessionPlays ?? 0) + 1
      const newSessionLevels = (state._sessionLevels ?? 0) + (stars >= 1 ? 1 : 0)
      const newGot3Stars     = (state._got3Stars ?? false) || stars === 3
      const newPlayed        = Array.from(new Set([...(state._played ?? []), moduleId]))
      const sessionState = {
        _sessionPlays:  newSessionPlays,
        _sessionLevels: newSessionLevels,
        _got3Stars:     newGot3Stars,
        _played:        newPlayed,
      }

      // ── Mission progress ──
      const dm = profile.dailyMission ?? { date: null, missions: [], completedIds: [] }
      let missionCoinBonus = 0
      const newCompletedIds = [...(dm.completedIds ?? [])]
      const newlyCompletedMissionIds = []
      if (dm.date === todayStr()) {
        for (const m of (dm.missions ?? [])) {
          if (newCompletedIds.includes(m.id)) continue
          const def = ALL_MISSIONS.find(x => x.id === m.id)
          if (def && def.check({ ...sessionState })) {
            newCompletedIds.push(m.id)
            newlyCompletedMissionIds.push(m.id)
            missionCoinBonus += 20
          }
        }
      }

      const totalCoins = coinsEarned + streakBonus + missionCoinBonus

      const updatedProfile = {
        ...profile,
        coins: (profile.coins ?? 0) + totalCoins,
        streakLastBonus: newStreakLastBonus,
        dailyMission: { ...dm, completedIds: newCompletedIds },
        lastPlayed: { moduleId, ts: new Date().toISOString() },
        progress: {
          ...profile.progress,
          [moduleId]: {
            currentLevel: newCurrentLevel,
            levelStars:   newLevelStars,
            completed,
          },
        },
      }

      return {
        ...state,
        ...sessionState,
        screen: 'results',
        profiles: { ...state.profiles, [state.activeProfileId]: updatedProfile },
        gameResult: {
          moduleId, level, stars, score, total,
          prevBestStars,
          isNewBest,
          isFirstPass,
          justCompleted,
          nextLevelNum,
          maxLevel,
          coinsEarned: totalCoins,
          streakBonus,
          missionBonus: missionCoinBonus,
          newMissionsCompleted: newlyCompletedMissionIds,
          streakCount,
        },
      }
    }

    case 'SET_PARENT_PIN':
      return { ...state, settings: { ...state.settings, parentPin: action.payload, pinIsDefault: false } }

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
      migrated[id] = val; continue
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

function migrateToV2(data) {
  if (data.version === 2) {
    // Ensure all profiles have all module progress keys
    const profiles = {}
    for (const [id, p] of Object.entries(data.profiles || {})) {
      profiles[id] = {
        ...freshProfile({ id }),
        ...p,
        progress: { ...Object.fromEntries(ALL_MODULE_IDS.map(mid => [mid, freshProgress()])), ...migrateProgress(p.progress) },
      }
    }
    return { ...data, profiles }
  }

  // v1 → v2: old format had profiles[] array + global progress/coins/streak
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
        coins: isFirst ? (data.coins || 0) : 0,
        farmLevel: isFirst ? (data.farmLevel || 1) : 1,
        streak: isFirst ? (data.streak || { count: 0, lastDate: null }) : { count: 0, lastDate: null },
        streakLastBonus: isFirst ? (data.streakLastBonus || null) : null,
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
      coins: data.coins || 0,
      farmLevel: data.farmLevel || 1,
      streak: data.streak || { count: 0, lastDate: null },
      streakLastBonus: data.streakLastBonus || null,
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
    language: data.language || null,
    settings: { parentPin: '1234', pinIsDefault: true, ...(data.settings || {}) },
    activeProfileId,
    profiles,
    currentGame: null,
    gameResult: null,
    _sessionPlays: 0,
    _sessionLevels: 0,
    _got3Stars: false,
    _played: [],
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const saved = localStorage.getItem('lumilearn_save')
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

  // Check streak and ensure daily missions on mount
  useEffect(() => {
    if (state.activeProfileId) {
      dispatch({ type: 'CHECK_STREAK' })
      dispatch({ type: 'ENSURE_DAILY_MISSION' })
    }
  }, [state.activeProfileId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const toSave = {
      version: 2,
      language: state.language,
      settings: state.settings,
      activeProfileId: state.activeProfileId,
      profiles: state.profiles,
    }
    try {
      localStorage.setItem('lumilearn_save', JSON.stringify(toSave))
    } catch { /* quota exceeded or storage unavailable */ }
  }, [state.language, state.settings, state.activeProfileId, state.profiles])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
