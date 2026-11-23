// Starting a stop of today's journey (lib/learning.js): a game, or the
// movement break.
export function startStop(dispatch, journey, idx) {
  const stop = journey?.stops?.[idx]
  if (!stop) return false
  if (stop.kind === 'move') dispatch({ type: 'START_MOVE', payload: idx })
  else dispatch({ type: 'START_GAME', payload: { moduleId: stop.moduleId, level: stop.level, journeyStop: idx } })
  return true
}
