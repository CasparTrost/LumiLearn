/**
 * Lumis Tag — the rules, without any drawing: the moments of Lumi's day,
 * the times a level asks for, the clock's arithmetic and the colour of the
 * sky at any time of day.
 *
 * Times are minutes since midnight ("day minutes", 7:30 in the morning is
 * 450, half past seven in the evening 1170). The clock face only knows
 * twelve hours: its time is the day time modulo 720. The game keeps the
 * day time running on as the child turns the hands, so the sky knows
 * whether seven is morning or evening without asking the child.
 */

export const HOUR = 60
export const HALF_DAY = 720
export const DAY = 1440
export const TASKS = 6

const mod = (v, m) => ((v % m) + m) % m

// ── Levels ────────────────────────────────────────────────────────────────

/** The step the hands snap to: whole hours, then half and quarter hours, then five minutes. */
export const stepFor = level => (level <= 4 ? 60 : level <= 6 ? 30 : level <= 8 ? 15 : 5)

/** Which hands the child turns: only the short one at first, then both. */
export const handsFor = level => (level <= 4 ? 'hour' : 'both')

/**
 * How the card shows the time: a small clock to copy (1–2 and 5, when the
 * half hours are new), the hour as a big number (3–4), the digital time
 * from 6 on.
 */
export const cardFor = level => (level <= 2 || level === 5 ? 'clock' : level <= 4 ? 'number' : 'digital')

/** The little minute numbers (5, 10 … 55) on the big face, once times are digital. */
export const minuteLabels = level => cardFor(level) === 'digital'

/** The tasks (0-based) of a level in which the child reads the clock instead of setting it. */
export const readingAt = level => (level >= 9 ? [2, 4] : [])

/**
 * One hand alone: letting go of it is the answer. Two hands: the child may
 * let go in between, and the green tick says "look now".
 */
export const checksOnRelease = level => handsFor(level) === 'hour'

// ── The day ───────────────────────────────────────────────────────────────

/**
 * Lumi's day, in order. `from`–`to` is when it can happen (day minutes);
 * `art` is the picture on the card and in the day strip; `where` is where
 * Lumi does it in the window (the room of the house or outside).
 */
export const MOMENTS = [
  { id: 'fruehstueck', label: 'Frühstück',  art: '🥐',            from: 7 * 60,       to: 8 * 60,       where: 'room' },
  { id: 'kindergarten', label: 'Kindergarten', art: '🏫',            from: 8 * 60,       to: 9 * 60 + 30,  where: 'school' },
  { id: 'mittagessen', label: 'Mittagessen',  art: '🍝',            from: 11 * 60 + 30, to: 13 * 60,      where: 'room' },
  { id: 'spielplatz', label: 'Spielplatz',   art: ':px-schaukel:', from: 14 * 60 + 30, to: 16 * 60 + 30, where: 'garden' },
  { id: 'abendessen', label: 'Abendessen',   art: '🍲',            from: 17 * 60 + 30, to: 18 * 60 + 30, where: 'room' },
  { id: 'baden', label: 'Baden',        art: '🛁',            from: 18 * 60 + 45, to: 19 * 60 + 30, where: 'room' },
  { id: 'schlafen', label: 'Schlafen',     art: '🛏️',            from: 19 * 60 + 30, to: 20 * 60 + 30, where: 'room' },
]
export const MOMENT = Object.fromEntries(MOMENTS.map(m => [m.id, m]))

/** The time the clock shows when a level begins: six in the morning, Lumi still asleep. */
export const DAWN = 6 * 60

/**
 * A face that is hard to read for a child who just learnt it: the hour hand
 * almost on the next hour (from :45 on, 12:55 looked like 1:55), or the two
 * hands on top of each other (4:25). Level 9 leaves these out of its
 * reading rounds; level 10 keeps them.
 */
export function hardToRead(time) {
  const m = minuteOf(time)
  if (m >= 45) return true
  const hourAngle = faceOf(time) * 0.5, minuteAngle = m * 6
  const d = mod(hourAngle - minuteAngle, 360)
  return Math.min(d, 360 - d) < 20
}

const isNewStep = (minute, step) => {
  if (step >= 60) return true
  if (step === 5) return minute % 15 !== 0
  return minute % (step * 2) !== 0
}

/**
 * Six moments of the day in order, each with a time that fits it and lies
 * on the level's step. Breakfast opens the day and bed ends it; one of the
 * five in between is left out. Consecutive moments are at least an hour
 * apart on the whole-hour levels (45 minutes later on), so the hands always
 * have to move. Times on the step that is new in this level (the half, the
 * quarter, the odd five minutes) come up more often.
 */
export function planDay(level, rnd = Math.random) {
  const step = stepFor(level)
  const gap = step === 60 ? 60 : 45
  const reading = readingAt(level)
  const middle = MOMENTS.slice(1, -1)
  for (let attempt = 0; attempt < 200; attempt++) {
    const drop = Math.floor(rnd() * middle.length)
    const picked = [MOMENTS[0], ...middle.filter((_, i) => i !== drop), MOMENTS[MOMENTS.length - 1]]
    const out = []
    let prev = DAWN
    let ok = true
    for (const m of picked) {
      const lo = Math.max(m.from, prev + gap)
      const options = []
      const easy = level === 9 && reading.includes(out.length)
      for (let t = Math.ceil(lo / step) * step; t <= m.to; t += step) if (!easy || !hardToRead(t)) options.push(t)
      if (!options.length) { ok = false; break }
      const fresh = options.filter(t => isNewStep(t % 60, step))
      const pool = fresh.length && rnd() < 0.7 ? fresh : options
      const time = pool[Math.floor(rnd() * pool.length)]
      out.push({ moment: m.id, label: m.label, art: m.art, time, read: reading.includes(out.length) })
      prev = time
    }
    if (ok) return out
  }
  throw new Error(`no day for level ${level}`)
}

// ── Clock arithmetic ──────────────────────────────────────────────────────

/** The time on the face, 0–719 (0 is twelve o'clock). */
export const faceOf = day => mod(Math.round(day), HALF_DAY)
/** The hour the short hand stands at or has passed, 1–12. */
export const hourOf = day => Math.floor(faceOf(day) / 60) || 12
export const minuteOf = day => faceOf(day) % 60
/** The same time on the face, whatever the day. */
export const sameFace = (a, b) => faceOf(a) === faceOf(b)

/**
 * Which hand is off after a miss: 'minute' when the hour is right but not
 * the minutes, 'hour' when the minutes are right but not the hour, 'both'.
 * With the minutes right the hour hand is judged by the hour it has passed.
 */
export function offHand(day, target) {
  const mOk = minuteOf(day) === minuteOf(target)
  const hOk = hourOf(day) === hourOf(target)
  if (mOk && !hOk) return 'hour'
  if (hOk && !mOk) return 'minute'
  return 'both'
}

/** How often the cuckoo calls: the hour at a full hour, once otherwise, like a real cuckoo clock. */
export const callsFor = time => (minuteOf(time) === 0 ? hourOf(time) : 1)

/** "7:05", "12:30" — the time on a 12-hour digital display. */
export const digital = time => `${hourOf(time)}:${String(minuteOf(time)).padStart(2, '0')}`

/** "sieben Uhr", "halb acht", "Viertel nach sieben", "fünf nach halb acht" — for screen readers. */
const WORD = ['zwölf', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf']
const MIN_WORD = { 5: 'fünf', 10: 'zehn', 20: 'zwanzig' }
export function spoken(time) {
  const h = hourOf(time), m = minuteOf(time)
  const cur = WORD[h], nxt = WORD[h % 12 + 1]
  if (m === 0) return `${h === 1 ? 'ein' : cur} Uhr`
  if (m === 15) return `Viertel nach ${cur}`
  if (m === 30) return `halb ${nxt}`
  if (m === 45) return `Viertel vor ${nxt}`
  if (m === 25) return `fünf vor halb ${nxt}`
  if (m === 35) return `fünf nach halb ${nxt}`
  if (m < 30) return `${MIN_WORD[m]} nach ${cur}`
  return `${MIN_WORD[60 - m]} vor ${nxt}`
}

/**
 * Two wrong times for a reading round, from the mistakes children really
 * make: the hour the short hand is close to instead of the one it has
 * passed, the hands swapped, the long hand read from the wrong side.
 * All on the level's step and all different from the answer.
 */
export function readingOptions(time, step, rnd = Math.random) {
  const h = hourOf(time), m = minuteOf(time)
  const at = (hh, mm) => mod(hh, 12) * 60 + mod(mm, 60)
  const typical = [
    at(m >= 30 ? h + 1 : h - 1, m),                  // the hour it is close to
    m % 5 === 0 && m ? at(m / 5, (h % 12) * 5) : null, // hands swapped
    m && m !== 30 ? at(h, 60 - m) : null,             // the long hand mirrored
    at(h, m + 30),                                    // half an hour off
  ].filter(v => v != null && mod(v, 60) % step === 0 && !sameFace(v, time))
  const seen = new Set([faceOf(time)])
  const wrongs = []
  const shuffled = [...typical].sort(() => rnd() - 0.5)
  for (const v of shuffled) {
    if (wrongs.length < 2 && !seen.has(faceOf(v))) { seen.add(faceOf(v)); wrongs.push(faceOf(v)) }
  }
  while (wrongs.length < 2) {
    const v = at(1 + Math.floor(rnd() * 12), Math.floor(rnd() * (60 / step)) * step)
    if (!seen.has(v)) { seen.add(v); wrongs.push(v) }
  }
  const all = [faceOf(time), ...wrongs]
  return all.sort(() => rnd() - 0.5)
}

/**
 * The way from the day time `day` to the time of day `time` (any day),
 * forward or back, whichever is shorter. The game's day time is never
 * wrapped (the hands are drawn from it and must not spin back the long way
 * at midnight); only what it means (face, sky) is taken modulo.
 */
export function towards(day, time) {
  let d = mod(time - day, DAY)
  if (d > DAY / 2) d -= DAY
  return d
}

/**
 * After the right face time: how far the sky has to move so that it is the
 * moment's time of day (0, or half a day when the child turned the hands
 * round to the other half of the day).
 */
export const skyFix = (skyDay, time) => (mod(skyDay - time, DAY) === 0 ? 0 : towards(skyDay, time))

// ── The sky ───────────────────────────────────────────────────────────────

export const SUNRISE = 5 * 60 + 40
export const SUNSET = 19 * 60

// [day minute, sky at the top, sky at the horizon]
const SKY = [
  [0,    '#0E1236', '#232A66'],
  [290,  '#0E1236', '#2A2F70'],
  [345,  '#6C63B8', '#FFB37A'],
  [410,  '#6FC3FF', '#FFE2B8'],
  [600,  '#4FB3FF', '#CDEFFF'],
  [900,  '#4FB3FF', '#D6F2FF'],
  [1010, '#5AA8E8', '#FFE3A8'],
  [1090, '#7468BC', '#FF9A6B'],
  [1150, '#3A3A86', '#A05AA6'],
  [1225, '#0E1236', '#232A66'],
  [1440, '#0E1236', '#232A66'],
]

const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const toHex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
export function mix(a, b, k) {
  const A = hex(a), B = hex(b)
  return toHex(A.map((v, i) => v + (B[i] - v) * k))
}

/** The sky at a time of day: { top, bottom } colours. */
export function skyAt(day) {
  const t = mod(day, DAY)
  for (let i = 1; i < SKY.length; i++) {
    if (t <= SKY[i][0]) {
      const [t0, a0, b0] = SKY[i - 1], [t1, a1, b1] = SKY[i]
      const k = (t - t0) / (t1 - t0)
      return { top: mix(a0, a1, k), bottom: mix(b0, b1, k) }
    }
  }
  return { top: SKY[0][1], bottom: SKY[0][2] }
}

const smooth = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k) }

/** How dark it is outside, 0 (day) to 1 (night). */
export function darkness(day) {
  const t = mod(day, DAY)
  return 1 - smooth(SUNRISE - 40, SUNRISE + 60, t) + smooth(SUNSET - 60, SUNSET + 60, t)
}

/**
 * Where the sun is: `p` 0 at sunrise (left) to 1 at sunset (right), and
 * `up` its height, 0 on the horizon to 1 at noon. Outside the day, null.
 */
export function sunAt(day) {
  const t = mod(day, DAY)
  if (t < SUNRISE - 40 || t > SUNSET + 40) return null
  const p = (t - SUNRISE) / (SUNSET - SUNRISE)
  return { p, up: Math.sin(Math.PI * Math.max(0, Math.min(1, p))) }
}

/** The same for the moon, through the night. */
export function moonAt(day) {
  const t = mod(day, DAY)
  const night = DAY - SUNSET + SUNRISE
  const since = t >= SUNSET ? t - SUNSET : t + DAY - SUNSET
  if (since > night) return null
  const p = since / night
  return { p, up: Math.sin(Math.PI * p) }
}
