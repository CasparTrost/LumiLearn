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
export const SHAPE_SIZE = 512
export const CHICK = 'chick'

export const SHAPES = [
  // the chick's anchors are POSES in lib/wardrobe.js
  { id: CHICK, name: 'Küken' },
  // `poses`: anchors per pose for the clothes, to come
  { id: 'dino', name: 'Dino', poses: {} },
  { id: 'einhorn', name: 'Einhorn', poses: {} },
  { id: 'drache', name: 'Drache', poses: {} },
  { id: 'roboter', name: 'Roboter', poses: {} },
]
export const SHAPE_IDS = SHAPES.map(s => s.id)
export const SHAPE_BY_ID = Object.fromEntries(SHAPES.map(s => [s.id, s]))

/**
 * The stars at which one more shape may be won (after the free first one).
 * The first after about two days of play (a good game gives three stars, a
 * day four or five games), then further apart. None lies on a step of the
 * wardrobe (tests/unit/shapes.test.js), so a shape and a thing to wear
 * seldom come with the same game; when they do, the shape comes first on
 * the results screen and the wardrobe keeps its sign on the home screen.
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
export const freshShapes = () => ({ shapes: [], shape: null, shapeWait: false, shapePicked: false })

// ── Drawing ─────────────────────────────────────────────────────────────────
export const SHAPE_POSE_IDS = ['idle', 'happy', 'sad', 'hmm', 'think', 'wave', 'sleep']
/** The picture of a shape in a pose (the chick's are Lumi's own pictures). */
export const shapeSrc = (id, pose) => (!id || id === CHICK || !SHAPE_BY_ID[id] ? `sprites/emoji/custom/lumi-${pose}.webp` : `sprites/shapes/${id}-${pose}.webp`)
/** THE switch for clothes: the chick, and a shape once it has its anchors (part B). */
export const wearsClothes = id => !id || id === CHICK || Object.keys(SHAPE_BY_ID[id]?.poses ?? {}).length > 0

/**
 * Everything drawn for a shape in one pose, bottom to top (the shape of
 * figureLayers in lib/wardrobe.js). The picture only until the shape has
 * anchors; the worn things will be added here from them.
 */
export function shapeLayers(id, pose /* , outfit */) {
  const p = SHAPE_POSE_IDS.includes(pose) ? pose : 'idle'
  return { layers: [{ kind: 'pose', src: shapeSrc(id, p) }], scale: 1 }
}

// The shape of the child playing, for code outside React (lib/assets.js
// lumiArt, pictures a game draws itself). Set by AppProvider on every render.
let current = null
export const setCurrentShape = id => { current = SHAPE_BY_ID[id] && id !== CHICK ? id : null }
export const currentShape = () => current

/** Children offered the free first choice in this app session (offered once per app open, never forced). */
export const offeredFirst = new Set()
