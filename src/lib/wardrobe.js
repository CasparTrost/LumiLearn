/**
 * Lumis Kleiderschrank: the stars a child collects unlock things Lumi can
 * wear. Nothing is spent and nothing can be lost: at certain totals of
 * stars a new thing is in the wardrobe, for good.
 *
 * A thing is ONE picture plus a few numbers in WARDROBE below. To swap a
 * picture (the drawn ones for pictures made with Tripo, say), replace the
 * file in public/sprites/wardrobe/ with a square picture of the same kind
 * and, if the new picture is drawn bigger or smaller, adjust `at`, `size`
 * and `box`. No code changes. To add a thing, add a line: the screen,
 * the shelves, the unlocking and the drawing on Lumi follow from the list.
 *
 * Where a thing sits on Lumi comes from the anchors of each of Lumi's seven
 * pictures (POSES, measured on the 384 × 384 pictures in
 * public/sprites/emoji/custom/lumi-*.webp) and the thing's own numbers:
 *
 *   slot   where it is worn: 'head', 'face', 'neck', 'back' or 'hold'
 *          (one of each at a time, all five combined freely)
 *   stars  not written: from the thing's place in ORDER (see stepStars)
 *   src    the picture, square, transparent
 *   at     the point of the picture [x, y] (0…1) that goes on the anchor:
 *            head  the top of Lumi's head, under the feather tuft
 *            face  the middle between Lumi's eyes
 *            neck  the middle of Lumi's neck line, under the head
 *            back  the middle between the shoulders (drawn behind Lumi)
 *            hold  the tip of the wing that holds it (sleeping: the floor beside
 *                  Lumi); the wing tip (`grip` of the picture) is drawn over it
 *   size   the picture's width as a share of the anchor's width (the head's
 *          width, the distance between the eyes, the width of the neck)
 *   rot    an extra tilt in degrees (optional)
 *   dx, dy a shift from the anchor, as a share of the anchor's width (optional)
 *   box    the part of the picture that is drawn on [x0, y0, x1, y1] (0…1):
 *          the shelf shows that part, and Lumi gets smaller when a tall hat
 *          would leave the picture's square
 *   tuft   head things only: what happens to Lumi's feather tuft
 *            'hide'   the hat covers it
 *            'front'  it pokes up out of the hat (a crown, a wreath)
 *            none     the hat sits beside it (the party hat, worn aslant)
 *   pose   small corrections for single pictures { sleep: { dx, dy, rot, size } }
 *   behind held things only: drawn behind Lumi (an umbrella over the shoulder;
 *          also per pose: pose: { sleep: { behind: false } })
 *   over   back things only: a polygon of the picture [[x, y], …] (0…1) that is
 *          drawn again in front of Lumi (a cape's collar and clasp)
 */

// ── Lumi's pictures ─────────────────────────────────────────────────────────
// Per picture: the three anchors { x, y, rot, w } in picture pixels, the
// feather tuft above the head (a polygon: hidden under a hat or drawn again
// over it) and parts that lie in front of what is worn round the neck (the
// wing at the chin when Lumi thinks).
export const POSE_SIZE = 384
export const POSES = {
  idle: {
    head: { x: 192, y: 56, rot: 0, w: 190 },
    face: { x: 191, y: 153, rot: 0, w: 100 },
    neck: { x: 192, y: 214, rot: 0, w: 180 },
    back: { x: 192, y: 210, rot: 0, w: 210 },
    hold: { x: 308, y: 280, rot: 12, w: 105 },
    grip: [[290, 246], [306, 250], [320, 270], [330, 294], [324, 308], [306, 304], [292, 286], [286, 264]],
    tuft: [[140, 0], [262, 0], [262, 58], [230, 57], [192, 53], [154, 57], [140, 60]],
  },
  happy: {
    head: { x: 196, y: 62, rot: 3, w: 190 },
    face: { x: 193, y: 137, rot: 3, w: 104 },
    neck: { x: 196, y: 212, rot: 0, w: 180 },
    back: { x: 196, y: 208, rot: 0, w: 200 },
    hold: { x: 332, y: 194, rot: 2, w: 95 },
    grip: [[318, 160], [336, 146], [352, 150], [358, 170], [346, 200], [328, 214], [314, 206], [312, 184]],
    tuft: [[150, 0], [270, 0], [270, 60], [235, 62], [196, 60], [160, 66], [150, 70]],
  },
  sad: {
    head: { x: 192, y: 66, rot: 3, w: 186 },
    face: { x: 189, y: 181, rot: 4, w: 98 },
    neck: { x: 190, y: 238, rot: 0, w: 170 },
    back: { x: 190, y: 234, rot: 0, w: 190 },
    hold: { x: 272, y: 300, rot: 24, w: 100 },
    grip: [[244, 264], [262, 258], [280, 270], [288, 292], [282, 314], [264, 316], [250, 300], [242, 282]],
    tuft: [[150, 0], [260, 0], [260, 66], [230, 64], [192, 64], [160, 70], [150, 74]],
  },
  hmm: {
    head: { x: 190, y: 58, rot: -12, w: 180 },
    face: { x: 190, y: 138, rot: -16, w: 92 },
    neck: { x: 180, y: 228, rot: -4, w: 160 },
    back: { x: 182, y: 224, rot: 0, w: 190 },
    hold: { x: 88, y: 286, rot: -20, w: 100 },
    grip: [[104, 250], [88, 254], [72, 276], [66, 300], [74, 314], [92, 310], [104, 292], [108, 270]],
    tuft: [[135, 0], [245, 0], [245, 58], [215, 60], [190, 58], [160, 66], [135, 70]],
    front: [[205, 196], [222, 186], [246, 196], [276, 232], [292, 262], [300, 300], [262, 306], [228, 268], [214, 236]],
  },
  think: {
    head: { x: 190, y: 58, rot: -12, w: 180 },
    face: { x: 190, y: 138, rot: -16, w: 92 },
    neck: { x: 180, y: 228, rot: -4, w: 160 },
    back: { x: 182, y: 224, rot: 0, w: 190 },
    hold: { x: 88, y: 286, rot: -20, w: 100 },
    grip: [[104, 250], [88, 254], [72, 276], [66, 300], [74, 314], [92, 310], [104, 292], [108, 270]],
    tuft: [[135, 0], [245, 0], [245, 58], [215, 60], [190, 58], [160, 66], [135, 70]],
    front: [[205, 196], [222, 186], [246, 196], [276, 232], [292, 262], [300, 300], [262, 306], [228, 268], [214, 236]],
  },
  sleep: {
    head: { x: 188, y: 80, rot: -4, w: 210 },
    face: { x: 180, y: 190, rot: -12, w: 112 },
    neck: { x: 192, y: 252, rot: 0, w: 200 },
    back: { x: 192, y: 232, rot: 0, w: 200 },
    hold: { x: 338, y: 360, rot: 0, w: 84 },
    tuft: [[140, 0], [255, 0], [255, 78], [220, 80], [188, 78], [158, 84], [140, 88]],
  },
  wave: {
    head: { x: 212, y: 58, rot: 6, w: 185 },
    face: { x: 206, y: 145, rot: 6, w: 95 },
    neck: { x: 215, y: 220, rot: 3, w: 170 },
    back: { x: 215, y: 216, rot: 0, w: 190 },
    hold: { x: 314, y: 290, rot: 12, w: 100 },
    grip: [[300, 254], [316, 260], [330, 282], [334, 304], [326, 318], [308, 312], [296, 292], [292, 270]],
    tuft: [[175, 0], [275, 0], [275, 60], [245, 60], [212, 56], [185, 64], [175, 70]],
  },
}
export const POSE_IDS = Object.keys(POSES)

// ── The things ──────────────────────────────────────────────────────────────
// One file per place (wardrobe/head.js, face.js, neck.js, back.js, hold.js),
// one line per thing. The stars that unlock a thing are not written there:
// they come from the thing's place in ORDER below and one rule, so the list
// can grow and be reordered without counting stars by hand. A thing in a
// place's file that is not in ORDER yet comes after all the others (in the
// order of the files), so a new picture shows up at once.
import HEAD from './wardrobe/head.js'
import FACE from './wardrobe/face.js'
import NECK from './wardrobe/neck.js'
import BACK from './wardrobe/back.js'
import HOLD from './wardrobe/hold.js'

export const SLOTS = ['head', 'face', 'neck', 'back', 'hold']

/**
 * The order of unlocking: the first two are there from the start. The
 * first ten are the ones a child likes at once (a hat, glasses, a balloon,
 * a cape …); after them each place's things are spread evenly over the
 * rest, so no place waits much longer than another (late in the list a
 * place comes about every 50 stars), never two hats in a row, the red hats
 * far apart, the crown last.
 */
export const ORDER = [
  'muetze', 'sonnenbrille', 'ballon', 'schal', 'partyhut', 'umhang', 'herzbrille', 'zauberstab', 'katzenohren', 'fliege',
  'blumenkranz', 'clownsnase', 'perlenkette', 'schmetterling', 'lolli', 'piratenhut', 'sternbrille', 'halstuch', 'basecap', 'engel',
  'blume', 'hasenohren', 'heldenmaske', 'medaille', 'kochmuetze', 'fee', 'faehnchen', 'rundbrille', 'gloeckchen', 'cowboyhut',
  'taucherbrille', 'feuerwehrhelm', 'blumenkette', 'drache', 'eis', 'zauberhut', 'monokel', 'krawatte', 'strohhut', 'rakete',
  'windrad', 'matrosenmuetze', 'skibrille', 'herzkette', 'zylinder', 'pfau', 'schirm', 'schnurrbart', 'weihnachtsmuetze', 'sternabzeichen',
  'krone',
]

/**
 * The stars for the thing at place i of the order. The first two are free
 * (the wardrobe is never empty); then the gap between two things starts at
 * three stars (one good game) and grows by one star every six things:
 * 3,3,3,3,3,3, 4,4,4,4,4,4, 5, … With 51 things the last one needs 323
 * stars, about half of all the stars the games give (23 games with levels ×
 * 10 levels × 3 stars = 690; tests/unit/wardrobe.test.js checks it).
 */
export function stepStars(i) {
  let s = 0
  for (let k = 0; k < i - 1; k++) s += 3 + Math.floor(k / 6)
  return i < 2 ? 0 : s
}

const ALL = [...HEAD, ...FACE, ...NECK, ...BACK, ...HOLD]
const rank = id => { const i = ORDER.indexOf(id); return i === -1 ? ORDER.length + ALL.findIndex(t => t.id === id) : i }
/** Every thing, in the order of unlocking, with its stars. */
export const WARDROBE = [...ALL].sort((a, b) => rank(a.id) - rank(b.id)).map((t, i) => ({ ...t, stars: stepStars(i) }))
export const ITEM_BY_ID = Object.fromEntries(WARDROBE.map(t => [t.id, t]))

// ── Unlocking ───────────────────────────────────────────────────────────────
/** The stars that count for the wardrobe: never fewer than ever reached. */
export const wardrobeStars = (profile, total = 0) => Math.max(profile?.starsEver ?? 0, total)
export const isUnlocked = (item, stars) => !!item && item.stars <= stars
export const unlockedItems = stars => WARDROBE.filter(t => t.stars <= stars)
/** The things a new total unlocked (between two totals). */
export const unlockedBetween = (before, after) => WARDROBE.filter(t => t.stars > before && t.stars <= after)
/** The next thing still wrapped, or null. */
export const nextLocked = stars => WARDROBE.filter(t => t.stars > stars).sort((a, b) => a.stars - b.stars)[0] ?? null
/** The step before a thing: from where its "almost there" bar fills. */
export const stepBefore = item => Math.max(0, ...WARDROBE.filter(t => t.stars < item.stars).map(t => t.stars))
/** Things unlocked the child has not seen in the wardrobe yet (the sign on the button). */
export const unseenItems = (profile, stars) => unlockedItems(stars).filter(t => !(profile?.wardrobeSeen ?? []).includes(t.id))

/** What Lumi wears, cleaned: known things in their own slot only. */
export function cleanOutfit(outfit) {
  const out = Object.fromEntries(SLOTS.map(s => [s, null]))
  if (outfit && typeof outfit === 'object') {
    for (const s of SLOTS) if (ITEM_BY_ID[outfit[s]]?.slot === s) out[s] = outfit[s]
  }
  return out
}
export const wornItems = outfit => (outfit ? SLOTS.map(s => ITEM_BY_ID[outfit[s]]).filter(t => t && SLOTS.includes(t.slot) && outfit[t.slot] === t.id) : [])

// ── Drawing ─────────────────────────────────────────────────────────────────
const LUMI_POSE = {
  happy: 'happy', dance: 'happy', hop: 'happy', eat: 'happy', excited: 'happy', encouraging: 'happy', cheer: 'happy', proud: 'happy',
  sad: 'sad',
  oops: 'hmm', hmm: 'hmm', think: 'think', thinking: 'think', curious: 'think',
  sleep: 'sleep', sleepy: 'sleep', tired: 'sleep',
  wave: 'wave', hello: 'wave',
}
/** The picture for a mood (the same rule as lib/assets.js lumiArt). */
export const lumiPose = mood => LUMI_POSE[mood] ?? 'idle'

const pct = v => `${+(v / POSE_SIZE * 100).toFixed(3)}%`
const poly = pts => pts.map(([x, y]) => `${pct(x)} ${pct(y)}`).join(', ')

/** Where an item lies on a picture: its square, tilt and the point it turns round. */
export function placeItem(item, pose) {
  const P = POSES[pose] ?? POSES.idle
  const A = P[item.slot]
  const t = item.pose?.[pose] ?? {}
  const W = A.w * item.size * (t.size ?? 1)
  // the item's own shift (a share of the anchor's width, along its tilt)
  const ar = (A.rot ?? 0) * Math.PI / 180
  const sx = (item.dx ?? 0) * A.w, sy = (item.dy ?? 0) * A.w
  const x = A.x + sx * Math.cos(ar) - sy * Math.sin(ar) + (t.dx ?? 0)
  const y = A.y + sx * Math.sin(ar) + sy * Math.cos(ar) + (t.dy ?? 0)
  const rot = (A.rot ?? 0) + (item.rot ?? 0) + (t.rot ?? 0)
  const [ax, ay] = item.at
  return { left: x - ax * W, top: y - ay * W, size: W, rot, x, y, ax, ay }
}

/** The drawn part of a placed item, turned: its corners in picture pixels. */
export function itemCorners(item, pose) {
  const p = placeItem(item, pose)
  const [x0, y0, x1, y1] = item.box ?? [0, 0, 1, 1]
  const r = p.rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r)
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([u, v]) => {
    const dx = p.left + u * p.size - p.x, dy = p.top + v * p.size - p.y
    return [p.x + dx * c - dy * s, p.y + dx * s + dy * c]
  })
}

/**
 * Everything drawn for Lumi in one pose with what Lumi wears, bottom to
 * top: the picture (with the tuft cut out under a covering hat), the neck
 * thing, the parts in front of it, the face thing, the head thing, the
 * tuft again where it pokes out of a hat. Positions in percent of the
 * square. `scale`: Lumi gets smaller (standing on the same spot) when a
 * tall hat would leave the square.
 */
export function figureLayers(pose, outfit) {
  const P = POSES[pose] ?? POSES.idle
  const worn = wornItems(outfit)
  const bySlot = Object.fromEntries(worn.map(t => [t.slot, t]))
  const hat = bySlot.head
  const layers = []
  const item = t => {
    const p = placeItem(t, pose)
    return { kind: 'item', id: t.id, src: t.src, left: pct(p.left), top: pct(p.top), size: pct(p.size), rot: p.rot, origin: `${p.ax * 100}% ${p.ay * 100}%` }
  }
  // the back thing lies behind Lumi, and a held thing that leans behind
  // Lumi (`behind`: an open umbrella over the shoulder)
  const behindHold = bySlot.hold && (bySlot.hold.pose?.[pose]?.behind ?? bySlot.hold.behind)
  if (bySlot.back) layers.push(item(bySlot.back))
  if (behindHold) layers.push(item(bySlot.hold))
  layers.push({ kind: 'pose', clip: hat?.tuft === 'hide' && P.tuft ? `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${poly(P.tuft)}, ${poly([P.tuft[0]])}, 0% 0%)` : null })
  // the part of a back thing that lies in FRONT of Lumi (a cape's collar
  // and clasp): the same picture again, cut to its `over` polygon
  if (bySlot.back?.over) {
    const clip = `polygon(${bySlot.back.over.map(([x, y]) => `${+(x * 100).toFixed(2)}% ${+(y * 100).toFixed(2)}%`).join(', ')})`
    layers.push({ ...item(bySlot.back), id: `${bySlot.back.id}-over`, over: true, clip })
    // the wing at the chin (thinking) stays in front of it
    if (P.front && !bySlot.neck) layers.push({ kind: 'pose', clip: `polygon(${poly(P.front)})` })
  }
  if (bySlot.neck) {
    layers.push(item(bySlot.neck))
    if (P.front) layers.push({ kind: 'pose', clip: `polygon(${poly(P.front)})` })
  }
  // the held thing lies over Lumi; the tip of the holding wing is drawn
  // again over its stick or string, so the wing holds it
  if (bySlot.hold && !behindHold) {
    layers.push(item(bySlot.hold))
    if (P.grip) layers.push({ kind: 'pose', clip: `polygon(${poly(P.grip)})` })
  }
  if (bySlot.face) layers.push(item(bySlot.face))
  if (hat) {
    layers.push(item(hat))
    if (hat.tuft === 'front' && P.tuft) layers.push({ kind: 'pose', clip: `polygon(${poly(P.tuft)})` })
  }
  // room in the square: the lowest scale that keeps every corner inside
  let scale = 1
  const S = POSE_SIZE, M = 2
  for (const t of worn) for (const [x, y] of itemCorners(t, pose)) {
    if (y < M) scale = Math.min(scale, (S - M) / (S - y))
    if (x < M) scale = Math.min(scale, (S / 2 - M) / (S / 2 - x))
    if (x > S - M) scale = Math.min(scale, (S / 2 - M) / (x - S / 2))
  }
  return { layers, scale: Math.round(scale * 1000) / 1000 }
}
