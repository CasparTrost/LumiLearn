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

const initialState = {
  screen:      'welcome',
  language:    null,
  profile:     null,
  profiles:    [],
  progress:    Object.fromEntries(ALL_MODULE_IDS.map(id => [id, freshProgress()])),
  currentGame: null,
  gameResult:  null,
}

function reducer(state, action) {
  switch (action.type) {

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

      return {
        ...state,
        screen: 'results',
        gameResult: {
          moduleId, level, stars, score, total,
          prevBestStars,
          isNewBest,
          isFirstPass,
          justCompleted,
          nextLevelNum,
          maxLevel,
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
  if (!saved.progress) return saved
  const migrated = {}
  for (const [id, val] of Object.entries(saved.progress)) {
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
  const profiles = saved.profiles ?? (saved.profile ? [saved.profile] : [])
  return { ...saved, progress: migrated, profiles }
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
    } catch { /* ignore corrupt saves */ }
    return init
  })

  useEffect(() => {
    const toSave = {
      language: state.language,
      profile:  state.profile,
      profiles: state.profiles,
      progress: state.progress,
    }
    localStorage.setItem('lumilearn_save', JSON.stringify(toSave))
  }, [state.language, state.profile, state.profiles, state.progress])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
