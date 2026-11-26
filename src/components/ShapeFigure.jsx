import { useContext } from 'react'
import { AppContext } from '../AppContext.jsx'
import { asset } from '../lib/assets.js'
import { lumiPose } from '../lib/wardrobe.js'
import { drawnShape, shapeLayers, wearsClothes } from '../lib/shapes.js'
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
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', objectFit: 'contain', clipPath: l.clip ?? undefined }} />
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
 * live from the profile (head and shoulders, so a hat shows at 44 px), on
 * the child's colour. A child that has not chosen its Lumi yet is the
 * chick. (`profile.avatar`, the animal of before, stays in the save but is
 * no longer shown.)
 */
export function ChildLumi({ profile, size = 56, style }) {
  const shape = drawnShape(profile)
  const outfit = wearsClothes(shape) ? profile?.outfit ?? null : null
  const inner = size / 0.64
  return (
    <span aria-hidden="true" data-child-lumi={shape ?? 'chick'}
      style={{ position: 'relative', display: 'block', width: size, height: size, flexShrink: 0, overflow: 'hidden', borderRadius: '22%', background: childColour(profile), ...style }}>
      <LumiFigure shape={shape} outfit={outfit} size={inner} style={{ position: 'absolute', left: (size - inner) / 2, top: size * 0.02 }} />
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
