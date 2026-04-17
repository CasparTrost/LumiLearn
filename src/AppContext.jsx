import React, { createContext, useContext, useReducer, useEffect } from 'react'

const AppContext = createContext(null)

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
}

function freshProgress() {
  return { currentLevel: 1, levelStars: {}, completed: false }
}

const ALL_MODULE_IDS = Object.keys(MAX_LEVELS)

// ── Coin helpers ──────────────────────────────────────────────────────────────
export function starsToCoins(stars) {
  return stars >= 3 ? 18 : stars >= 2 ? 10 : stars >= 1 ? 5 : 0
}

export const FARM_COSTS = [0, 50, 100, 175, 275, 400] // cost to reach level 2,3,4,5,6

// ── Daily Missions definition (functions NOT stored in localStorage) ──────────
export const ALL_MISSIONS = [
  { id:'play3',    text:'3 Spiele spielen',          icon:'🎮', check: (s) => (s._sessionPlays ?? 0) >= 3 },
  { id:'level5',   text:'5 Level abschließen',       icon:'🏅', check: (s) => (s._sessionLevels ?? 0) >= 5 },
  { id:'stars3',   text:'3 Sterne holen',            icon:'⭐', check: (s) => s._got3Stars ?? false },
  { id:'play2diff',text:'2 verschiedene Spiele',     icon:'🎲', check: (s) => (s._played ?? []).length >= 2 },
  { id:'level3',   text:'3 Level schaffen',          icon:'🎯', check: (s) => (s._sessionLevels ?? 0) >= 3 },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function pickMissionsForDate(dateStr) {
  // deterministic: use date hash to pick 3
  let hash = 0
  for (const c of dateStr) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  const pool = [...ALL_MISSIONS]
  const picked = []
  for (let i = 0; i < 3; i++) {
    const idx = (hash + i * 7) % (pool.length - i)
    const [m] = pool.splice(idx, 1)
    picked.push({ id: m.id, text: m.text, icon: m.icon })
  }
  return picked
}

const initialState = {
  screen:      'welcome',
  language:    null,
  profile:     null,
  profiles:    [],
  progress:    Object.fromEntries(ALL_MODULE_IDS.map(id => [id, freshProgress()])),
  currentGame: null,
  gameResult:  null,
  // Gamification
  farmLevel:   1,
  streak:      { count: 0, lastDate: null },
  dailyMission: { date: null, missions: [], completedIds: [] },
  // Session tracking (not persisted to localStorage)
  _sessionPlays:  0,
  _sessionLevels: 0,
  _got3Stars:     false,
  _played:        [],
}

function reducer(state, action) {
  switch (action.type) {

    case 'RESET_ALL':
      return { ...initialState, language: state.language }

    case 'RESET_MODULE': {
      const id = action.payload
      return { ...state, progress: { ...state.progress, [id]: freshProgress() } }
    }

    case 'SET_MODULE_LEVEL': {
      const { id, level } = action.payload
      const prev = state.progress[id] ?? freshProgress()
      return { ...state, progress: { ...state.progress, [id]: { ...prev, currentLevel: level, completed: false } } }
    }

    case 'SET_LANGUAGE':
      return { ...state, language: action.payload }

    case 'SET_PROFILE':
      return { ...state, profile: action.payload }

    case 'ADD_PROFILE': {
      const newProfile = action.payload
      const existing = state.profiles ?? []
      const updated = [...existing, newProfile]
      return { ...state, profiles: updated }
    }

    case 'NAVIGATE':
      return { ...state, screen: action.payload }

    case 'START_GAME':
      return { ...state, screen: 'game', currentGame: action.payload }

    case 'CHECK_STREAK': {
      const today = todayStr()
      const streak = state.streak ?? { count: 0, lastDate: null }
      if (streak.lastDate === today) return state // already checked today
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yStr = yesterday.toISOString().slice(0, 10)
      const isConsecutive = streak.lastDate === yStr
      const newCount = isConsecutive ? (streak.count ?? 0) + 1 : 1
      return {
        ...state,
        streak: { count: newCount, lastDate: today },
      }
    }

    case 'ENSURE_DAILY_MISSION': {
      const today = todayStr()
      if (state.dailyMission?.date === today) return state
      return {
        ...state,
        dailyMission: { date: today, missions: pickMissionsForDate(today), completedIds: [] },
        // reset session tracking for new day
        _sessionPlays: 0, _sessionLevels: 0, _got3Stars: false, _played: [], _sessionCoins: 0,
      }
    }

    case 'UPGRADE_FARM': {
      const curLevel = state.farmLevel ?? 1
      if (curLevel >= 6) return state
      const cost = FARM_COSTS[curLevel] ?? 999
      if ((state.coins ?? 0) < cost) return state
      return { ...state, farmLevel: curLevel + 1, coins: (state.coins ?? 0) - cost }
    }

    case 'FINISH_GAME': {
      const { moduleId, level, stars, score, total } = action.payload
      const maxLevel      = MAX_LEVELS[moduleId] ?? 5
      const prev          = state.progress[moduleId] ?? freshProgress()
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
      const streakCount = state.streak?.count ?? 0
      let streakBonus = 0
      const streakLastBonus = state.streakLastBonus ?? null
      if (stars >= 1) {
        if (streakCount >= 14 && streakLastBonus !== '14') streakBonus = 80
        else if (streakCount >= 7  && streakLastBonus !== '7'  && streakLastBonus !== '14') streakBonus = 40
        else if (streakCount >= 3  && streakLastBonus !== '3'  && streakLastBonus !== '7'  && streakLastBonus !== '14') streakBonus = 15
      }
      const newStreakLastBonus = streakBonus > 0
        ? (streakCount >= 14 ? '14' : streakCount >= 7 ? '7' : '3')
        : streakLastBonus

      // ── Session tracking ──
      const newPlayed = Array.from(new Set([...(state._played ?? []), moduleId]))
      const newSessionCoins = (state._sessionCoins ?? 0) + coinsEarned + streakBonus

      // ── Mission progress ──
      const dm = state.dailyMission ?? { date: null, missions: [], completedIds: [] }
      const sessionState = {
        _sessionPlays:  (state._sessionPlays ?? 0) + 1,
        _sessionLevels: (state._sessionLevels ?? 0) + (stars >= 1 ? 1 : 0),
        _got3Stars:     (state._got3Stars ?? false) || stars === 3,
        _played:        newPlayed,
      }

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

      return {
        ...state,
        ...sessionState,
        screen: 'results',
        streakLastBonus: newStreakLastBonus,
        coins: (state.coins ?? 0) + totalCoins,
        dailyMission: { ...dm, completedIds: newCompletedIds },
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
        progress: {
          ...state.progress,
          [moduleId]: {
            currentLevel: newCurrentLevel,
            levelStars:   newLevelStars,
            completed,
          },
        },
      }
    }

    case 'LOAD_SAVE':
      return { ...state, ...action.payload }

    default:
      return state
  }
}

function migrate(saved) {
  // Ensure gamification fields exist with safe defaults
  const withDefaults = {
    farmLevel:   1,
    streak:      { count: 0, lastDate: null },
    dailyMission: { date: null, missions: [], completedIds: [] },
    streakLastBonus: null,
    ...saved,
  }
  // Ensure dailyMission has no check functions (safe strip)
  if (withDefaults.dailyMission?.missions) {
    withDefaults.dailyMission = {
      ...withDefaults.dailyMission,
      missions: (withDefaults.dailyMission.missions ?? []).map(m => ({
        id: m.id, text: m.text, icon: m.icon,
      })),
    }
  }
  if (!withDefaults.progress) return withDefaults
  const migrated = {}
  for (const [id, val] of Object.entries(withDefaults.progress)) {
    if (!val) {
      migrated[id] = freshProgress()
      continue
    }
    if (typeof val.levelStars === 'object' && !Array.isArray(val.levelStars)) {
      migrated[id] = val
      continue
    }
    const oldStars   = val.stars ?? 0
    const oldLevel   = val.level ?? 1
    const completed  = val.completedLevels ?? []
    const levelStars = {}
    completed.forEach(l => { levelStars[l] = Math.max(1, oldStars) })
    if (oldStars > 0 && completed.length === 0) levelStars[1] = oldStars
    migrated[id] = { currentLevel: oldLevel, levelStars, completed: false }
  }
  for (const id of ALL_MODULE_IDS) {
    if (!migrated[id]) migrated[id] = freshProgress()
  }
  const profiles = withDefaults.profiles ?? (withDefaults.profile ? [withDefaults.profile] : [])
  return { ...withDefaults, progress: migrated, profiles }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const saved = localStorage.getItem('lumilearn_save')
      if (saved) {
        const parsed = migrate(JSON.parse(saved))
        const screen = parsed.profile ? 'home' : 'welcome'
        // Restore session stats from dailyMission if it's today
        const dm = parsed.dailyMission
        const today = new Date().toISOString().slice(0, 10)
        const sessionRestored = dm?.date === today ? {
          _sessionPlays:  dm.sessionPlays  ?? 0,
          _sessionLevels: dm.sessionLevels ?? 0,
          _got3Stars:     dm.got3Stars     ?? false,
          _played:        dm.played        ?? [],
        } : {}
        return { ...init, ...parsed, screen, ...sessionRestored }
      }
    } catch { /* ignore corrupt saves */ }
    return init
  })

  // Check streak and ensure daily missions on mount
  useEffect(() => {
    dispatch({ type: 'CHECK_STREAK' })
    dispatch({ type: 'ENSURE_DAILY_MISSION' })
  }, [])

  useEffect(() => {
    const toSave = {
      language:       state.language,
      profile:        state.profile,
      profiles:       state.profiles,
      progress:       state.progress,
      coins:          state.coins,
      farmLevel:      state.farmLevel,
      streak:         state.streak,
      streakLastBonus: state.streakLastBonus,
      dailyMission:   {
        date:         state.dailyMission?.date,
        missions:     (state.dailyMission?.missions ?? []).map(m => ({ id: m.id, text: m.text, icon: m.icon })),
        completedIds: state.dailyMission?.completedIds ?? [],
        // persist session stats per day (no functions, just numbers)
        sessionPlays:  state._sessionPlays ?? 0,
        sessionLevels: state._sessionLevels ?? 0,
        got3Stars:     state._got3Stars ?? false,
        played:        state._played ?? [],
        sessionCoins:  state._sessionCoins ?? 0,
      },
    }
    localStorage.setItem('lumilearn_save', JSON.stringify(toSave))
  }, [state.language, state.profile, state.profiles, state.progress, state.coins, state.farmLevel, state.streak, state.dailyMission, state.streakLastBonus, state._sessionPlays, state._sessionLevels, state._got3Stars, state._played, state._sessionCoins])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
