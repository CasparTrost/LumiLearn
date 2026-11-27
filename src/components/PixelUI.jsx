// Small building blocks of the Pixel-Abenteuer look (styles/pixel.css).
import LumiFigure from './LumiFigure.jsx'

const BASE = import.meta.env.BASE_URL ?? '/'
export const uiSpr  = f => BASE.replace(/\/$/, '') + '/sprites/ui/' + f

/**
 * Lumi (components/LumiFigure.jsx); `happy` shows the cheering pose. Lumi
 * wears what the playing child chose in the wardrobe, in the shape it
 * chose; `outfit={null}` where no child is meant (choosing who plays): the
 * chick, plain.
 */
export function PixelLumi({ size = 96, happy = false, bob = true, style, outfit }) {
  return (
    <LumiFigure mood={happy ? 'happy' : 'idle'} size={size} outfit={outfit} shape={outfit === null ? null : undefined} alt="Lumi"
      className={bob ? 'px-bob' : undefined}
      style={{ display: 'block', filter: 'drop-shadow(0 4px 0 rgba(42,27,61,0.35))', ...style }} />
  )
}

/** Gold pixel star; `off` greys it out (an unearned star). */
export function PxStar({ size = 22, off = false, style }) {
  return (
    <img
      src={uiSpr('star.png')}
      alt=""
      draggable={false}
      className="px-art"
      style={{
        width: size, height: size, display: 'block', flexShrink: 0,
        filter: off ? 'grayscale(1) brightness(1.25) opacity(0.4)' : undefined,
        ...style,
      }}
    />
  )
}

/** A row of three stars, `filled` of them lit. */
export function PxStars({ filled = 0, total = 3, size = 18, gap = 2 }) {
  return (
    <div style={{ display: 'flex', gap }} aria-label={`${filled} von ${total} Sternen`}>
      {Array.from({ length: total }, (_, i) => <PxStar key={i} size={size} off={i >= filled} />)}
    </div>
  )
}

/** Wooden HUD bar across the top of a screen. */
export function HudBar({ children, style }) {
  return (
    <div
      className="px-wood"
      style={{
        display: 'flex', alignItems: 'center', gap: 'clamp(8px,1.6vw,14px)',
        padding: 'clamp(8px,1.6vw,12px) clamp(12px,3vw,28px)',
        flexShrink: 0, position: 'relative', zIndex: 5,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// Pixel icons, drawn on a small grid (X = filled). They replace the thin
// lucide line icons and the ▶/▼ characters, which came from a fallback font
// and had a different size on every device.
const ICONS = {
  play: [
    'X......',
    'XXX....',
    'XXXXX..',
    'XXXXXXX',
    'XXXXXXX',
    'XXXXX..',
    'XXX....',
    'X......',
  ],
  // skip ahead: two arrows to a bar (a parent's button: Überspringen)
  skip: [
    'X...X...XX',
    'XX..XX..XX',
    'XXX.XXX.XX',
    'XXXXXXXXXX',
    'XXXXXXXXXX',
    'XXX.XXX.XX',
    'XX..XX..XX',
    'X...X...XX',
  ],
  back: [
    '...X....',
    '..XX....',
    '.XXXXXXX',
    'XXXXXXXX',
    '.XXXXXXX',
    '..XX....',
    '...X....',
  ],
  close: [
    'XX...XX',
    'XXX.XXX',
    '.XXXXX.',
    '..XXX..',
    '.XXXXX.',
    'XXX.XXX',
    'XX...XX',
  ],
  down: [
    'XXXXXXXX',
    'XXXXXXXX',
    '.XXXXXX.',
    '..XXXX..',
    '...XX...',
  ],
  check: [
    '.......XX',
    '......XXX',
    '.....XXX.',
    'XX..XXX..',
    'XXXXXX...',
    '.XXXX....',
    '..XX.....',
  ],
  lock: [
    '..XXXX..',
    '.XX..XX.',
    '.X....X.',
    'XXXXXXXX',
    'XXX..XXX',
    'XXX..XXX',
    'XXXXXXXX',
    'XXXXXXXX',
  ],
}

/** A pixel icon in the current text colour; `size` is its height in px. */
export function PxIcon({ name, size = 18, color = 'currentColor', style, title }) {
  const rows = ICONS[name]
  if (!rows) return null
  const w = rows[0].length, h = rows.length
  const rects = []
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      if (row[x] !== 'X') continue
      let x2 = x
      while (row[x2 + 1] === 'X') x2++
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={x2 - x + 1} height={1} />)
      x = x2
    }
  })
  return (
    <svg className="px-icon" viewBox={`0 0 ${w} ${h}`} width={Math.round(size * w / h)} height={size}
      fill={color} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} style={style}>
      {title && <title>{title}</title>}
      {rects}
    </svg>
  )
}
