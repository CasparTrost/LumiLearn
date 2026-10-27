import { useState } from 'react'

// Picture of a game on its tile: pixel art from public/sprites/tiles/<id>.png
// (generated with gpt-image-2, see PR notes). Should a picture ever fail to
// load, the game's emoji stands in.
const BASE = import.meta.env.BASE_URL ?? '/'
const tileSpr = id => BASE.replace(/\/$/, '') + '/sprites/tiles/' + id + '.png'

function Picture({ mod, size }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return <span style={{ fontSize: size * 0.72, lineHeight: 1, display: 'block' }}>{mod.emoji}</span>
  }
  return (
    <img
      src={tileSpr(mod.id)}
      alt=""
      draggable={false}
      onError={() => setBroken(true)}
      style={{ width: size, height: size, display: 'block' }}
    />
  )
}

export default function TileArt({ mod, size = 64, bare = false }) {
  if (bare) {
    return (
      <div style={{ filter: 'drop-shadow(0 4px 0 rgba(42,27,61,0.35))' }}>
        <Picture mod={mod} size={size} />
      </div>
    )
  }
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: mod.color ?? 'var(--px-parch-dark)',
      border: '3px solid var(--px-ink)', borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.2)',
      overflow: 'hidden',
    }}>
      <Picture mod={mod} size={Math.round(size * 0.84)} />
    </div>
  )
}
