/**
 * Monster-Farbdusche: the paints, what they mix to, and the ten levels.
 *
 * Five paints come out of the taps. A mix is the SET of paints in the tank
 * (the same paint twice is just that paint), and every one of the 25 sets
 * of one to three paints gives a colour: the recipes a child should learn
 * give clean, named colours, everything else a plausible mixture, so
 * trying things out always shows something.
 */

export const PAINTS = ['rot', 'gelb', 'blau', 'weiß', 'schwarz']
export const MAX_SQUIRTS = 3

// id → { hex, word } — `word` is what Lumi says (lib/words.js colorWord);
// colours without a recording are simply not spoken.
export const COLORS = {
  rot:        { hex: '#f0443a', word: 'rot' },
  gelb:       { hex: '#ffd428', word: 'gelb' },
  blau:       { hex: '#2f7df0', word: 'blau' },
  weiß:       { hex: '#ffffff', word: 'weiß' },
  schwarz:    { hex: '#2b2733', word: 'schwarz' },
  orange:     { hex: '#ff8a1f', word: 'orange' },
  grün:       { hex: '#3fb548', word: 'grün' },
  lila:       { hex: '#8e4fd6', word: 'lila' },
  pink:       { hex: '#ff7fb6', word: 'pink' },
  hellblau:   { hex: '#96d6ff', word: 'hellblau' },
  hellgrün:   { hex: '#aee67c', word: 'hellgrün' },
  grau:       { hex: '#8d8d9b', word: 'grau' },
  braun:      { hex: '#8a5a33', word: 'braun' },
  dunkelrot:  { hex: '#8f1d24', word: 'dunkelrot' },
  dunkelblau: { hex: '#1d3a8a', word: 'dunkelblau' },
  // light and dark versions that follow the same rule (white makes it
  // lighter, black darker); wished for only in the last two levels
  helllila:   { hex: '#c9a3ee', word: 'helllila' },
  dunkelgrün: { hex: '#1f6b33', word: 'dunkelgrün' },
  // never wished for, only what comes out when a child tries things
  hellgelb:   { hex: '#fff3a6' },
  oliv:       { hex: '#8a7a1e' },
  apricot:    { hex: '#ffc59a' },
  altrosa:    { hex: '#b0707e' },
  sand:       { hex: '#c9c08a' },
  graublau:   { hex: '#6f8fb5' },
  dunkellila: { hex: '#4a2a78' },
}

// Paints of a set, always in the order of PAINTS, joined with "+"
const keyOf = paints => PAINTS.filter(p => paints.includes(p)).join('+')

const MIXES = {
  'rot': 'rot', 'gelb': 'gelb', 'blau': 'blau', 'weiß': 'weiß', 'schwarz': 'schwarz',
  'rot+gelb': 'orange', 'gelb+blau': 'grün', 'rot+blau': 'lila',
  'rot+weiß': 'pink', 'blau+weiß': 'hellblau', 'gelb+weiß': 'hellgelb',
  'weiß+schwarz': 'grau', 'rot+schwarz': 'dunkelrot', 'blau+schwarz': 'dunkelblau', 'gelb+schwarz': 'oliv',
  'rot+gelb+blau': 'braun', 'rot+gelb+schwarz': 'braun',
  'gelb+blau+weiß': 'hellgrün', 'rot+blau+weiß': 'helllila', 'rot+gelb+weiß': 'apricot',
  'gelb+blau+schwarz': 'dunkelgrün', 'rot+blau+schwarz': 'dunkellila',
  'rot+weiß+schwarz': 'altrosa', 'gelb+weiß+schwarz': 'sand', 'blau+weiß+schwarz': 'graublau',
}

/** The colour (id) a tank holding these paints gives; null when it is empty. */
export function mixOf(paints) {
  return paints?.length ? MIXES[keyOf(paints)] ?? null : null
}

// The recipe shown as blobs in the thought bubble (brown has two; the one
// from the three first paints is shown)
const RECIPES = {}
for (const [key, id] of Object.entries(MIXES)) RECIPES[id] ??= key.split('+')
export const recipeOf = id => RECIPES[id]

export const hexOf = id => COLORS[id]?.hex ?? '#cccccc'

/** True for skins so dark that a face drawn in ink would vanish on them. */
export function isDark(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b < 110
}

// ── Levels ────────────────────────────────────────────────────────────────
// taps: the paints on offer; must: the colours every round of the level
// asks for; pool: what the other monsters wish for; n: monsters;
// teach: a `must` colour shows its recipe the first time (the odd levels
// teach, the even ones ask without help); easyFirst: the level opens with
// a colour from the pool; line: the next monster waits in view with its
// wish, so a child can plan ahead.
const FIRST3 = ['rot', 'gelb', 'blau']
const TWO = ['orange', 'grün', 'lila']
const LIGHT = ['pink', 'hellblau', 'hellgrün']
const DARK = ['grau', 'braun', 'dunkelrot', 'dunkelblau']
const THREE = ['hellgrün', 'braun', 'helllila', 'dunkelgrün']

export const LEVELS = [
  { taps: FIRST3, must: FIRST3, pool: FIRST3, n: 5 },
  { taps: PAINTS, must: PAINTS, pool: PAINTS, n: 5 },
  { taps: FIRST3, must: TWO, teach: true, pool: FIRST3, n: 5, easyFirst: true },
  { taps: FIRST3, must: TWO, pool: [...FIRST3, ...TWO], n: 6 },
  { taps: PAINTS.slice(0, 4), must: LIGHT, teach: true, pool: [...TWO, 'weiß'], n: 6, easyFirst: true },
  { taps: PAINTS.slice(0, 4), must: LIGHT, pool: [...TWO, ...LIGHT, 'weiß'], n: 6 },
  { taps: PAINTS, must: DARK, teach: true, pool: [...TWO, ...LIGHT], n: 7, easyFirst: true },
  { taps: PAINTS, must: DARK, pool: [...TWO, ...LIGHT, ...DARK, 'schwarz'], n: 7 },
  { taps: PAINTS, must: ['braun', 'hellgrün', 'helllila'], pool: [...TWO, ...LIGHT, ...DARK, ...THREE], n: 8, line: true },
  { taps: PAINTS, must: THREE, pool: [...LIGHT, ...DARK, ...THREE], n: 8, line: true },
]

export const MONSTER_KINDS = ['blob', 'cyclops', 'fuzzy', 'box', 'ghost', 'wide']

const shuffle = (list, rnd) => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/**
 * The monsters of a level: { taps, line, monsters: [{ target, kind, recipe }] }
 * — `recipe` true when the bubble shows how the colour is mixed from the
 * start.
 */
export function planLevel(level, rnd = Math.random) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))]
  const targets = shuffle(cfg.must, rnd).slice(0, cfg.n)
  // fill up from the pool: colours not asked for yet first, none three times
  for (let guard = 0; targets.length < cfg.n && guard < 400; guard++) {
    const pick = cfg.pool[Math.floor(rnd() * cfg.pool.length)]
    const count = targets.filter(t => t === pick).length
    if (count >= 2 || (count >= 1 && guard < 80)) continue
    targets.push(pick)
  }
  // never the same wish twice in a row
  let order = shuffle(targets, rnd)
  for (let tries = 0; tries < 40 && order.some((t, i) => i && t === order[i - 1]); tries++) order = shuffle(targets, rnd)
  // a teaching level opens with something known, so the first new colour
  // is not also the first thing a child meets
  if (cfg.easyFirst) {
    const easy = order.findIndex(t => !cfg.must.includes(t))
    if (easy > 0) order.unshift(...order.splice(easy, 1))
  }
  const kinds = shuffle(MONSTER_KINDS, rnd)
  const taught = new Set()
  return {
    taps: cfg.taps,
    line: !!cfg.line,
    monsters: order.map((target, i) => {
      const recipe = !!cfg.teach && cfg.must.includes(target) && !taught.has(target)
      taught.add(target)
      return { target, kind: kinds[i % kinds.length], recipe }
    }),
  }
}
