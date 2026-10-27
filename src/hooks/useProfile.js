import { useContext } from 'react'
import { AppContext, liveStreak } from '../AppContext.jsx'

export function useProfile() {
  const { state, dispatch } = useContext(AppContext)
  const profile = state.profiles?.[state.activeProfileId] || null
  const streak = profile?.streak || { count: 0, lastDate: null }
  return {
    profile,
    progress: profile?.progress || {},
    farmLevel: profile?.farmLevel || 1,
    // a streak that was not continued yesterday shows as over
    streak: { ...streak, count: liveStreak(streak) },
    dailyMission: profile?.dailyMission || { date: null, missions: [], completedIds: [] },
    lastPlayed: profile?.lastPlayed || null,
    dispatch,
  }
}
