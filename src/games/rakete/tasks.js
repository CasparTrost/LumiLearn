// Planeten-Hüpfer: the levels and the sums. No React here, so it can be
// tested (tests/unit/rakete.test.js).

/** The number line: planets 0 … TOP. */
export const TOP = 10
export const PLUS = '+'
export const MINUS = '−'

/**
 * What a level asks for.
 *   mode   hop    the child hops with the thrust buttons and lands
 *          tap    the child taps the planet; the rocket flies there in one go
 *          count  the alien waves from its planet: hop there, then say how
 *                 many hops it took (three number bubbles)
 *          pick   the alien waves from its planet: pick the number of hops
 *                 first, the rocket proves it
 *   ops    the signs that come up (both: two thrust buttons)
 *   steps  the smallest and the largest number added or taken away
 *   most   the largest result (the line always shows 0 … 10)
 *   guide  the sum shows one little arc per hop under the second number
 *   count  sums in the level
 */
export function levelPlan(level) {
  const L = Math.max(1, Math.min(10, Math.round(level) || 1))
  return ({
    1:  { mode: 'hop',   ops: [PLUS],        steps: [1, 3], most: 5,   guide: true,  count: 6 },
    2:  { mode: 'hop',   ops: [PLUS],        steps: [1, 3], most: TOP, guide: true,  count: 6 },
    3:  { mode: 'hop',   ops: [PLUS],        steps: [2, 4], most: TOP, guide: false, count: 6 },
    4:  { mode: 'hop',   ops: [MINUS],       steps: [1, 3], most: TOP, guide: true,  count: 6 },
    5:  { mode: 'hop',   ops: [PLUS, MINUS], steps: [1, 3], most: TOP, guide: false, count: 6 },
    6:  { mode: 'hop',   ops: [PLUS, MINUS], steps: [2, 5], most: TOP, guide: false, count: 6 },
    7:  { mode: 'tap',   ops: [PLUS, MINUS], steps: [1, 4], most: TOP, guide: false, count: 8 },
    8:  { mode: 'tap',   ops: [PLUS, MINUS], steps: [2, 6], most: TOP, guide: false, count: 8 },
    9:  { mode: 'count', ops: [PLUS],        steps: [2, 5], most: TOP, guide: false, count: 6 },
    10: { mode: 'pick',  ops: [PLUS, MINUS], steps: [2, 5], most: TOP, guide: false, count: 6 },
  })[L]
}

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const shuffle = list => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** The sign's way along the line: +1 forwards, −1 backwards. */
export const dirOf = op => (op === MINUS ? -1 : 1)

/**
 * The sums of a level: { op, from, step, target }. Every step of the range
 * comes up, the signs of a mixed level are shuffled half and half (never a
 * pattern to guess), no sum twice and never the same start or result twice in a row.
 */
export function buildTasks(level) {
  // The draw is random and can paint itself into a corner in the small
  // ranges of the first levels: draw again rather than repeat a sum.
  let tasks = drawTasks(level)
  for (let i = 0; i < 40 && new Set(tasks.map(t => `${t.from}${t.op}${t.step}`)).size < tasks.length; i++) tasks = drawTasks(level)
  return tasks
}

function drawTasks(level) {
  const p = levelPlan(level)
  const [lo, hi] = p.steps
  const ops = shuffle(Array.from({ length: p.count }, (_, i) => p.ops[i % p.ops.length]))
  let bag = []
  const nextStep = () => { if (!bag.length) bag = shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)); return bag.pop() }
  const out = [], seen = new Set()
  for (let i = 0; i < p.count; i++) {
    const op = ops[i]
    let task = null
    for (let guard = 0; guard < 200 && !task; guard++) {
      const step = guard < 60 ? nextStep() : rand(lo, hi)
      // plus: start at 1 or more, the result within the level's range;
      // minus: the result is 0 or more, and 0 at most now and then
      const from = op === PLUS ? rand(1, p.most - step) : rand(step + (Math.random() < 0.2 ? 0 : 1), TOP)
      if (from < 0 || from > TOP) continue
      const target = from + dirOf(op) * step
      if (target < 0 || target > p.most) continue
      // "how many hops" offers one hop more: that one has to fit on the line too
      if ((p.mode === 'count' || p.mode === 'pick') && (target < 1 || target > TOP - 1)) continue
      const key = `${from}${op}${step}`
      if (seen.has(key) && guard < 150) continue
      // never the same start or the same landing twice in a row
      if (out.length && (out[out.length - 1].from === from || out[out.length - 1].target === target) && guard < 150) continue
      seen.add(key)
      task = { op, from, step, target }
    }
    out.push(task ?? { op: PLUS, from: 1, step: lo, target: 1 + lo })
  }
  return out
}

/**
 * Three number bubbles for "how many hops": the answer and two neighbours,
 * all of them hops that stay on the line, the answer not always in the
 * middle.
 */
export function countChoices(task) {
  const room = task.op === PLUS ? TOP - task.from : task.from
  const firsts = []
  for (let a = task.step - 2; a <= task.step; a++) if (a >= 1 && a + 2 <= room) firsts.push(a)
  const a = firsts.length ? firsts[Math.floor(Math.random() * firsts.length)] : Math.max(1, task.step - 1)
  return [a, a + 1, a + 2]
}

/**
 * Where the rocket landed, compared with where it should have:
 *   right · far (past the alien) · short (not far enough) · wrongway · none (no hop)
 */
export function judge(task, landed) {
  if (landed === task.target) return 'right'
  const want = task.target - task.from, got = landed - task.from
  if (got === 0) return 'none'
  if (Math.sign(got) !== Math.sign(want)) return 'wrongway'
  return Math.abs(got) > Math.abs(want) ? 'far' : 'short'
}

/** The gaps between planets (0 = between 0 and 1) a hop from a to b flies over. */
export function gapsBetween(a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b)
  return Array.from({ length: hi - lo }, (_, i) => lo + i)
}

/**
 * The bonus stars a flight wins: only the flight of a right answer, and
 * only the stars over the gaps it flew through. A miss wins nothing (a star
 * for flying the wrong way was a reward for the mistake).
 */
export function starsWon(stars, task, landed) {
  if (judge(task, landed) !== 'right') return []
  const way = gapsBetween(task.from, landed)
  return stars.filter(g => way.includes(g))
}

/**
 * Where the rocket landed is said before the feedback, in one narration
 * ("Sieben. Noch nicht."): a narration of its own was stopped by the
 * feedback a millisecond later. A flight in one go (tap, pick) has not said
 * it yet; a hop has said it, unless the tick was pressed while the rocket
 * was still in the air (then the landing comes before the hop's word).
 */
export function landingLead(mode, saidByHop) {
  return mode === 'tap' || mode === 'pick' || !saidByHop
}

/**
 * The help of the tap levels. No hand on the answer planet before a miss
 * (that solved the sum, and a hand gliding there showed a drag where a tap
 * is wanted): the planets bounce one after the other, all of them alike,
 * to say "tap one of us". After two misses the hand taps the end of the
 * dashed way.
 */
export function tapHelp(mode, ghost) {
  if (mode !== 'tap') return null
  return ghost ? 'target' : 'wave'
}

/**
 * A gap for a new bonus star, not where one is: on the way of a sum still to
 * come (`ahead`), so a right flight can reach it. Since only right flights
 * win stars, one over a gap no sum crosses (0–1 in a plus level) hung there
 * for the whole level. Without `ahead`: anywhere on the line.
 */
export function freeGap(taken, rnd = Math.random, ahead = null) {
  const all = Array.from({ length: TOP }, (_, i) => i)
  const reach = ahead ? new Set(ahead.flatMap(t => gapsBetween(t.from, t.target))) : null
  const free = all.filter(g => !taken.includes(g) && (!reach || reach.has(g)))
  return free.length ? free[Math.floor(rnd() * free.length)] : null
}

/** Who lives on the other planets: someone else answers the door. */
export const RESIDENTS = ['🐙', '🤖', '🐌', '🐢', '🦀', '🐸', '🐧', '🦔', '🐞', '🐭', '🐼']
export const residentOf = n => RESIDENTS[n % RESIDENTS.length]

/** Each alien has its own colour: the alien picture turned round the hue circle. */
export const ALIEN_HUES = [0, 230, 105, 290, 160, 55, 320, 190]
