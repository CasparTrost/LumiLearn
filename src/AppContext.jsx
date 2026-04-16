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

// ── Coin rewards ──────────────────────────────────────────────────────────────
export const COIN_PER_STAR = { 0: 0, 1: 5, 2: 10, 3: 18 }
export const MISSION_COIN_REWARD = 20
export const STREAK_BONUS_COINS  = { 3: 15, 7: 40, 14: 80 }

// ── Daily missions pool ───────────────────────────────────────────────────────
const ALL_MISSIONS = [
  { id:'play3',      text:'Spiele 3 beliebige Spiele', icon:'🎮', check:(s)=>s._sessionPlays>=3 },
  { id:'star3',      text:'Hol 3 Sterne in einem Spiel', icon:'⭐', check:(s)=>s._got3Stars },
  { id:'play-clock', text:'Spiele Uhren-Uhr', icon:'🕐', check:(s)=>(s._played??[]).includes('clock') },
  { id:'play-emotions', text:'Spiele Gefühlswelt', icon:'😊', check:(s)=>(s._played??[]).includes('emotions') },
  { id:'play-weight',text:'Spiele Waage-Welt', icon:'⚖️', check:(s)=>(s._played??[]).includes('weight') },
  { id:'play-maze',  text:'Spiele Lumi-Labyrinth', icon:'🌀', check:(s)=>(s._played??[]).includes('maze') },
  { id:'play-listen',text:'Spiele Hörabenteuer', icon:'🔊', check:(s)=>(s._played??[]).includes('listen') },
  { id:'play-sort',  text:'Spiele Sortier-Spaß', icon:'🧺', check:(s)=>(s._played??[]).includes('sort') },
  { id:'play-stories',text:'Spiele Lumis Abenteuer', icon:'📖', check:(s)=>(s._played??[]).includes('stories') },
  { id:'5levels',    text:'Schließe 5 Level ab', icon:'🏆', check:(s)=>s._sessionLevels>=5 },
]

function pickDailyMissions(date) {
  // Pick 3 missions deterministically by date
  const seed = date.split('-').reduce((a,b)=>a+Number(b),0)
  const pool = [...ALL_MISSIONS]
  const result = []
  let s = seed
  while (result.length < 3 && pool.length > 0) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const idx = s % pool.length
    result.push(pool.splice(idx, 1)[0])
  }
  return result
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function freshProgress() {
  return { currentLevel: 1, levelStars: {}, completed: false }
}

const ALL_MODULE_IDS = Object.keys(MAX_LEVELS)

const initialState = {
  screen:      'welcome',
  language:    null,
  profile:     null,
  profiles:    [],
  progress:    Object.fromEntries(ALL_MODULE_IDS.map(id => [id, freshProgress()])),
  currentGame: null,
  gameResult:  null,
  // ── Gamification ──
  coins:       0,
  farmLevel:   1,
  streak:      { count: 0, lastDate: null },
  dailyMission: { date: null, missions: [], completedIds: [] },
  // ── Session tracking (not persisted) ──
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

    case 'FINISH_GAME': {
      const { moduleId, level, stars, score, total } = action.payload
      const maxLevel       = MAX_LEVELS[moduleId] ?? 5
      const prev           = state.progress[moduleId] ?? freshProgress()
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
      const earnedCoins = COIN_PER_STAR[stars] ?? 0
      // Bonus coins for first-time pass or new best
      const bonusCoins  = isFirstPass ? 5 : isNewBest ? 3 : 0
      const totalCoins  = earnedCoins + bonusCoins
      const newCoins    = (state.coins ?? 0) + totalCoins

      // ── Session tracking ──
      const newPlayed        = [...new Set([...(state._played ?? []), moduleId])]
      const newSessionPlays  = (state._sessionPlays ?? 0) + 1
      const newSessionLevels = (state._sessionLevels ?? 0) + (stars >= 1 ? 1 : 0)
      const newGot3Stars     = (state._got3Stars ?? false) || stars === 3

      // ── Daily mission auto-complete check ──
      const dm = state.dailyMission ?? { date: null, missions: [], completedIds: [] }
      const sessionSnap = {
        _sessionPlays:  newSessionPlays,
        _sessionLevels: newSessionLevels,
        _got3Stars:     newGot3Stars,
        _played:        newPlayed,
      }
      const newlyCompletedMissions = (dm.missions ?? []).filter(m => {
        if ((dm.completedIds ?? []).includes(m.id)) return false
        const fn = ALL_MISSIONS.find(x => x.id === m.id)?.check
        return fn ? fn(sessionSnap) : false
      })
      const missionCoins = newlyCompletedMissions.length * MISSION_COIN_REWARD
      const finalCoins   = newCoins + missionCoins
      const newCompletedIds = [...(dm.completedIds ?? []), ...newlyCompletedMissions.map(m => m.id)]

      return {
        ...state,
        screen: 'results',
        coins:  finalCoins,
        _sessionPlays:  newSessionPlays,
        _sessionLevels: newSessionLevels,
        _got3Stars:     newGot3Stars,
        _played:        newPlayed,
        dailyMission: { ...dm, completedIds: newCompletedIds },
        gameResult: {
          moduleId, level, stars, score, total,
          prevBestStars,
          isNewBest,
          isFirstPass,
          justCompleted,
          nextLevelNum,
          maxLevel,
          // Coin feedback
          coinsEarned:      totalCoins,
          missionCoins,
          newlyCompletedMissions,
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

    case 'CHECK_STREAK': {
      const today  = todayStr()
      const streak = state.streak ?? { count: 0, lastDate: null }
      if (streak.lastDate === today) return state // already checked today
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const newCount  = streak.lastDate === yesterday ? (streak.count ?? 0) + 1 : 1
      const bonusCoins = STREAK_BONUS_COINS[newCount] ?? 0
      return {
        ...state,
        coins:  (state.coins ?? 0) + bonusCoins,
        streak: { count: newCount, lastDate: today },
        // streakBonus stored separately, not in gameResult to avoid crash
      streakLastBonus: bonusCoins,
      }
    }

    case 'ENSURE_DAILY_MISSION': {
      const today = todayStr()
      const dm    = state.dailyMission ?? { date: null, missions: [], completedIds: [] }
      if (dm.date === today) return state // already set for today
      return {
        ...state,
        dailyMission: {
          date:         today,
          missions:     pickDailyMissions(today),
          completedIds: [],
        },
      }
    }

    case 'SPEND_COINS': {
      const amount = action.payload
      if ((state.coins ?? 0) < amount) return state
      return { ...state, coins: state.coins - amount }
    }

    case 'UPGRADE_FARM': {
      const farmLevel  = state.farmLevel ?? 1
      const cost = [0, 50, 100, 175, 275, 400, 550][farmLevel] ?? 999
      if ((state.coins ?? 0) < cost) return state
      return { ...state, coins: state.coins - cost, farmLevel: farmLevel + 1 }
    }

    case 'LOAD_SAVE':
      return { ...state, ...action.payload }

    default:
      return state
  }
}

function migrate(saved) {
  if (!saved.progress) return saved
  const migrated = {}
  for (const [id, val] of Object.entries(saved.progress)) {
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
  const profiles = saved.profiles ?? (saved.profile ? [saved.profile] : [])
  return {
    ...saved,
    progress:     migrated,
    profiles,
    coins:        typeof saved.coins     === 'number' ? saved.coins     : 0,
    farmLevel:    typeof saved.farmLevel === 'number' ? saved.farmLevel : 1,
    streak:       saved.streak       ?? { count: 0, lastDate: null },
    dailyMission: saved.dailyMission ?? { date: null, missions: [], completedIds: [] },
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const saved = localStorage.getItem('lumilearn_save')
      if (saved) {
        const parsed = migrate(JSON.parse(saved))
        const screen = parsed.profile ? 'home' : 'welcome'
        return { ...init, ...parsed, screen }
      }
    } catch { /* ignore */ }
    return init
  })

  // Check streak + daily mission on mount
  useEffect(() => {
    dispatch({ type: 'CHECK_STREAK' })
    dispatch({ type: 'ENSURE_DAILY_MISSION' })
  }, [])

  // Persist (exclude session-only fields)
  useEffect(() => {
    const toSave = {
      language:     state.language,
      profile:      state.profile,
      profiles:     state.profiles,
      progress:     state.progress,
      coins:        state.coins,
      farmLevel:    state.farmLevel,
      streak:       state.streak,
      dailyMission: {
        date:         state.dailyMission?.date,
        missions:     state.dailyMission?.missions,
        completedIds: state.dailyMission?.completedIds,
      },
    }
    localStorage.setItem('lumilearn_save', JSON.stringify(toSave))
  }, [state.language, state.profile, state.profiles, state.progress,
      state.coins, state.streak, state.dailyMission])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
