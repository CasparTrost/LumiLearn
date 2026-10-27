// Small building blocks of the Pixel-Abenteuer look (styles/pixel.css).

const BASE = import.meta.env.BASE_URL ?? '/'
export const uiSpr  = f => BASE.replace(/\/$/, '') + '/sprites/ui/' + f
const mazeSpr       = f => BASE.replace(/\/$/, '') + '/sprites/maze/' + f

/** Lumi as the pixel sprite from the maze; `happy` shows the beaming frame. */
export function PixelLumi({ size = 96, happy = false, bob = true, style }) {
  return (
    <img
      src={mazeSpr(happy ? 'lumi_happy.png' : 'lumi_idle.png')}
      alt="Lumi"
      draggable={false}
      className={`px-art${bob ? ' px-bob' : ''}`}
      style={{ width: size, height: size, display: 'block', filter: 'drop-shadow(0 4px 0 rgba(42,27,61,0.35))', ...style }}
    />
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
