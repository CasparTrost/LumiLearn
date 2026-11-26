/**
 * Lumi verwandelt sich: the shapes Lumi can take. There is ONE Lumi; the
 * child chooses what it looks like: a chick, a dino, a unicorn, a dragon or
 * a robot. The chosen shape is drawn everywhere Lumi is drawn
 * (components/LumiFigure.jsx, Critter/Art 'lumi', lib/assets.js lumiArt),
 * with Lumi's voice and name.
 *
 * Earning: a new child chooses ONE of the five freely at the start (a step
 * of the set-up; a child from before the shapes is offered the same choice
 * on the home screen, and is the chick until it has chosen). The other four
 * are won with stars, one at each of STEPS, the child choosing which, one
 * at a time. Nothing is spent and nothing can be lost; all five come in the
 * end, so no choice is ever wrong.
 *
 * The stars counted are the wardrobe's (the stars ever earned, `starsEver`,
 * see AppContext.jsx profileWardrobeStars).
 *
 * Pictures: public/sprites/shapes/<id>-<pose>.webp, 512 × 512, Lumi's seven
 * poses (idle, happy, sad, hmm, think, wave, sleep; "hmm" is "think" without
 * the "?"), standing as tall as the chick in its square and on its ground
 * line, so nothing in a layout moves when the shape changes (made by
 * scripts/art/shapes-convert.mjs). The chick's are lumi-<pose>.webp.
 *
 * Clothes: a shape wears the wardrobe's things only when it has anchors per
 * pose (`poses`, like POSES in lib/wardrobe.js: head, face, neck, back, hold
 * … { x, y, rot, w } in pixels of the 512 square). Until then it is drawn
 * without clothes, never with them at the chick's anchors (wearsClothes).
 */
import { POSES, ANCHORS, figureLayers, fitted, itemCorners, ITEM_BY_ID, CHICK_FIT } from './wardrobe.js'
import DINO_POSES from './shapes/dino-poses.js'
import DINO_FIT from './shapes/dino-fit.js'
import EINHORN_POSES from './shapes/einhorn-poses.js'
import EINHORN_FIT from './shapes/einhorn-fit.js'
import DRACHE_POSES from './shapes/drache-poses.js'
import DRACHE_FIT from './shapes/drache-fit.js'
import ROBOTER_POSES from './shapes/roboter-poses.js'
import ROBOTER_FIT from './shapes/roboter-fit.js'

export const SHAPE_SIZE = 512
export const CHICK = 'chick'

export const SHAPES = [
  // the chick's anchors are POSES in lib/wardrobe.js
  { id: CHICK, name: 'Küken' },
  // `poses`: anchors and polygons per pose for the clothes (shapes/<id>-poses.js,
  // in the 384 units of lib/wardrobe.js POSES), `fit`: corrections per thing
  // (shapes/<id>-fit.js). Each shape's data lives in its own two files.
  { id: 'dino', name: 'Dino', poses: DINO_POSES, fit: DINO_FIT },
  { id: 'einhorn', name: 'Einhorn', poses: EINHORN_POSES, fit: EINHORN_FIT },
  { id: 'drache', name: 'Drache', poses: DRACHE_POSES, fit: DRACHE_FIT },
  { id: 'roboter', name: 'Roboter', poses: ROBOTER_POSES, fit: ROBOTER_FIT },
]
export const SHAPE_IDS = SHAPES.map(s => s.id)
export const SHAPE_BY_ID = Object.fromEntries(SHAPES.map(s => [s.id, s]))

/**
 * The stars at which one more shape may be won (after the free first one).
 * The first after about two days of play (a good game gives three stars, a
 * day four or five games), then further apart. None lies exactly on a step
 * of the wardrobe (tests/unit/shapes.test.js), but the wardrobe has a thing
 * every 3 to 7 stars, so the game that reaches a step usually brings a thing
 * to wear too: the results screen then shows the new shape as its big
 * thing and the wardrobe's new thing in its usual row below.
 */
export const STEPS = [20, 70, 155, 260]

/** How many shapes the stars have earned (0 … 4), besides the free first one. */
export const shapesEarned = stars => STEPS.filter(s => s <= stars).length

/** The shapes owned, cleaned: known ids, each once, in order. */
export const cleanShapes = list => (Array.isArray(list) ? Array.from(new Set(list.filter(id => SHAPE_BY_ID[id]))) : [])
/** Who Lumi is: a shape owned, or null (not chosen yet: drawn as the chick). */
export const cleanShape = (shape, owned) => (SHAPE_BY_ID[shape] && cleanShapes(owned).includes(shape) ? shape : null)
/** The shape to draw for a child: an id other than the chick, or null for the chick. */
export const drawnShape = profile => {
  const s = profile ? cleanShape(profile.shape, profile.shapes) : null
  return s === CHICK ? null : s
}

/** The free first choice is still to make (a new child, or one from before the shapes). */
export const firstChoiceOwed = profile => !!profile && !profile.shapePicked

/** How many shapes were won with stars: all owned but the first. */
export const shapesWon = profile => (profile?.shapePicked ? Math.max(0, cleanShapes(profile.shapes).length - 1) : 0)

/**
 * Shapes that may be won now with stars. Not before the free first choice;
 * one at a time: after one was won (`shapeWait`, also right after the first
 * choice) the next waits for the next game played. A child with many stars
 * from before the shapes is so given them one game apart, each with its own
 * big moment, not four choices in a row.
 */
export function shapesOwed(profile, stars) {
  if (!profile?.shapePicked) return 0
  const owed = shapesEarned(stars) - shapesWon(profile)
  return owed > 0 && !profile.shapeWait ? owed : 0
}
/** The shapes not owned, in their order. */
export const shapesToCome = profile => SHAPES.filter(s => !cleanShapes(profile?.shapes).includes(s.id))

/**
 * What a shape still to come shows on the ring, in the order of the ring:
 * the step at which it comes (the first one to come gets the next step, the
 * second the one after …), the step before it (from where its bar fills),
 * whether it is the next one (its bar fills now), and whether its step is
 * reached but it waits for the next game (`waits`: a sign of its own, not a
 * star number already reached).
 */
export function comingSteps(profile, stars) {
  const n = shapesWon(profile)
  const reached = shapesEarned(stars) > n
  return Object.fromEntries(shapesToCome(profile).map((s, i) => {
    const step = STEPS[n + i] ?? null
    return [s.id, { step, from: STEPS[n + i - 1] ?? 0, next: i === 0, waits: i === 0 && reached && !!profile?.shapePicked && !!profile?.shapeWait }]
  }))
}

/** A fresh child: nothing chosen yet (drawn as the chick), nothing won, nothing waiting. */
export const freshShapes = () => ({ shapes: [], shape: null, shapeWait: false, shapePicked: false, shapeOffersClosed: 0 })

// ── Drawing ─────────────────────────────────────────────────────────────────
export const SHAPE_POSE_IDS = ['idle', 'happy', 'sad', 'hmm', 'think', 'wave', 'sleep']
/** The picture of a shape in a pose (the chick's are Lumi's own pictures). */
export const shapeSrc = (id, pose) => (!id || id === CHICK || !SHAPE_BY_ID[id] ? `sprites/emoji/custom/lumi-${pose}.webp` : `sprites/shapes/${id}-${pose}.webp`)
/**
 * THE switch for clothes: the chick, and a shape once its poses file is
 * complete: every pose with every anchor (ANCHORS in lib/wardrobe.js; a half-measured shape
 * keeps wearing nothing rather than things in the wrong spots).
 */
export const posesComplete = poses => SHAPE_POSE_IDS.every(p => ANCHORS.every(sl => Number.isFinite(poses?.[p]?.[sl]?.x)) && Array.isArray(poses?.[p]?.tuft))
export const wearsClothes = id => !id || id === CHICK || posesComplete(SHAPE_BY_ID[id]?.poses)
/** The anchors and corrections of a figure (the chick: lib/wardrobe.js POSES, none). */
export const posesOf = id => (!id || id === CHICK || !SHAPE_BY_ID[id] ? POSES : SHAPE_BY_ID[id].poses)
export const fitOf = id => (!id || id === CHICK ? CHICK_FIT : SHAPE_BY_ID[id]?.fit ?? {})

/**
 * Everything drawn for a shape in one pose, bottom to top: figureLayers of
 * lib/wardrobe.js with the shape's anchors and corrections, each picture
 * layer carrying its `src`. Only the picture while the shape's poses file is
 * not complete.
 */
/**
 * How far up Lumi reaches in a pose, as a share of its square from the top:
 * `bare` its own head (horn, antenna, tuft), `top` with what it wears on
 * the head (a tall hat reaches higher). The mood marks (rain cloud, hearts)
 * go above `top`, so they never sit on a hat.
 */
export function wornTop(id, pose, outfit = null) {
  const own = !!id && id !== CHICK
  const set = own ? posesOf(id) : POSES
  const P = set?.[pose] ?? set?.idle
  if (!P?.tuft) return null
  const bare = Math.min(...P.tuft.map(q => q[1]))
  let top = bare
  const item = outfit?.head && ITEM_BY_ID[outfit.head]
  if (item && (!own || wearsClothes(id))) {
    const t = fitted(item, fitOf(id))
    if (!t.hide) top = Math.min(top, ...itemCorners(t, pose in set ? pose : 'idle', set).map(c => c[1]))
  }
  const scale = Math.min(1, own ? shapeLayers(id, pose, outfit).scale : figureLayers(pose in set ? pose : 'idle', outfit).scale)
  const at = y => 1 - (1 - y / 384) * scale
  return { bare: at(bare), top: at(top) }
}

export function shapeLayers(id, pose, outfit = null) {
  const p = SHAPE_POSE_IDS.includes(pose) ? pose : 'idle'
  const src = shapeSrc(id, p)
  if (!wearsClothes(id) || !outfit) return { layers: [{ kind: 'pose', src }], scale: 1 }
  const { layers, scale } = figureLayers(p, outfit, posesOf(id), fitOf(id))
  return { layers: layers.map(l => (l.kind === 'pose' ? { ...l, src } : l)), scale }
}

// The shape of the child playing, for code outside React (lib/assets.js
// lumiArt, pictures a game draws itself). Set by AppProvider on every render.
let current = null
export const setCurrentShape = id => { current = SHAPE_BY_ID[id] && id !== CHICK ? id : null }
export const currentShape = () => current

/** Children offered the free first choice in this app session (offered once per app open, never forced). */
export const offeredFirst = new Set()
/**
 * The free first choice opens by itself on the home screen (once per app
 * open), until the child has closed it twice without choosing; after that
 * only the present beside Lumi offers it.
 */
export const OFFER_CLOSED_MAX = 2
export const offerFirstByItself = profile => firstChoiceOwed(profile) && (profile.shapeOffersClosed ?? 0) < OFFER_CLOSED_MAX
