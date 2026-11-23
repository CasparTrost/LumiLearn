/**
 * How LumiLearn decides what a child plays next — the learning science in
 * one place, pure functions only (tested in tests/unit/learning.test.js).
 *
 * 1. Spaced retrieval (Leitner boxes). Every game is a skill. A round that
 *    went well moves the skill one box up, a hard one moves it down; each
 *    box waits longer before the skill comes back for review (1, 2, 4, 7,
 *    14, 30 days). Remembering something just before it would be forgotten
 *    is what makes it stick (Cepeda et al. 2006; Roediger & Karpicke 2006;
 *    for young children: Fritz et al. 2007).
 *
 * 2. The right difficulty. Children learn most when they get roughly four
 *    of five answers right — hard enough to think, easy enough to stay
 *    confident (Wilson et al. 2019, "the eighty-five percent rule";
 *    Vygotsky's zone of proximal development). So the next level is only
 *    the suggested one after a round with at least 60 % right on the first
 *    try; after two rounds under 40 % on the same level Lumi suggests the
 *    level before. The child can still pick any open level itself.
 *
 * 3. A daily plan with an end ("Lumis Ideen", one after the other). A few games
 *    instead of a wall of 25 (too many choices overwhelm young
 *    children: Iyengar & Lepper 2000), mixed from different worlds
 *    (interleaving: Rohrer & Taylor 2007), opened with an easy review so
 *    the day starts with a success (self-efficacy, Bandura 1977), with a
 *    movement break in the middle (activity breaks improve attention:
 *    Mahar et al. 2006) and a clear finish, so stopping is part of the
 *    game instead of a fight (AAP 2016 media guidance).
 */

export const INTERVALS = [1, 2, 4, 7, 14, 30]
export const MAX_BOX = INTERVALS.length - 1

const pad = n => String(n).padStart(2, '0')
export const dayStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 'YYYY-MM-DD' plus n days, in local time. */
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number)
  return dayStr(new Date(y, m - 1, d + n))
}

/** Whole days from a to b ('YYYY-MM-DD'); positive when b is later. */
export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

/** Share of the tasks solved on the first try, 0..1 (1 when there was nothing to count). */
export const ratioOf = (score, total) => (total > 0 ? Math.max(0, Math.min(1, score / total)) : 1)

/**
 * The skill after a finished round.
 * skill: { box, due, last, recent: [ratio, …] } — missing for a new game.
 */
export function updateSkill(skill, { ratio, today }) {
  const prevBox = skill?.box ?? 0
  const box = ratio >= 0.85 ? Math.min(MAX_BOX, prevBox + 1)
    : ratio < 0.6 ? Math.max(0, prevBox - 1)
    : prevBox
  return {
    box,
    due: addDays(today, INTERVALS[box]),
    last: today,
    recent: [...(skill?.recent ?? []), Math.round(ratio * 100) / 100].slice(-4),
  }
}

/**
 * The level to suggest next (the tile's level, the journey's level).
 * history: the ratios of the earlier rounds on this same level, oldest first.
 */
export function nextLevel({ level, currentLevel, maxLevel, ratio, sameLevelRatios = [] }) {
  const cur = currentLevel ?? 1
  if (ratio >= 0.6) return level >= cur ? Math.min(level + 1, maxLevel) : cur
  const prev = sameLevelRatios[sameLevelRatios.length - 1]
  if (level > 1 && ratio < 0.4 && prev !== undefined && prev < 0.4) return level - 1
  // stay and practise this level (a lower level played for fun leaves the
  // suggestion where it was)
  return level >= cur ? level : cur
}

/** Skills played before whose review day has come, most overdue first. */
export function dueSkills(progress, today) {
  return Object.entries(progress ?? {})
    .filter(([, p]) => p?.skill?.due && p.skill.due <= today)
    .sort(([, a], [, b]) => (a.skill.due < b.skill.due ? -1 : a.skill.due > b.skill.due ? 1 : (a.skill.box ?? 0) - (b.skill.box ?? 0)))
    .map(([id]) => id)
}

/** How sure the child is with a game: 0 new … 3 sure, for the parents' report. */
export function mastery(p) {
  if (!p || !(p.plays > 0 || Object.keys(p.levelStars ?? {}).length)) return 0
  const box = p.skill?.box ?? 0
  return p.completed && box >= 3 ? 3 : box >= 2 || p.completed ? 2 : 1
}

/**
 * Today's journey: four games and a movement break, then the treasure.
 *
 *   mods      the games this child sees, in learning order (sortForAge)
 *   progress  profile.progress
 *   age       4..7
 *   maxLevels MAX_LEVELS
 *
 * Stops: { kind: 'warmup' | 'learn' | 'new' | 'review' | 'move', moduleId?, level? }
 */
export function planJourney({ mods, progress = {}, age = 5, maxLevels = {}, today }) {
  const played = m => (progress[m.id]?.plays ?? 0) > 0 || Object.keys(progress[m.id]?.levelStars ?? {}).length > 0
  const fits = m => (m.minAge ?? 4) <= age
  const levelOf = id => Math.min(progress[id]?.currentLevel ?? 1, maxLevels[id] ?? 10)
  // free painting has nothing to practise
  const learnable = mods.filter(m => m.id !== 'coloring')
  const used = new Set()
  const worlds = []
  const stop = (kind, m, level) => {
    used.add(m.id); worlds.push(m.world)
    return { kind, moduleId: m.id, level: level ?? levelOf(m.id) }
  }
  // prefer a game from a world not on the journey yet (interleaving)
  const pick = list => {
    const free = list.filter(m => !used.has(m.id))
    return free.find(m => !worlds.includes(m.world)) ?? free[0]
  }
  const byId = Object.fromEntries(learnable.map(m => [m.id, m]))

  const due = dueSkills(progress, today).map(id => byId[id]).filter(Boolean)
  const started = learnable.filter(m => played(m) && !progress[m.id]?.completed)
  const fresh = learnable.filter(m => !played(m) && fits(m))
  const anyPlayed = learnable.filter(played)

  const stops = []
  // 1 · warm-up: a skill that is due, else one the child knows well,
  //     one level below the current one — the day starts with a success
  const warm = pick(due) ?? pick([...anyPlayed].sort((a, b) => (progress[b.id]?.skill?.box ?? 0) - (progress[a.id]?.skill?.box ?? 0)))
  if (warm) {
    const lv = levelOf(warm.id)
    stops.push(stop('warmup', warm, due.includes(warm) ? lv : Math.max(1, lv - 1)))
  }
  // 2 · learn: the game the child is in the middle of
  const learn = pick(started) ?? pick(fresh)
  if (learn) stops.push(stop(played(learn) ? 'learn' : 'new', learn))
  // 3 · move
  stops.push({ kind: 'move' })
  // 4 · something new (curiosity), else the next game in progress
  const nov = pick(fresh) ?? pick(started)
  if (nov) stops.push(stop(played(nov) ? 'learn' : 'new', nov))
  // 5 · review from another world, else anything not on the journey yet
  const rev = pick(due) ?? pick(started) ?? pick(anyPlayed) ?? pick(fresh) ?? pick(learnable)
  if (rev) stops.push(stop(played(rev) ? 'review' : 'new', rev))
  // A new child: fill up with the first games of the learning path
  while (stops.filter(s => s.kind !== 'move').length < 4) {
    const m = pick(learnable.filter(fits)) ?? pick(learnable)
    if (!m) break
    stops.push(stop(played(m) ? 'review' : 'new', m))
  }
  return stops
}

/** The journey stored for today, or a new one. */
export function journeyFor(profile, ctx) {
  const j = profile?.journey
  if (j?.date === ctx.today && Array.isArray(j.stops) && j.stops.length) return j
  return { date: ctx.today, stops: planJourney({ ...ctx, progress: profile?.progress ?? {}, age: profile?.age ?? 5 }), done: [], chest: null }
}

/** Index of the first stop not done yet, or -1 when the journey is over. */
export const nextStopIndex = j => (j?.stops ?? []).findIndex((_, i) => !(j.done ?? []).includes(i))
