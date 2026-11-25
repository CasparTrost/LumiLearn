/**
 * Taschenlampen-Jagd: the five rooms and their furniture, drawn in three
 * ways (`mode`):
 *   'shade'  in the torch light: everything a flat grey-violet shape, the
 *            shadows black in front of it (the light makes shadow play)
 *   'lit'    the room's light is on: colours, wallpaper, a wooden floor
 *   'ghost'  over the darkness: only faint outlines, so the dark room still
 *            reads as a room and the furniture as places to hide behind
 * Pieces at the back stand against the wall, behind the shadows; the low
 * pieces in front hide the lower half of a shadow that crouches behind
 * them (`hidesOf` tells the shadows where they are).
 */

const SHADE = '#5d5478'
const SHADE_EDGE = '#4a4264'
const GHOST = 'rgba(190,178,240,0.34)'
const INK = '#2a1b3d'

function pal(mode) {
  if (mode === 'lit') return { f: c => c, s: INK, sw: 3 }
  if (mode === 'ghost') return { f: () => 'none', s: GHOST, sw: 2.5 }
  return { f: () => SHADE, s: SHADE_EDGE, sw: 2 }
}

// ── The pieces (each an SVG in its own box; width / height = its aspect) ──

function Bed({ p }) {
  return (
    <svg viewBox="0 0 200 110">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <rect x="6" y="10" width="22" height="96" rx="6" fill={p.f('#b0703c')} />
        <rect x="172" y="40" width="22" height="66" rx="6" fill={p.f('#b0703c')} />
        <rect x="24" y="52" width="152" height="34" rx="8" fill={p.f('#ffffff')} />
        <path d="M60 52 Q120 40 176 52 L176 86 L60 86 Z" fill={p.f('#6fb6ff')} />
        <rect x="30" y="38" width="38" height="20" rx="9" fill={p.f('#fff3c4')} />
        <rect x="28" y="86" width="144" height="10" fill={p.f('#8a4f22')} />
      </g>
    </svg>
  )
}
Bed.aspect = 200 / 110

function Shelf({ p }) {
  return (
    <svg viewBox="0 0 90 170">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <rect x="4" y="4" width="82" height="162" rx="4" fill={p.f('#c98a52')} />
        {[52, 100, 148].map(y => <line key={y} x1="4" x2="86" y1={y} y2={y} />)}
        <rect x="12" y="22" width="12" height="30" fill={p.f('#ff6b5b')} />
        <rect x="26" y="18" width="10" height="34" fill={p.f('#4aa3ff')} />
        <rect x="38" y="26" width="12" height="26" fill={p.f('#5cc45a')} />
        <circle cx="66" cy="38" r="13" fill={p.f('#ffc93c')} />
        <rect x="14" y="78" width="26" height="22" rx="3" fill={p.f('#b98cff')} />
        <path d="M54 100 L66 72 L78 100 Z" fill={p.f('#ff8fb8')} />
        <rect x="16" y="126" width="56" height="22" rx="4" fill={p.f('#3fc1a8')} />
      </g>
    </svg>
  )
}
Shelf.aspect = 90 / 170

function ToyBox({ p }) {
  return (
    <svg viewBox="0 0 120 70">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <path d="M20 14 L34 2 L48 14" fill={p.f('#ffc93c')} />
        <circle cx="86" cy="10" r="10" fill={p.f('#ff6b5b')} />
        <rect x="4" y="16" width="112" height="50" rx="6" fill={p.f('#ff8a3d')} />
        <rect x="4" y="16" width="112" height="12" rx="4" fill={p.f('#ffb36b')} />
        <circle cx="60" cy="46" r="9" fill={p.f('#fff3c4')} />
      </g>
    </svg>
  )
}
ToyBox.aspect = 120 / 70

function Window({ p, mode }) {
  return (
    <svg viewBox="0 0 100 90">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <rect x="6" y="6" width="88" height="74" rx="4" fill={mode === 'lit' ? '#2e2a63' : p.f('#2e2a63')} />
        {mode === 'lit' && <circle cx="70" cy="28" r="10" fill="#fff3a0" />}
        <line x1="50" y1="6" x2="50" y2="80" />
        <line x1="6" y1="43" x2="94" y2="43" />
        <rect x="2" y="78" width="96" height="8" rx="3" fill={p.f('#c98a52')} />
      </g>
    </svg>
  )
}
Window.aspect = 100 / 90

function Picture({ p }) {
  return (
    <svg viewBox="0 0 80 64">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <rect x="4" y="4" width="72" height="56" rx="3" fill={p.f('#c98a52')} />
        <rect x="12" y="12" width="56" height="40" fill={p.f('#bfe8ff')} />
        <path d="M12 52 L32 28 L46 42 L54 34 L68 52 Z" fill={p.f('#5cc45a')} />
        <circle cx="56" cy="22" r="5" fill={p.f('#ffc93c')} />
      </g>
    </svg>
  )
}
Picture.aspect = 80 / 64

function Cupboard({ p }) {
  return (
    <svg viewBox="0 0 100 170">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <rect x="4" y="4" width="92" height="162" rx="4" fill={p.f('#7ecbb8')} />
        <rect x="12" y="14" width="34" height="60" rx="3" fill={p.f('#a6e3d4')} />
        <rect x="54" y="14" width="34" height="60" rx="3" fill={p.f('#a6e3d4')} />
        <rect x="4" y="84" width="92" height="10" fill={p.f('#e8d3b0')} />
        <rect x="12" y="102" width="34" height="56" rx="3" fill={p.f('#a6e3d4')} />
        <rect x="54" y="102" width="34" height="56" rx="3" fill={p.f('#a6e3d4')} />
        <circle cx="40" cy="130" r="3" fill={p.f(INK)} /><circle cx="60" cy="130" r="3" fill={p.f(INK)} />
      </g>
    </svg>
  )
}
Cupboard.aspect = 100 / 170

function Stove({ p }) {
  return (
    <svg viewBox="0 0 100 110">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <path d="M38 8 Q50 -2 62 8 L64 22 L36 22 Z" fill={p.f('#ff6b5b')} />
        <rect x="4" y="24" width="92" height="82" rx="5" fill={p.f('#f2f2f2')} />
        <rect x="4" y="24" width="92" height="14" rx="4" fill={p.f('#d8d8e0')} />
        <rect x="16" y="50" width="68" height="44" rx="5" fill={p.f('#3a3550')} />
        <circle cx="22" cy="31" r="3" fill={p.f(INK)} /><circle cx="78" cy="31" r="3" fill={p.f(INK)} />
      </g>
    </svg>
  )
}
Stove.aspect = 100 / 110

function Chair({ p }) {
  return (
    <svg viewBox="0 0 70 80">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <rect x="10" y="4" width="10" height="72" rx="3" fill={p.f('#b0703c')} />
        <rect x="10" y="40" width="52" height="10" rx="3" fill={p.f('#c98a52')} />
        <rect x="52" y="44" width="10" height="32" rx="3" fill={p.f('#b0703c')} />
        <rect x="10" y="10" width="24" height="8" fill={p.f('#c98a52')} />
      </g>
    </svg>
  )
}
Chair.aspect = 70 / 80

function Basket({ p }) {
  return (
    <svg viewBox="0 0 110 64">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <path d="M20 26 Q55 -14 90 26" fill="none" />
        <path d="M6 24 L104 24 L94 60 L16 60 Z" fill={p.f('#d9a05b')} />
        <line x1="12" y1="38" x2="98" y2="38" /><line x1="15" y1="50" x2="95" y2="50" />
      </g>
    </svg>
  )
}
Basket.aspect = 110 / 64

function Sofa({ p }) {
  return (
    <svg viewBox="0 0 220 100">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <rect x="22" y="8" width="176" height="56" rx="16" fill={p.f('#8d6ad8')} />
        <rect x="4" y="38" width="38" height="52" rx="12" fill={p.f('#7a58c4')} />
        <rect x="178" y="38" width="38" height="52" rx="12" fill={p.f('#7a58c4')} />
        <rect x="38" y="54" width="144" height="34" rx="8" fill={p.f('#a387e6')} />
        <line x1="110" y1="54" x2="110" y2="88" />
        <rect x="18" y="88" width="10" height="10" fill={p.f(INK)} /><rect x="192" y="88" width="10" height="10" fill={p.f(INK)} />
      </g>
    </svg>
  )
}
Sofa.aspect = 220 / 100

function FloorLamp({ p, mode }) {
  return (
    <svg viewBox="0 0 70 190">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <path d="M12 46 L22 6 L48 6 L58 46 Z" fill={mode === 'lit' ? '#fff3a0' : p.f('#fff3a0')} />
        <rect x="32" y="46" width="6" height="128" fill={p.f(INK)} />
        <ellipse cx="35" cy="178" rx="24" ry="8" fill={p.f('#5a4a3a')} />
      </g>
    </svg>
  )
}
FloorLamp.aspect = 70 / 190

function Plant({ p }) {
  return (
    <svg viewBox="0 0 80 120">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <path d="M40 74 Q8 60 10 24 Q30 40 40 74 Z" fill={p.f('#5cc45a')} />
        <path d="M40 74 Q72 60 70 20 Q50 40 40 74 Z" fill={p.f('#4caf50')} />
        <path d="M40 74 Q36 30 42 4 Q52 34 40 74 Z" fill={p.f('#6fd16b')} />
        <path d="M18 72 L62 72 L56 116 L24 116 Z" fill={p.f('#e07a4f')} />
      </g>
    </svg>
  )
}
Plant.aspect = 80 / 120

function Pouf({ p }) {
  return (
    <svg viewBox="0 0 110 60">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <rect x="6" y="8" width="98" height="48" rx="20" fill={p.f('#ff8fb8')} />
        <path d="M18 22 Q55 34 92 22" fill="none" />
      </g>
    </svg>
  )
}
Pouf.aspect = 110 / 60

function Boxes({ p }) {
  return (
    <svg viewBox="0 0 120 130">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <rect x="6" y="64" width="62" height="62" rx="3" fill={p.f('#c98a52')} />
        <rect x="62" y="80" width="52" height="46" rx="3" fill={p.f('#d9a05b')} />
        <rect x="18" y="14" width="56" height="50" rx="3" fill={p.f('#d9a05b')} />
        <line x1="37" y1="64" x2="37" y2="84" /><line x1="46" y1="14" x2="46" y2="30" />
      </g>
    </svg>
  )
}
Boxes.aspect = 120 / 130

function RoundWindow({ p, mode }) {
  return (
    <svg viewBox="0 0 80 80">
      <g stroke={p.s} strokeWidth={p.sw}>
        <circle cx="40" cy="40" r="34" fill={mode === 'lit' ? '#2e2a63' : p.f('#2e2a63')} />
        {mode === 'lit' && <circle cx="52" cy="28" r="8" fill="#fff3a0" />}
        <line x1="40" y1="6" x2="40" y2="74" /><line x1="6" y1="40" x2="74" y2="40" />
      </g>
    </svg>
  )
}
RoundWindow.aspect = 1

function Chest({ p }) {
  return (
    <svg viewBox="0 0 130 74">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <path d="M6 30 Q6 4 65 4 Q124 4 124 30 Z" fill={p.f('#a0622d')} />
        <rect x="6" y="30" width="118" height="40" rx="3" fill={p.f('#b0703c')} />
        <rect x="56" y="24" width="18" height="20" rx="3" fill={p.f('#ffc93c')} />
        <line x1="30" y1="6" x2="30" y2="70" /><line x1="100" y1="6" x2="100" y2="70" />
      </g>
    </svg>
  )
}
Chest.aspect = 130 / 74

function Web({ p }) {
  return (
    <svg viewBox="0 0 60 60">
      <g stroke={p.s} strokeWidth={p.sw * 0.7} fill="none">
        <path d="M0 0 L60 60 M0 0 L30 60 M0 0 L60 30 M0 0 L0 60 M0 0 L60 0" />
        <path d="M0 20 Q14 14 20 0 M0 38 Q26 30 38 0 M0 56 Q40 44 56 0" />
      </g>
    </svg>
  )
}
Web.aspect = 1

function Hay({ p }) {
  return (
    <svg viewBox="0 0 120 66">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <rect x="4" y="6" width="112" height="56" rx="10" fill={p.f('#f2c95c')} />
        <line x1="40" y1="6" x2="40" y2="62" /><line x1="80" y1="6" x2="80" y2="62" />
        <path d="M14 22 L26 18 M54 36 L66 30 M92 20 L104 26" />
      </g>
    </svg>
  )
}
Hay.aspect = 120 / 66

function Trough({ p }) {
  return (
    <svg viewBox="0 0 150 60">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <path d="M6 10 L144 10 L130 46 L20 46 Z" fill={p.f('#a0622d')} />
        <path d="M14 14 Q40 2 70 12 Q100 2 136 14" fill={p.f('#f2c95c')} />
        <rect x="24" y="46" width="10" height="12" fill={p.f(INK)} /><rect x="116" y="46" width="10" height="12" fill={p.f(INK)} />
      </g>
    </svg>
  )
}
Trough.aspect = 150 / 60

function BarnDoor({ p }) {
  return (
    <svg viewBox="0 0 100 150">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <rect x="4" y="4" width="92" height="142" rx="3" fill={p.f('#d2553f')} />
        <path d="M4 4 L96 146 M96 4 L4 146" fill="none" stroke={p.s} />
        <rect x="4" y="4" width="92" height="142" rx="3" fill="none" />
      </g>
    </svg>
  )
}
BarnDoor.aspect = 100 / 150

function Lantern({ p, mode }) {
  return (
    <svg viewBox="0 0 40 70">
      <g stroke={p.s} strokeWidth={p.sw} strokeLinejoin="round">
        <path d="M20 2 L20 12" />
        <path d="M10 12 L30 12 L32 18 L8 18 Z" fill={p.f('#3a3550')} />
        <rect x="10" y="18" width="20" height="34" rx="4" fill={mode === 'lit' ? '#ffe36b' : p.f('#ffe36b')} />
        <path d="M8 52 L32 52 L28 60 L12 60 Z" fill={p.f('#3a3550')} />
      </g>
    </svg>
  )
}
Lantern.aspect = 40 / 70

// ── The rooms ──────────────────────────────────────────────────────────
// Each piece: { C, x (middle, share of the width), h (share of the height),
// at: 'floor' (stands at the back, on the floor line) · 'front' (low, at
// the front edge: things crouch behind it) · 'wall' (y: its middle) ·
// 'ceiling' (hangs from the top) · 'corner' (top left corner) }, maxW: share
// of the width it may take at most.
const THEMES = {
  kinderzimmer: {
    wall: '#ffe3f1', paper: 'repeating-linear-gradient(90deg, #ffe3f1 0 34px, #d9f1ff 34px 68px)', floor: '#c98a52',
    pieces: [
      { C: Window, x: 0.5, y: 0.25, h: 0.3, at: 'wall', maxW: 0.24 },
      { C: Bed, x: 0.2, h: 0.24, at: 'floor', maxW: 0.36 },
      { C: Shelf, x: 0.86, h: 0.44, at: 'floor', maxW: 0.2 },
      { C: ToyBox, x: 0.62, h: 0.15, at: 'front', maxW: 0.24 },
    ],
  },
  kueche: {
    wall: '#fff2c2', paper: 'repeating-linear-gradient(0deg, #fff2c2 0 30px, #ffe9a8 30px 32px), repeating-linear-gradient(90deg, transparent 0 30px, #ffe9a8 30px 32px)', floor: '#d9c7a5',
    pieces: [
      { C: Cupboard, x: 0.13, h: 0.44, at: 'floor', maxW: 0.22 },
      { C: Window, x: 0.5, y: 0.24, h: 0.28, at: 'wall', maxW: 0.24 },
      { C: Stove, x: 0.84, h: 0.3, at: 'floor', maxW: 0.24 },
      { C: Basket, x: 0.36, h: 0.13, at: 'front', maxW: 0.22 },
      { C: Chair, x: 0.74, h: 0.2, at: 'front', maxW: 0.16 },
    ],
  },
  wohnzimmer: {
    wall: '#d9f1ff', paper: 'repeating-linear-gradient(90deg, #d9f1ff 0 40px, #c8e8fb 40px 44px)', floor: '#b0703c',
    pieces: [
      { C: Picture, x: 0.32, y: 0.22, h: 0.2, at: 'wall', maxW: 0.2 },
      { C: Plant, x: 0.08, h: 0.3, at: 'floor', maxW: 0.14 },
      { C: Sofa, x: 0.48, h: 0.24, at: 'floor', maxW: 0.42 },
      { C: FloorLamp, x: 0.86, h: 0.44, at: 'floor', maxW: 0.14 },
      { C: Pouf, x: 0.7, h: 0.13, at: 'front', maxW: 0.2 },
    ],
  },
  dachboden: {
    wall: '#e8d3b0', paper: 'repeating-linear-gradient(90deg, #e8d3b0 0 46px, #dcc39a 46px 50px)', floor: '#8a6a4a',
    roof: true,
    pieces: [
      { C: Web, x: 1, y: 0, h: 0.2, at: 'corner', maxW: 0.2 },
      { C: RoundWindow, x: 0.5, y: 0.26, h: 0.22, at: 'wall', maxW: 0.2 },
      { C: Boxes, x: 0.84, h: 0.36, at: 'floor', maxW: 0.24 },
      { C: Chest, x: 0.3, h: 0.15, at: 'front', maxW: 0.26 },
    ],
  },
  stall: {
    wall: '#e9b48a', paper: 'repeating-linear-gradient(0deg, #e9b48a 0 26px, #d89a6c 26px 29px)', floor: '#c9a35a',
    pieces: [
      { C: Lantern, x: 0.3, y: 0, h: 0.18, at: 'ceiling', maxW: 0.1 },
      { C: BarnDoor, x: 0.62, h: 0.44, at: 'floor', maxW: 0.22 },
      { C: Trough, x: 0.2, h: 0.14, at: 'floor', maxW: 0.3 },
      { C: Hay, x: 0.85, h: 0.15, at: 'front', maxW: 0.26 },
      { C: Hay, x: 0.14, h: 0.13, at: 'front', maxW: 0.22 },
    ],
  },
}

export const FLOOR = 0.6   // where the wall meets the floor (share of the height; sim.js makeRoom)

/** Where every piece of a room goes, in px. */
export function placePieces(theme, W, H) {
  const floorY = H * FLOOR
  return THEMES[theme].pieces.map((pc, i) => {
    let h = pc.h * H
    let w = h * pc.C.aspect
    if (w > pc.maxW * W) { w = pc.maxW * W; h = w / pc.C.aspect }
    const x = pc.at === 'corner' ? (pc.x ? W - w : 0) : pc.x * W - w / 2
    const y = pc.at === 'floor' ? floorY + H * 0.05 - h
      : pc.at === 'front' ? H - h
      : pc.at === 'ceiling' ? 0
      : pc.at === 'corner' ? 0
      : pc.y * H - h / 2
    return { key: i, C: pc.C, at: pc.at, x, y, w, h, flip: pc.at === 'corner' && pc.x > 0 }
  })
}

/** The low pieces in front, for the shadows to hide behind ({ x, w, top }). */
export function hidesOf(theme, W, H) {
  return placePieces(theme, W, H).filter(p => p.at === 'front').map(p => ({ x: p.x + p.w / 2, w: p.w, top: p.y }))
}

function Piece({ pc, mode }) {
  const { C } = pc
  return (
    <div style={{ position: 'absolute', left: pc.x, top: pc.y, width: pc.w, height: pc.h, pointerEvents: 'none' }}>
      <div style={{ width: '100%', height: '100%', display: 'flex', transform: pc.flip ? 'scaleX(-1)' : undefined }}>
        <C p={pal(mode)} mode={mode} />
      </div>
    </div>
  )
}

/** The wall and the floor (and the roof beams of the attic). */
export function Backdrop({ theme, W, H, mode }) {
  const t = THEMES[theme]
  const lit = mode === 'lit'
  const floorY = H * FLOOR
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: floorY + 2, background: lit ? t.paper : '#ece6f4', transition: 'background .6s' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, top: floorY, bottom: 0,
        background: lit ? `repeating-linear-gradient(90deg, ${t.floor} 0 58px, rgba(0,0,0,0.08) 58px 60px), ${t.floor}` : '#d8d0e6',
        borderTop: `4px solid ${lit ? INK : '#bdb3d0'}`,
      }} />
      {t.roof && (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          <path d={`M0 0 L${W * 0.22} 0 L0 ${H * 0.4} Z M${W} 0 L${W * 0.78} 0 L${W} ${H * 0.4} Z`} fill={lit ? '#8a5a3a' : '#c9bfdb'} stroke={lit ? INK : '#bdb3d0'} strokeWidth="3" />
        </svg>
      )}
    </div>
  )
}

/** The furniture of a room: `layer` 'back' (behind the shadows), 'front' or 'all'. */
export function Furniture({ theme, W, H, mode, layer = 'all' }) {
  const pieces = placePieces(theme, W, H).filter(pc => layer === 'all' || (layer === 'front') === (pc.at === 'front'))
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {pieces.map(pc => <Piece key={pc.key} pc={pc} mode={mode} />)}
    </div>
  )
}
