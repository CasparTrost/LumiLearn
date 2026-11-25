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
 *   slot   where it is worn: 'head', 'face' or 'neck' (one of each at a time)
 *   stars  the total of stars that unlocks it (0: there from the start)
 *   src    the picture, square, transparent
 *   at     the point of the picture [x, y] (0…1) that goes on the anchor:
 *            head  the top of Lumi's head, under the feather tuft
 *            face  the middle between Lumi's eyes
 *            neck  the middle of Lumi's neck line, under the head
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
 *   say    the key of the recorded name (lib/lumiLines.js), when there is one
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
    tuft: [[140, 0], [262, 0], [262, 58], [230, 57], [192, 53], [154, 57], [140, 60]],
  },
  happy: {
    head: { x: 196, y: 62, rot: 3, w: 190 },
    face: { x: 193, y: 137, rot: 3, w: 104 },
    neck: { x: 196, y: 212, rot: 0, w: 180 },
    tuft: [[150, 0], [270, 0], [270, 60], [235, 62], [196, 60], [160, 66], [150, 70]],
  },
  sad: {
    head: { x: 192, y: 66, rot: 3, w: 186 },
    face: { x: 189, y: 181, rot: 4, w: 98 },
    neck: { x: 190, y: 238, rot: 0, w: 170 },
    tuft: [[150, 0], [260, 0], [260, 66], [230, 64], [192, 64], [160, 70], [150, 74]],
  },
  hmm: {
    head: { x: 190, y: 58, rot: -12, w: 180 },
    face: { x: 190, y: 138, rot: -16, w: 92 },
    neck: { x: 180, y: 228, rot: -4, w: 160 },
    tuft: [[135, 0], [245, 0], [245, 58], [215, 60], [190, 58], [160, 66], [135, 70]],
    front: [[205, 196], [222, 186], [246, 196], [276, 232], [292, 262], [300, 300], [262, 306], [228, 268], [214, 236]],
  },
  think: {
    head: { x: 190, y: 58, rot: -12, w: 180 },
    face: { x: 190, y: 138, rot: -16, w: 92 },
    neck: { x: 180, y: 228, rot: -4, w: 160 },
    tuft: [[135, 0], [245, 0], [245, 58], [215, 60], [190, 58], [160, 66], [135, 70]],
    front: [[205, 196], [222, 186], [246, 196], [276, 232], [292, 262], [300, 300], [262, 306], [228, 268], [214, 236]],
  },
  sleep: {
    head: { x: 188, y: 80, rot: -4, w: 210 },
    face: { x: 180, y: 190, rot: -12, w: 112 },
    neck: { x: 192, y: 252, rot: 0, w: 200 },
    tuft: [[140, 0], [255, 0], [255, 78], [220, 80], [188, 78], [158, 84], [140, 88]],
  },
  wave: {
    head: { x: 212, y: 58, rot: 6, w: 185 },
    face: { x: 206, y: 145, rot: 6, w: 95 },
    neck: { x: 215, y: 220, rot: 3, w: 170 },
    tuft: [[175, 0], [275, 0], [275, 60], [245, 60], [212, 56], [185, 64], [175, 70]],
  },
}
export const POSE_IDS = Object.keys(POSES)

// ── The things ──────────────────────────────────────────────────────────────
// The order is the order of unlocking. The first two are there from the
// start (the wardrobe is never empty), then a new thing every game or two
// (a round gives up to three stars), later a little slower. A new thing
// continues the steps: the gap to the one before grows by one star.
export const SLOTS = ['head', 'face', 'neck']
const pic = id => `sprites/wardrobe/${id}.webp`

export const WARDROBE = [
  { id: 'muetze',       name: 'Bommelmütze',  slot: 'head', stars: 0,  src: pic('muetze'),       at: [0.5, 0.523], size: 1.18, box: [0.09, 0.17, 0.91, 0.84], tuft: 'hide' },
  { id: 'sonnenbrille', name: 'Sonnenbrille', slot: 'face', stars: 0,  src: pic('sonnenbrille'), at: [0.5, 0.48], size: 2.15, box: [0, 0.34, 1, 0.68], say: 'wort/sonnenbrille' },
  { id: 'schal',        name: 'Schal',        slot: 'neck', stars: 3,  src: pic('schal'),        at: [0.5, 0.3],  size: 1.12, box: [0.03, 0.22, 0.97, 0.78] },
  { id: 'partyhut',     name: 'Partyhut',     slot: 'head', stars: 6,  src: pic('partyhut'),     at: [0.5, 0.84], size: 0.72, box: [0.21, 0.04, 0.8, 0.9], dx: -0.2, dy: 0.08, rot: -18 },
  { id: 'herzbrille',   name: 'Herzbrille',   slot: 'face', stars: 10, src: pic('herzbrille'),   at: [0.5, 0.47], size: 2.2,  box: [0, 0.27, 1, 0.68] },
  { id: 'blumenkranz',  name: 'Blumenkranz',  slot: 'head', stars: 15, src: pic('blumenkranz'),  at: [0.5, 0.56], size: 1.25, box: [0.04, 0.35, 0.96, 0.8], tuft: 'front' },
  { id: 'fliege',       name: 'Fliege',       slot: 'neck', stars: 21, src: pic('fliege'),       at: [0.5, 0.44], size: 0.6,  box: [0.08, 0.31, 0.92, 0.7] },
  { id: 'piratenhut',   name: 'Piratenhut',   slot: 'head', stars: 28, src: pic('piratenhut'),   at: [0.5, 0.53], size: 1.1,  box: [0.04, 0.15, 0.99, 0.84], tuft: 'hide' },
  { id: 'rundbrille',   name: 'Runde Brille', slot: 'face', stars: 36, src: pic('rundbrille'),   at: [0.5, 0.5],  size: 2.1,  box: [0, 0.31, 1, 0.69], say: 'wort/brille' },
  { id: 'zauberhut',    name: 'Zauberhut',    slot: 'head', stars: 45, src: pic('zauberhut'),    at: [0.5, 0.8],  size: 1.06, box: [0.05, 0.05, 0.95, 0.9], tuft: 'hide' },
  { id: 'medaille',     name: 'Medaille',     slot: 'neck', stars: 55, src: pic('medaille'),     at: [0.5, 0.13], size: 0.8,  box: [0.15, 0.1, 0.85, 0.77] },
  { id: 'krone',        name: 'Krone',        slot: 'head', stars: 66, src: pic('krone'),        at: [0.5, 0.66], size: 0.82, box: [0.08, 0.27, 0.93, 0.8], tuft: 'front', say: 'wort/krone' },
]
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
  const out = { head: null, face: null, neck: null }
  if (outfit && typeof outfit === 'object') {
    for (const s of SLOTS) if (ITEM_BY_ID[outfit[s]]?.slot === s) out[s] = outfit[s]
  }
  return out
}
export const wornItems = outfit => (outfit ? SLOTS.map(s => ITEM_BY_ID[outfit[s]]).filter(t => t && SLOTS.includes(t.slot) && outfit[t.slot] === t.id) : [])

// ── Drawing ─────────────────────────────────────────────────────────────────
const LUMI_POSE = {
  happy: 'happy', dance: 'happy', eat: 'happy', excited: 'happy', encouraging: 'happy', cheer: 'happy', proud: 'happy',
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
  const layers = [{ kind: 'pose', clip: hat?.tuft === 'hide' && P.tuft ? `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${poly(P.tuft)}, ${poly([P.tuft[0]])}, 0% 0%)` : null }]
  const item = t => {
    const p = placeItem(t, pose)
    return { kind: 'item', id: t.id, src: t.src, left: pct(p.left), top: pct(p.top), size: pct(p.size), rot: p.rot, origin: `${p.ax * 100}% ${p.ay * 100}%` }
  }
  if (bySlot.neck) {
    layers.push(item(bySlot.neck))
    if (P.front) layers.push({ kind: 'pose', clip: `polygon(${poly(P.front)})` })
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
