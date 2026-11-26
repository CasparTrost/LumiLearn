import { useContext } from 'react'
import { AppContext } from '../AppContext.jsx'
import { asset } from '../lib/assets.js'
import { lumiPose, figureLayers, POSES, maskStyle } from '../lib/wardrobe.js'
import { drawnShape, shapeLayers, wearsClothes, posesOf } from '../lib/shapes.js'
import LumiFigure from './LumiFigure.jsx'

/**
 * Lumi in a shape the child won (lib/shapes.js): a dino, a unicorn, a
 * dragon or a robot, in the picture for Lumi's mood (the same seven poses
 * as the chick, the same size and ground line). LumiFigure hands over to
 * this for every shape but the chick, so every place that draws Lumi draws
 * the shape.
 *
 * Clothes: drawn in layers like the chick's once the shape has anchors
 * (lib/shapes.js wearsClothes); until then the shape wears nothing.
 */
export function ShapeFigure({ id, mood = 'idle', size = 120, outfit = null, style, className, alt = '' }) {
  const pose = lumiPose(mood)
  const { layers, scale } = shapeLayers(id, pose, outfit)
  return (
    <span className={className} role={alt ? 'img' : undefined} aria-label={alt || undefined} data-lumi-pose={pose} data-lumi-shape={id}
      style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0, maxWidth: 'none', ...style }}>
      <span style={{ position: 'absolute', inset: 0, ...(scale < 1 ? { transform: `scale(${scale})`, transformOrigin: '50% 100%' } : null) }}>
        {layers.map((l, i) => l.kind === 'pose'
          ? <img key={i} src={asset(l.src)} alt="" draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', objectFit: 'contain', clipPath: l.clip ?? undefined, filter: l.filter, ...maskStyle(l.mask && asset(l.mask)) }} />
          : <img key={l.id} src={asset(l.src)} alt="" draggable={false} data-wear={l.over || l.part ? undefined : l.id}
              style={{ position: 'absolute', left: l.left, top: l.top, width: l.size, height: l.h ?? l.size, maxWidth: 'none', transform: `rotate(${l.rot}deg)`, transformOrigin: l.origin, clipPath: l.clip ?? undefined, filter: l.filter }} />)}
      </span>
    </span>
  )
}

/** The shape Lumi has for the playing child: an id, or null for the chick. */
export function useLumiShape() {
  const ctx = useContext(AppContext)
  const s = ctx?.state
  const p = s?.profiles?.[s.activeProfileId]
  return drawnShape(p)
}

/** What Lumi visibly wears: the child's outfit, or nothing on a shape without anchors yet. */
export function useDrawnOutfit() {
  const ctx = useContext(AppContext)
  const s = ctx?.state
  const p = s?.profiles?.[s.activeProfileId]
  if (!p) return null
  return wearsClothes(drawnShape(p)) ? p.outfit ?? null : null
}

// A soft colour per child behind its Lumi, so two children with the same
// shape are told apart without reading (from the child's id: it stays)
const BADGE_COLOURS = ['#ffd6e0', '#cfe8ff', '#d9f5c6', '#ffe7b3', '#e6dbff', '#c8f1ec', '#ffd9c2', '#f3e9c9']
export const childColour = profile => {
  const id = String(profile?.id ?? '')
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return BADGE_COLOURS[h % BADGE_COLOURS.length]
}

/**
 * A child's picture: its own Lumi, in its shape and with its clothes, drawn
 * live from the profile, on the child's colour. A child that has not chosen
 * its Lumi yet is the chick. (`profile.avatar`, the animal of before, stays
 * in the save but is no longer shown.)
 *
 * Framed on the face, not on the whole figure: the eyes always at the same
 * height (EYE_AT from the top) and the face always the same size (FACE_W of
 * the square), whatever is worn. A tall hat is cut at the top edge instead
 * of shrinking the face, so the shape stays easy to tell (the unicorn's
 * horn, ears and mane, the robot's ear pieces, the dragon's horns).
 */
const EYE_AT = 0.58
const FACE_W = 0.44
export function childFrame(shape, outfit) {
  const own = shape && shape !== 'chick'
  const face = (own ? posesOf(shape) : POSES).idle.face
  // the figure shrinks under a tall hat (standing on the same spot): the face with it
  const scale = own ? shapeLayers(shape, 'idle', outfit).scale : figureLayers('idle', outfit).scale
  const k = Math.min(1, scale)
  const zoom = FACE_W * 384 / (face.w * k) // the figure's square, in squares of the picture
  return {
    zoom,
    left: 0.5 - (192 + (face.x - 192) * k) / 384 * zoom,
    top: EYE_AT - (384 - (384 - face.y) * k) / 384 * zoom,
  }
}

/**
 * What Lumi wears in the child's picture: all but the face thing. Glasses, a
 * mask, a clown's nose or a moustache under a hat left too little of the face
 * to tell the figure (a robot in a chef's hat and a hero's mask); the hat
 * stays, it is what makes the picture the child's own.
 */
export const pictureOutfit = outfit => (outfit ? { ...outfit, face: null } : null)

const childOutfit = (shape, profile) => (wearsClothes(shape) ? pictureOutfit(profile?.outfit) : null)
/**
 * How far (px) the drawn figure of a child's picture reaches past the
 * picture's left edge (clipped there, but its box sticks out): a picture
 * this close to the screen's edge is moved in by that much (the home
 * header on a phone).
 */
export function childOverhang(profile, size = 56) {
  const shape = drawnShape(profile)
  return Math.max(0, Math.ceil(-size * childFrame(shape, childOutfit(shape, profile)).left))
}

export function ChildLumi({ profile, size = 56, style }) {
  const shape = drawnShape(profile)
  const outfit = childOutfit(shape, profile)
  const f = childFrame(shape, outfit)
  return (
    <span aria-hidden="true" data-child-lumi={shape ?? 'chick'}
      style={{ position: 'relative', display: 'block', width: size, height: size, flexShrink: 0, overflow: 'hidden', borderRadius: '22%', background: childColour(profile), ...style }}>
      <LumiFigure shape={shape} outfit={outfit} size={size * f.zoom} style={{ position: 'absolute', left: size * f.left, top: size * f.top }} />
    </span>
  )
}

/** The picture of the place: the chick and the dino side by side (the home button). */
export function ShapesIcon({ size = 44 }) {
  return (
    <span aria-hidden="true" style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      <img src={asset('sprites/emoji/custom/lumi-idle.webp')} alt="" draggable={false}
        style={{ position: 'absolute', left: -size * 0.12, bottom: 0, width: size * 0.78, height: size * 0.78 }} />
      <img src={asset('sprites/shapes/dino-wave.webp')} alt="" draggable={false}
        style={{ position: 'absolute', right: -size * 0.14, bottom: -size * 0.02, width: size * 0.8, height: size * 0.8 }} />
    </span>
  )
}
