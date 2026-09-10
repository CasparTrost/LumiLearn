import { useContext } from 'react'
import { AppContext } from '../AppContext.jsx'

export function useProfile() {
  const { state, dispatch } = useContext(AppContext)
  const profile = state.profiles?.[state.activeProfileId] || null
  return {
    profile,
    progress: profile?.progress || {},
    coins: profile?.coins || 0,
    farmLevel: profile?.farmLevel || 1,
    streak: profile?.streak || { count: 0, lastDate: null },
    dailyMission: profile?.dailyMission || { date: null, missions: [], completedIds: [] },
    lastPlayed: profile?.lastPlayed || null,
    dispatch,
  }
}
