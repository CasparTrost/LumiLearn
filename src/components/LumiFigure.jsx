import { useContext } from 'react'
import { AppContext } from '../AppContext.jsx'
import { asset } from '../lib/assets.js'
import { figureLayers, lumiPose } from '../lib/wardrobe.js'
import { ShapeFigure, useLumiShape } from './ShapeFigure.jsx'

/**
 * Lumi in one of its seven pictures, wearing what the child chose in
 * Lumis Kleiderschrank (lib/wardrobe.js). Every place that shows Lumi
 * draws it with this: the home screen, the game bar, the results, the
 * movement break and the games (through Art in components/play/Critter.jsx).
 *
 * The things are laid over the picture by the anchors measured on each
 * picture, in percent of the square, so Lumi looks the same at 44 px in
 * the game bar and at 300 px in the wardrobe. A tall hat makes Lumi a
 * little smaller (standing on the same spot) instead of leaving the square.
 *
 * `outfit`: what to wear; left out, what the playing child chose (none
 * without a child). `style` goes on the square (a filter, a margin).
 */
export function useOutfit() {
  const ctx = useContext(AppContext)
  const s = ctx?.state
  return s?.profiles?.[s.activeProfileId]?.outfit ?? null
}

export default function LumiFigure({ mood = 'idle', size = 120, outfit, shape, style, className, alt = '' }) {
  const own = useOutfit()
  // Lumi in the shape the child chose (lib/shapes.js; `shape` null: the chick)
  const mine = useLumiShape()
  const who = shape === undefined ? mine : shape
  if (who && who !== 'chick') return <ShapeFigure id={who} mood={mood} size={size} style={style} className={className} alt={alt} />
  const wear = outfit === undefined ? own : outfit
  const pose = lumiPose(mood)
  const src = asset(`sprites/emoji/custom/lumi-${pose}.webp`)
  const { layers, scale } = figureLayers(pose, wear)
  return (
    <span className={className} role={alt ? 'img' : undefined} aria-label={alt || undefined} data-lumi-pose={pose}
      style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0, maxWidth: 'none', ...style }}>
      <span style={{ position: 'absolute', inset: 0, ...(scale < 1 ? { transform: `scale(${scale})`, transformOrigin: '50% 100%' } : null) }}>
        {layers.map((l, i) => l.kind === 'pose'
          ? <img key={i} src={src} alt="" draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', objectFit: 'contain', clipPath: l.clip ?? undefined }} />
          : <img key={l.id} src={asset(l.src)} alt="" draggable={false} data-wear={l.over || l.part ? undefined : l.id}
              style={{ position: 'absolute', left: l.left, top: l.top, width: l.size, height: l.h ?? l.size, maxWidth: 'none', transform: `rotate(${l.rot}deg)`, transformOrigin: l.origin, clipPath: l.clip ?? undefined, filter: l.filter }} />)}
      </span>
    </span>
  )
}
