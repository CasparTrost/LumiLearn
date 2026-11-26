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
 *   slot   where it is worn: 'head', 'face', 'neck', 'back', 'hold', 'top',
 *          'bottom' or 'shoes' (one of each at a time, all eight combined freely)
 *   stars  not written: from the thing's place in ORDER (see stepStars)
 *   src    the picture, square, transparent
 *   at     the point of the picture [x, y] (0…1) that goes on the anchor:
 *            head  the top of Lumi's head, under the feather tuft
 *            face  the middle between Lumi's eyes
 *            neck  the middle of Lumi's neck line, under the head
 *            back  the middle between the shoulders (drawn behind Lumi)
 *            hold  the tip of the wing that holds it (sleeping: the floor beside
 *                  Lumi); the wing tip (`grip` of the picture) is drawn over it
 *            top   the middle of the neck line (a shirt's collar); the wings
 *                  (`wings` of the picture) are drawn again over it
 *            bottom the waist; under the top's hem
 *            shoes one foot: the middle between the feet a `step` to the side;
 *                  `at` is a point of the LEFT shoe of the pair picture, the
 *                  right shoe is the other half, mirrored about the middle
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
 *   apart  neck things: the picture cut in two at its middle and the halves
 *          moved this share of the anchor's width apart (headphones)
 *   edge   true: a thin dark outline (a yellow thing on the yellow chick)
 *   cutTop the picture is drawn from this share of its height down only (a
 *          hood or a space suit's collar ring cut off; the shelf shows it whole)
 *   cut    the picture is drawn down to this share of its height only (also
 *          per pose: a scarf's end over the feet when Lumi sits)
 *   sy     clothes only: the picture's height as a share of its width (a
 *          shirt squashed to Lumi's round body; also per pose)
 *   feet   bottoms only: false hides the shoes (a mermaid's tail)
 *   spread back things only: a pair of wings, in degrees. The picture is cut
 *          in two at `at` and each half turned outwards and down about that
 *          point, so the wings stand out at the sides of the body, below the
 *          head (wings drawn rising beside the head read as ears). As
 *          [degrees, keep]: only the picture down to `keep` (0…1) is drawn
 *          (the lower wings would peep out between Lumi's feet)
 */

// ── Lumi's pictures ─────────────────────────────────────────────────────────
// POSES is the chick's set. Every drawing function takes another set as its
// last argument (`poses`), so another figure (lib/shapes.js) plugs in its
// own: per pose the anchors head, face, neck, back, hold, top, bottom,
// shoes ({ x, y, rot, w }, shoes also `step`, the distance of a foot from
// the middle), and the polygons tuft (what pokes up above the head), grip
// (the wing tip that holds; not needed asleep), front (a wing in front of
// the neck, optional), wings (drawn again over clothes), soles (cut away
// under shoes standing) and feet (only where the feet lie in front of the
// body, sitting); another figure may add tail (drawn again over clothes)
// and ownWings (cut away under wings worn). Measured on the 384 × 384
// square; scripts/art/
// wardrobe-anchors.mjs draws plain test shapes on them.
// Per picture: the three anchors { x, y, rot, w } in picture pixels, the
// feather tuft above the head (a polygon: hidden under a hat or drawn again
// over it) and parts that lie in front of what is worn round the neck (the
// wing at the chin when Lumi thinks).
export const POSE_SIZE = 384
export const POSES = {
  idle: {
    head: { x: 192, y: 57, rot: 0, w: 190 },
    face: { x: 191, y: 153, rot: 0, w: 100 },
    neck: { x: 192, y: 212, rot: 0, w: 176 },
    back: { x: 192, y: 210, rot: 0, w: 210 },
    hold: { x: 308, y: 280, rot: 12, w: 105 },
    grip: [[290, 246], [306, 250], [320, 270], [330, 294], [324, 308], [306, 304], [292, 286], [286, 264]],
    top: { x: 192, y: 216, rot: 0, w: 175 },
    bottom: { x: 192, y: 295, rot: 0, w: 172 },
    shoes: { x: 191, y: 357, rot: 0, w: 55, step: 44 },
    soles: [[92, 359], [290, 359], [290, 384], [92, 384]],
    tuft: [[140, 0], [262, 0], [262, 58], [230, 57], [192, 53], [154, 57], [140, 60]],
    wings: [[[106, 216], [82, 238], [62, 268], [60, 284], [72, 298], [98, 302], [118, 290], [124, 262], [120, 232]], [[279, 216], [302, 238], [322, 268], [324, 284], [312, 298], [286, 302], [266, 290], [262, 262], [266, 232]]],
  },
  happy: {
    head: { x: 192, y: 62, rot: 2, w: 190 },
    face: { x: 193, y: 136, rot: 6, w: 104 },
    neck: { x: 193, y: 210, rot: 0, w: 180 },
    back: { x: 193, y: 208, rot: 0, w: 200 },
    hold: { x: 332, y: 194, rot: 2, w: 95 },
    grip: [[318, 160], [336, 146], [352, 150], [358, 170], [346, 200], [328, 214], [314, 206], [312, 184]],
    top: { x: 192, y: 214, rot: 0, w: 185 },
    bottom: { x: 190, y: 292, rot: 0, w: 185 },
    shoes: { x: 189, y: 356, rot: 0, w: 60, step: 57 },
    soles: [[72, 358], [306, 358], [306, 384], [72, 384]],
    tuft: [[150, 0], [270, 0], [270, 60], [235, 62], [196, 60], [160, 66], [150, 70]],
    wings: [[[118, 212], [100, 200], [80, 172], [58, 152], [34, 148], [30, 172], [42, 200], [60, 218], [90, 226], [112, 226]], [[266, 212], [285, 190], [300, 160], [322, 140], [345, 150], [352, 175], [340, 205], [315, 228], [290, 235], [270, 230]]],
  },
  sad: {
    head: { x: 192, y: 66, rot: 2, w: 186 },
    face: { x: 189, y: 181, rot: 4, w: 98 },
    neck: { x: 190, y: 230, rot: 0, w: 166 },
    back: { x: 190, y: 228, rot: 0, w: 190 },
    hold: { x: 272, y: 300, rot: 24, w: 100 },
    grip: [[244, 264], [262, 258], [280, 270], [288, 292], [282, 314], [264, 316], [250, 300], [242, 282]],
    top: { x: 190, y: 242, rot: 0, w: 170 },
    bottom: { x: 190, y: 298, rot: 0, w: 172 },
    shoes: { x: 190, y: 355, rot: 0, w: 50, step: 38 },
    soles: [[102, 357], [278, 357], [278, 384], [102, 384]],
    tuft: [[150, 0], [260, 0], [260, 66], [230, 64], [192, 64], [160, 70], [150, 74]],
    wings: [[[104, 256], [115, 246], [142, 250], [165, 264], [178, 290], [174, 306], [148, 306], [118, 296], [104, 280]], [[276, 256], [265, 246], [238, 250], [215, 264], [202, 290], [206, 306], [232, 306], [262, 296], [276, 280]]],
  },
  hmm: {
    head: { x: 174, y: 61, rot: -7, w: 180 },
    face: { x: 190, y: 138, rot: -16, w: 92 },
    neck: { x: 186, y: 224, rot: -3, w: 164 },
    back: { x: 186, y: 222, rot: 0, w: 190 },
    hold: { x: 88, y: 286, rot: -20, w: 100 },
    grip: [[104, 250], [88, 254], [72, 276], [66, 300], [74, 314], [92, 310], [104, 292], [108, 270]],
    top: { x: 188, y: 226, rot: -4, w: 165 },
    bottom: { x: 190, y: 296, rot: 0, w: 170 },
    shoes: { x: 188, y: 355, rot: 0, w: 60, step: 43 },
    soles: [[85, 357], [291, 357], [291, 384], [85, 384]],
    tuft: [[135, 0], [245, 0], [245, 58], [215, 60], [190, 58], [160, 66], [135, 70]],
    wings: [[[112, 226], [96, 234], [82, 252], [80, 272], [88, 288], [108, 298], [124, 294], [128, 262], [124, 236]], [[205, 196], [222, 186], [246, 196], [276, 232], [292, 262], [300, 300], [262, 306], [228, 268], [214, 236]]],
    front: [[205, 196], [222, 186], [246, 196], [276, 232], [292, 262], [300, 300], [262, 306], [228, 268], [214, 236]],
  },
  think: {
    head: { x: 174, y: 61, rot: -7, w: 180 },
    face: { x: 190, y: 138, rot: -16, w: 92 },
    neck: { x: 186, y: 224, rot: -3, w: 164 },
    back: { x: 186, y: 222, rot: 0, w: 190 },
    hold: { x: 88, y: 286, rot: -20, w: 100 },
    grip: [[104, 250], [88, 254], [72, 276], [66, 300], [74, 314], [92, 310], [104, 292], [108, 270]],
    top: { x: 188, y: 226, rot: -4, w: 165 },
    bottom: { x: 190, y: 296, rot: 0, w: 170 },
    shoes: { x: 188, y: 355, rot: 0, w: 60, step: 43 },
    soles: [[85, 357], [291, 357], [291, 384], [85, 384]],
    tuft: [[135, 0], [245, 0], [245, 58], [215, 60], [190, 58], [160, 66], [135, 70]],
    wings: [[[112, 226], [96, 234], [82, 252], [80, 272], [88, 288], [108, 298], [124, 294], [128, 262], [124, 236]], [[205, 196], [222, 186], [246, 196], [276, 232], [292, 262], [300, 300], [262, 306], [228, 268], [214, 236]]],
    front: [[205, 196], [222, 186], [246, 196], [276, 232], [292, 262], [300, 300], [262, 306], [228, 268], [214, 236]],
  },
  sleep: {
    head: { x: 182, y: 82, rot: -3, w: 210 },
    face: { x: 180, y: 190, rot: -12, w: 112 },
    neck: { x: 184, y: 236, rot: -3, w: 186 },
    back: { x: 186, y: 232, rot: 0, w: 200 },
    hold: { x: 338, y: 360, rot: 0, w: 84 },
    top: { x: 184, y: 240, rot: 0, w: 220 },
    bottom: { x: 184, y: 315, rot: 0, w: 225 },
    shoes: { x: 182, y: 338, rot: 0, w: 65, step: 79 },
    tuft: [[140, 0], [255, 0], [255, 78], [220, 80], [188, 78], [158, 84], [140, 88]],
    wings: [[[70, 262], [80, 252], [110, 256], [140, 270], [160, 300], [158, 318], [130, 318], [95, 300], [72, 282]], [[288, 262], [278, 254], [250, 256], [222, 268], [200, 292], [204, 312], [232, 312], [268, 300], [290, 282]]],
    feet: [[[72, 318], [100, 305], [130, 310], [138, 340], [130, 370], [100, 372], [75, 350]], [[230, 318], [260, 305], [290, 312], [295, 340], [280, 370], [250, 372], [228, 350]]],
  },
  wave: {
    head: { x: 208, y: 58, rot: 5, w: 185 },
    face: { x: 206, y: 145, rot: 6, w: 95 },
    neck: { x: 210, y: 218, rot: 3, w: 170 },
    back: { x: 210, y: 216, rot: 0, w: 190 },
    hold: { x: 314, y: 290, rot: 12, w: 100 },
    grip: [[300, 254], [316, 260], [330, 282], [334, 304], [326, 318], [308, 312], [296, 292], [292, 270]],
    top: { x: 205, y: 222, rot: 3, w: 170 },
    bottom: { x: 205, y: 295, rot: 0, w: 165 },
    shoes: { x: 210, y: 352, rot: 0, w: 58, step: 47 },
    soles: [[105, 354], [315, 354], [315, 384], [105, 384]],
    tuft: [[175, 0], [275, 0], [275, 60], [245, 60], [212, 56], [185, 64], [175, 70]],
    wings: [[[125, 252], [110, 245], [85, 225], [65, 200], [58, 170], [62, 150], [78, 125], [100, 130], [118, 165], [135, 205], [138, 240]], [[262, 212], [280, 215], [305, 240], [325, 265], [328, 295], [312, 300], [290, 290], [268, 270], [260, 240]]],
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
import TOP from './wardrobe/top.js'
import BOTTOM from './wardrobe/bottom.js'
import SHOES from './wardrobe/shoes.js'
import CHICK_WORN from './wardrobe/chick-worn.js'

export const SLOTS = ['head', 'face', 'neck', 'back', 'hold', 'top', 'bottom', 'shoes']

/**
 * The order of unlocking: the first two are there from the start. The
 * first ten are the ones a child likes at once (a hat, glasses, a balloon,
 * wings …), and the first thing of each place is the picture on its tab
 * in the wardrobe, so it has to say the place (wings for the back: a cape
 * alone read as a skirt); after them each place's things are spread evenly
 * over the rest, never two of one place in a row, the red hats far apart,
 * the crown last. The first top, trousers and shoes come within the first
 * 30 stars. A place with many things comes often (a hat about every 20
 * stars), the back with its seven things least often (every 45 to 75 stars).
 */
export const ORDER = [
  'muetze', 'sonnenbrille', 'ballon', 'schal', 'partyhut', 'schmetterling', 'ringelshirt', 'herzbrille', 'jeansshorts', 'zauberstab',
  'turnschuhe', 'katzenohren', 'fliege', 'blumenkranz', 'heldenshirt', 'fussballshorts', 'gummistiefel', 'clownsnase', 'perlenkette', 'piratenhut',
  'lolli', 'fussballtrikot', 'tutu', 'hasenpantoffeln', 'basecap', 'umhang', 'sternbrille', 'halstuch', 'hasenohren', 'hawaiihemd',
  'entenbadehose', 'ballettschuhe', 'propellermuetze', 'blume', 'katzenhoodie', 'heldenmaske', 'medaille', 'lederhose', 'flipflops', 'kochmuetze',
  'engel', 'regenjacke', 'cowboyhut', 'bastrock', 'cowboystiefel', 'spiralbrille', 'kopfhoerer', 'zuckerwatte', 'einhornreif', 'bienenkostuem',
  'pyjamahose', 'rollschuhe', 'feuerwehrhelm', 'rundbrille', 'gloeckchen', 'ritterruestung', 'eierschale', 'fee', 'faehnchen', 'piratenhose',
  'clownsschuhe', 'zauberhut', 'rettungsweste', 'taucherbrille', 'blumenkette', 'schottenrock', 'monsterpfoten', 'antennen', 'sternenpyjama', 'eis',
  'strohhut', 'brille3d', 'kamera', 'flickenjeans', 'holzschuhe', 'drache', 'kochjacke', 'tortenhut', 'prinzessinnenrock', 'flossen',
  'matrosenmuetze', 'monokel', 'krawatte', 'arztkittel', 'ukulele', 'fliegenpilz', 'regenbogenleggings', 'wanderstiefel', 'astronautenjacke', 'diadem',
  'federmaske', 'halskrause', 'rakete', 'clownshose', 'schlittschuhe', 'zylinder', 'skijacke', 'windrad', 'skibrille', 'herzkette',
  'heiligenschein', 'skihose', 'elfenschuhe', 'smoking', 'weihnachtsmuetze', 'pfau', 'laterne', 'schnurrbart', 'sternabzeichen', 'meerjungfrau',
  'astronautenstiefel', 'doktorhut', 'rentierpulli', 'krone',
]

/**
 * The stars for the thing at place i of the order. The first two are free
 * (the wardrobe is never empty); then the gap between two things starts at
 * three stars (one good game) and grows by one star every 42 things:
 * 42 times 3, 42 times 4, … With 114 things the last one needs 434
 * stars, about two thirds of all the stars the games give (23 games with
 * levels × 10 levels × 3 stars = 690; tests/unit/wardrobe.test.js checks it).
 */
export function stepStars(i) {
  let s = 0
  for (let k = 0; k < i - 1; k++) s += 3 + Math.floor(k / 42)
  return i < 2 ? 0 : s
}

const ALL = [...HEAD, ...FACE, ...NECK, ...BACK, ...HOLD, ...TOP, ...BOTTOM, ...SHOES]
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
    // (an old save with shoes and a mermaid's tail: the tail stays)
    if (out.shoes && ITEM_BY_ID[out.bottom]?.feet === false) out.shoes = null
  }
  return out
}
/**
 * Put a thing on (or take it off when it is worn): one per place. Things
 * that cannot go together take each other off: shoes and a mermaid's tail
 * (a bottom with `feet: false`), so nothing is "worn" that does not show.
 */
export function wearToggle(outfit, item) {
  const o = cleanOutfit(outfit)
  if (o[item.slot] === item.id) return { ...o, [item.slot]: null }
  const next = { ...o, [item.slot]: item.id }
  if (item.slot === 'shoes' && ITEM_BY_ID[o.bottom]?.feet === false) next.bottom = null
  if (item.slot === 'bottom' && item.feet === false) next.shoes = null
  return next
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

/**
 * Where an item lies on a picture: its box (`size` wide, `h` high: a
 * picture squashed by `sy`), tilt and the point it turns round. Shoes are
 * placed twice: `side` 'l' is the left half of the pair picture on the left
 * foot, 'r' the right half on the right foot (`at` mirrored).
 */
export function placeItem(item, pose, side = 'l', poses = POSES) {
  const P = poses[pose] ?? poses.idle
  let A = P[item.slot]
  const t = item.pose?.[pose] ?? {}
  const W = A.w * item.size * (t.size ?? 1)
  const H = W * (t.sy ?? item.sy ?? 1)
  const r = side === 'r' ? -1 : 1
  let [ax, ay] = item.at
  if (item.slot === 'shoes') {
    // the foot: the middle between the feet, a step to the side
    const fr = (A.rot ?? 0) * Math.PI / 180
    A = { ...A, x: A.x - r * A.step * Math.cos(fr), y: A.y - r * A.step * Math.sin(fr) }
    if (side === 'r') ax = 1 - ax
  }
  // the item's own shift (a share of the anchor's width, along its tilt;
  // mirrored for the right shoe)
  const ar = (A.rot ?? 0) * Math.PI / 180
  const sx = r * ((item.dx ?? 0) * A.w + (t.dx ?? 0)), sy = (item.dy ?? 0) * A.w + (t.dy ?? 0)
  const x = A.x + sx * Math.cos(ar) - sy * Math.sin(ar)
  const y = A.y + sx * Math.sin(ar) + sy * Math.cos(ar)
  const rot = (A.rot ?? 0) + r * ((item.rot ?? 0) + (t.rot ?? 0))
  return { left: x - ax * W, top: y - ay * H, size: W, h: H, rot, x, y, ax, ay }
}

/**
 * The drawn part of a placed item, turned: its corners in picture pixels
 * (a pair of wings spread apart: the corners of both halves).
 */
export function itemCorners(item, pose, poses = POSES) {
  const [x0, yt, x1, yb] = item.box ?? [0, 0, 1, 1]
  const y0 = Math.max(yt, cutTopOf(item, pose)), y1 = Math.min(yb, cutOf(item, pose))
  const turnAt = (p, pts, deg) => {
    const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r)
    return pts.map(([u, v]) => {
      const dx = p.left + u * p.size - p.x, dy = p.top + v * p.h - p.y
      return [p.x + dx * c - dy * s, p.y + dx * s + dy * c]
    })
  }
  if (item.slot === 'shoes') {
    const l = placeItem(item, pose, 'l', poses), r = placeItem(item, pose, 'r', poses)
    return [...turnAt(l, [[x0, y0], [0.5, y0], [0.5, y1], [x0, y1]], l.rot), ...turnAt(r, [[0.5, y0], [x1, y0], [x1, y1], [0.5, y1]], r.rot)]
  }
  const p = placeItem(item, pose, 'l', poses)
  const turn = (pts, deg) => turnAt(p, pts, deg)
  const sp = spreadOf(item, pose)
  if (!sp) return turn([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], p.rot)
  const m = p.ax, y2 = Math.min(y1, spreadKeep(item))
  return [...turn([[x0, y0], [m, y0], [m, y2], [x0, y2]], p.rot - sp), ...turn([[m, y0], [x1, y0], [x1, y2], [m, y2]], p.rot + sp)]
}
// `cut`: the picture is drawn only down to this share of its height (a
// scarf's long end would hang over the feet Lumi sits on)
// `edge`: a thin dark outline round a thing whose colour is Lumi's own
// (yellow trousers on a yellow chick)
const EDGE = 'drop-shadow(0 0 0.6px #7a4a10) drop-shadow(0 0 0.6px #7a4a10)'
const cutOf = (item, pose) => item.pose?.[pose]?.cut ?? item.cut ?? 1
// `cutTop`: the picture is drawn only from this share of its height down
// (a hood that would lie on the chest like an open bag)
const cutTopOf = (item, pose) => item.pose?.[pose]?.cutTop ?? item.cutTop ?? 0
const spreadOf = (item, pose) => [].concat(item.pose?.[pose]?.spread ?? item.spread ?? 0)[0]
// how far down the spread halves are drawn (share of the picture)
const spreadKeep = item => [].concat(item.spread ?? 0)[1] ?? 1

/**
 * Everything drawn for Lumi in one pose with what Lumi wears, bottom to
 * top: the picture (with the tuft cut out under a covering hat), the neck
 * thing, the parts in front of it, the face thing, the head thing, the
 * tuft again where it pokes out of a hat. Positions in percent of the
 * square. `scale`: Lumi gets smaller (standing on the same spot) when a
 * tall hat would leave the square.
 */
/**
 * A thing as another figure wears it: the figure's corrections (lib/shapes/
 * <id>-fit.js) merged over the thing's own fields, per pose too; `hide`
 * leaves it out on that figure.
 */
export function fitted(item, fit = {}) {
  const f = fit[item.id]
  if (!f) return item
  const pose = { ...(item.pose ?? {}) }
  for (const [k, v] of Object.entries(f.pose ?? {})) pose[k] = { ...(pose[k] ?? {}), ...v }
  return { ...item, ...f, pose }
}

/**
 * Clothes painted onto a figure: Tripo dressed all seven poses of the figure
 * at once, and scripts/art/worn-from-sheet.mjs cut the top and the bottom out
 * per pose, in the frame of the pose picture. Such a thing (`worn`: the
 * figure whose pictures it has) is drawn from
 * public/sprites/wardrobe/worn/<figure>/<id>-<pose>.webp over the whole
 * square, not placed by anchors: its sleeves follow the arms, its legs the
 * sitting legs. The figure's arms and tail are not drawn again over it.
 * `wornFit(figure, ids, fit)` marks the things of a figure's list
 * (lib/shapes/<figure>-worn.js) in its fit.
 */
export const wornFit = (figure, ids, fit = {}) => ({ ...fit, ...Object.fromEntries(ids.map(id => [id, { ...fit[id], worn: figure }])) })
// the chick's own fit: only the things painted onto it
const CHICK_FIT = wornFit('chick', CHICK_WORN)
/** The style that masks a picture of the figure with a painted bottom's mask (`url`: the mask's address). */
export const maskStyle = url => (url ? { WebkitMaskImage: `url("${url}")`, maskImage: `url("${url}")`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' } : null)
export const wornSrc = (item, pose) => `sprites/wardrobe/worn/${item.worn}/${item.id}-${pose}.webp`

// Asleep (the sleeping picture, wherever it is shown), Lumi takes off what
// makes no sense with closed eyes: glasses and masks, and what it holds.
export const ASLEEP_OFF = ['face', 'hold']
export const asleep = pose => pose === 'sleep'

export function figureLayers(pose, outfit, poses = POSES, fit = poses === POSES ? CHICK_FIT : {}) {
  const P = poses[pose] ?? poses.idle
  const worn = wornItems(outfit).filter(t => !(asleep(pose) && ASLEEP_OFF.includes(t.slot)))
    .map(t => fitted(t, fit)).filter(t => !t.hide)
  const bySlot = Object.fromEntries(worn.map(t => [t.slot, t]))
  const hat = bySlot.head
  const layers = []
  const item = (t, side) => {
    // painted onto the figure: its own picture over the whole square
    if (t.worn) return { kind: 'item', id: t.id, src: wornSrc(t, poses[pose] ? pose : 'idle'),left: '0%', top: '0%', size: '100%', h: '100%', rot: 0, origin: '50% 50%', worn: true }
    const p = placeItem(t, pose, side, poses)
    const cut = cutOf(t, pose), top = cutTopOf(t, pose)
    return { kind: 'item', id: t.id, src: t.src, left: pct(p.left), top: pct(p.top), size: pct(p.size), h: pct(p.h), rot: p.rot, origin: `${+(p.ax * 100).toFixed(2)}% ${+(p.ay * 100).toFixed(2)}%`, ...(cut < 1 || top > 0 ? { clip: `inset(${+(top * 100).toFixed(2)}% 0 ${+((1 - cut) * 100).toFixed(2)}% 0)` } : null), ...(t.edge ? { filter: EDGE } : null) }
  }
  const clipTo = pts => ({ kind: 'pose', clip: `polygon(${poly(pts)})` })
  // the back thing lies behind Lumi, and a held thing that leans behind
  // Lumi (`behind`: an open umbrella over the shoulder)
  const behindHold = bySlot.hold && (bySlot.hold.pose?.[pose]?.behind ?? bySlot.hold.behind)
  // wings spread apart (`spread`): each half of the picture turned outwards
  // and down about the middle of the back, so they stand out at the sides of
  // the body instead of rising beside the head like ears
  const sp = bySlot.back && spreadOf(bySlot.back, pose)
  if (sp) {
    const b = item(bySlot.back), r = b.rot, cut = +(bySlot.back.at[0] * 100).toFixed(2)
    const low = +(100 - spreadKeep(bySlot.back) * 100).toFixed(2)
    layers.push({ ...b, rot: r - sp, clip: `inset(0 ${+(100 - cut).toFixed(2)}% ${low}% 0)` })
    layers.push({ ...b, id: `${b.id}-right`, part: true, rot: r + sp, clip: `inset(0 0 ${low}% ${cut}%)` })
  } else if (bySlot.back) layers.push(item(bySlot.back))
  if (behindHold) layers.push(item(bySlot.hold))
  // holes cut into Lumi's picture: the tuft under a covering hat, and the
  // toes under shoes (standing, Lumi's orange toes peeked out under a sole)
  const holes = []
  if (hat?.tuft === 'hide' && P.tuft) holes.push(P.tuft)
  const shoesOn = bySlot.shoes && bySlot.bottom?.feet !== false
  if (shoesOn && !P.feet && P.soles) holes.push(P.soles)
  // a figure with wings of its own (the dragon): they are cut away under wings worn
  if (bySlot.back && spreadOf(bySlot.back, pose) && P.ownWings) holes.push(...P.ownWings)
  // a mermaid's tail has no feet: they are cut away (sitting, the tail is
  // drawn big enough to close the gap)
  // (painted: the mask below cuts away what the tail replaces)
  if (bySlot.bottom?.feet === false && !bySlot.bottom.worn) { if (P.feet) holes.push(...P.feet); else if (P.soles) holes.push(P.soles.map(([x, y], i) => [x, i < 2 ? y - 26 : y])) }
  layers.push({ kind: 'pose', clip: holes.length ? `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${holes.map(h => `${poly(h)}, ${poly([h[0]])}, 0% 0%`).join(', ')})` : null })
  // the clothes: trousers or a skirt over the lower body and the legs (the
  // feet Lumi sits on stay in front of them), the shoes, one on each foot
  // (the pair picture cut in two), and the top over them, its hem over the
  // waistband; the wings lie in front of the clothes again
  // (a mermaid's tail has no feet: shoes stay in the wardrobe while it is worn)
  if (bySlot.shoes && bySlot.bottom?.feet === false) delete bySlot.shoes
  const shoes = () => bySlot.shoes ? [
    { ...item(bySlot.shoes, 'l'), clip: 'inset(0 50% 0 0)' },
    { ...item(bySlot.shoes, 'r'), id: `${bySlot.shoes.id}-right`, part: true, clip: 'inset(0 0 0 50%)' },
  ] : []
  // clothes painted onto the figure (`worn`, see wornFit) already have the
  // arms, the tail and the feet in front of them: the figure's polygons are
  // drawn again only over clothes laid on it (and below a painted top)
  const laidTop = bySlot.top && !bySlot.top.worn, laidBottom = bySlot.bottom && !bySlot.bottom.worn
  const again = list => { for (const w of list ?? []) layers.push(clipTo(w)) }
  if (!P.feet) {
    // standing: the shoes are worn under the trousers (a trouser leg or a
    // skirt's hem lies over the shoe's opening), the top over both
    layers.push(...shoes())
    if (bySlot.bottom) layers.push(item(bySlot.bottom))
  } else {
    // sitting: the feet stick out to the front, in front of the trousers;
    // the shoes on them, and both again in front of the top
    if (bySlot.bottom) {
      layers.push(item(bySlot.bottom))
      // (a mermaid's tail: no feet in front of it)
      if (laidBottom && bySlot.bottom.feet !== false) again(P.feet)
    }
    layers.push(...shoes())
  }
  if (bySlot.top?.worn) {
    // a painted top over a laid bottom: the arms and the tail over the
    // bottom first, the top's sleeves over the arms
    if (laidBottom) { again(P.wings); again(P.tail) }
    layers.push(item(bySlot.top))
  } else {
    if (bySlot.top) layers.push(item(bySlot.top))
    if (laidTop || laidBottom) {
      again(P.wings)
      // a tail lies over trousers, skirts and the hem of a top
      again(P.tail)
    }
  }
  // the part of a back thing that lies in FRONT of Lumi (a cape's collar
  // and clasp): the same picture again, cut to its `over` polygon
  if (bySlot.back?.over) {
    const clip = `polygon(${bySlot.back.over.map(([x, y]) => `${+(x * 100).toFixed(2)}% ${+(y * 100).toFixed(2)}%`).join(', ')})`
    layers.push({ ...item(bySlot.back), id: `${bySlot.back.id}-over`, over: true, clip })
    // the wing at the chin (thinking) stays in front of it
    if (P.front && !bySlot.neck) layers.push({ kind: 'pose', clip: `polygon(${poly(P.front)})` })
  }
  if (bySlot.neck) {
    const n = bySlot.neck
    // `apart`: the picture cut in two at its middle, the halves moved apart
    // (headphones: a cup at each side of the neck, not two eyes on the chest)
    if (n.apart) {
      const tb = `${+(cutTopOf(n, pose) * 100).toFixed(2)}%`, bb = `${+((1 - cutOf(n, pose)) * 100).toFixed(2)}%`
      const half = side => ({ ...item({ ...n, dx: (n.dx ?? 0) + side * n.apart / 2 }), clip: side < 0 ? `inset(${tb} 50% ${bb} 0)` : `inset(${tb} 0 ${bb} 50%)` })
      layers.push(half(-1))
      layers.push({ ...half(1), id: `${n.id}-right`, part: true })
    } else layers.push(item(n))
    if (P.front) layers.push({ kind: 'pose', clip: `polygon(${poly(P.front)})` })
  }
  // sitting, the feet (and the shoes on them) lie in front of the top and
  // of what hangs from the neck (a scarf's end ended on the shoes)
  // (a painted top has them in front already, unless the bottom was laid on)
  if ((bySlot.top || bySlot.neck) && P.feet && bySlot.bottom?.feet !== false) {
    if (laidTop || bySlot.neck || (bySlot.top && laidBottom)) again(P.feet)
    if (bySlot.shoes) layers.push(...shoes().map(l => ({ ...l, id: `${bySlot.shoes.id}-${l.part ? 'right-' : ''}again`, part: true })))
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
  for (const t of worn.filter(t => !t.worn)) for (const [x, y] of itemCorners(t, pose, poses)) {
    if (y < M) scale = Math.min(scale, (S - M) / (S - y))
    if (x < M) scale = Math.min(scale, (S / 2 - M) / (S / 2 - x))
    if (x > S - M) scale = Math.min(scale, (S / 2 - M) / (x - S / 2))
  }
  // a painted bottom that replaces the legs (a mermaid's tail): every
  // picture of the figure is masked where Tripo painted no legs, feet or tail
  // (<id>-<pose>-mask.webp, opaque where the figure stays)
  if (bySlot.bottom?.worn && bySlot.bottom.feet === false) {
    const mask = wornSrc(bySlot.bottom, poses[pose] ? pose : 'idle').replace(/\.webp$/, '-mask.webp')
    for (const l of layers) if (l.kind === 'pose') l.mask = mask
  }
  return { layers, scale: Math.round(scale * 1000) / 1000 }
}
