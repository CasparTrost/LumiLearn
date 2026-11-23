import { useEffect, useState } from 'react'
import { sfx } from '../../sfx.js'
import './play.css'

/**
 * A living backdrop for a game: sky, clouds drifting, a sun that blinks,
 * grass swaying, fish swimming by. When the child answers right anywhere
 * ('lumi:feedback'), the sun and the flowers cheer along.
 *
 * Fills its positioned parent (position: absolute; inset: 0) and sits
 * behind the game. With `interactive`, the sun, the moon and the clouds
 * can be tapped (a giggle, a boing): small surprises in a world that
 * answers back, like the toy-box feel of good children's TV.
 *
 *   <div style={{ position: 'relative' }}>
 *     <Scene theme="meadow" />
 *     …the game…
 *   </div>
 *
 * Themes: meadow · sea · night · space · room · forest · market · pond
 */
export const SCENE_THEMES = ['meadow', 'sea', 'night', 'space', 'room', 'forest', 'market', 'pond']

export default function Scene({ theme = 'meadow', interactive = false, style }) {
  const [cheer, setCheer] = useState(0)
  useEffect(() => {
    let t
    const on = e => {
      if (e.detail === 'wrong') return
      setCheer(1)
      clearTimeout(t)
      t = setTimeout(() => setCheer(0), 750)
    }
    window.addEventListener('lumi:feedback', on)
    return () => { window.removeEventListener('lumi:feedback', on); clearTimeout(t) }
  }, [])
  const Theme = THEMES[theme] ?? THEMES.meadow
  return (
    <div className="pl-scene" data-cheer={cheer} aria-hidden="true" style={style}>
      <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMax slice">
        <Theme tap={interactive ? TAP : null} />
      </svg>
    </div>
  )
}

// What a tap on a piece of the backdrop does
const TAP = {
  giggle: e => { sfx.giggle(); wiggle(e.currentTarget) },
  boing:  e => { sfx.boing();  wiggle(e.currentTarget) },
  pop:    e => { sfx.pop();    wiggle(e.currentTarget) },
}
function wiggle(el) {
  el.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.25) rotate(-8deg)' }, { transform: 'scale(0.95) rotate(5deg)' }, { transform: 'scale(1)' }],
    { duration: 600, easing: 'ease-out' })
}
const tapProps = (tap, kind) => tap ? { className: 'pl-tap', onPointerDown: tap[kind], style: { transformBox: 'fill-box', transformOrigin: 'center' } } : {}

// ── Pieces ────────────────────────────────────────────────────────────────

function Cloud({ y, scale = 1, dur, delay, tap, color = '#fff' }) {
  return (
    <g className="pl-drift" style={{ animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}>
      <g transform={`translate(0 ${y}) scale(${scale})`}>
        <g {...tapProps(tap, 'pop')}>
          <ellipse cx="60" cy="40" rx="60" ry="26" fill={color} opacity="0.95" />
          <circle cx="40" cy="28" r="26" fill={color} />
          <circle cx="78" cy="22" r="32" fill={color} />
          <circle cx="108" cy="38" r="22" fill={color} />
        </g>
      </g>
    </g>
  )
}

function Face({ cx, cy, r, ink = '#2a1b3d' }) {
  return (
    <g>
      <g className="pl-blink">
        <ellipse cx={cx - r * 0.33} cy={cy - r * 0.1} rx={r * 0.09} ry={r * 0.13} fill={ink} />
        <ellipse cx={cx + r * 0.33} cy={cy - r * 0.1} rx={r * 0.09} ry={r * 0.13} fill={ink} />
      </g>
      <circle cx={cx - r * 0.55} cy={cy + r * 0.2} r={r * 0.13} fill="#ff8fb8" opacity="0.55" />
      <circle cx={cx + r * 0.55} cy={cy + r * 0.2} r={r * 0.13} fill="#ff8fb8" opacity="0.55" />
      <path d={`M ${cx - r * 0.28} ${cy + r * 0.22} Q ${cx} ${cy + r * 0.5} ${cx + r * 0.28} ${cy + r * 0.22}`} stroke={ink} strokeWidth={r * 0.08} fill="none" strokeLinecap="round" />
    </g>
  )
}

function Sun({ x = 860, y = 110, r = 58, tap }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="pl-spin">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={-7} y={-r - 34} width="14" height="26" rx="7" fill="#ffd34d" transform={`rotate(${i * 30})`} />
        ))}
      </g>
      <g className="pl-cheerable" {...tapProps(tap, 'giggle')}>
        <circle r={r} fill="#ffd84a" stroke="#f2b632" strokeWidth="6" />
        <Face cx={0} cy={0} r={r} />
      </g>
    </g>
  )
}

function Moon({ x = 840, y = 120, tap }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="90" fill="#fff6c9" opacity="0.12" className="pl-glow" />
      <g className="pl-cheerable" {...tapProps(tap, 'giggle')}>
        <circle r="52" fill="#fff3b0" stroke="#e8d27a" strokeWidth="5" />
        <circle cx="-18" cy="-20" r="8" fill="#eedc8c" />
        <circle cx="20" cy="22" r="6" fill="#eedc8c" />
        <Face cx={0} cy={4} r={46} />
      </g>
    </g>
  )
}

function Stars({ n = 40, seed = 3, h = 380 }) {
  const out = []
  let s = seed
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280
  for (let i = 0; i < n; i++) {
    const x = rnd() * 1000, y = rnd() * h, r = 1.5 + rnd() * 3
    out.push(<circle key={i} cx={x} cy={y} r={r} fill="#fff" className="pl-twinkle" style={{ animationDelay: `-${rnd() * 3}s` }} />)
  }
  return <g>{out}</g>
}

function Flower({ x, y, color, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="pl-sway" style={{ animationDelay: `-${(x % 7) / 2}s` }}>
        <rect x="-2.5" y="-46" width="5" height="46" fill="#3f9a3a" />
        <g className="pl-hopper">
          {[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx="0" cy="-58" rx="9" ry="14" fill={color} transform={`rotate(${a} 0 -46)`} />)}
          <circle cx="0" cy="-46" r="8" fill="#ffd84a" />
        </g>
      </g>
    </g>
  )
}

function Tuft({ x, y, color = '#5fae3f' }) {
  return (
    <g transform={`translate(${x} ${y})`} className="pl-sway" style={{ animationDelay: `-${(x % 5) / 2}s` }}>
      <path d="M-14 0 Q-12 -26 -4 -34 Q-6 -16 0 0 Q2 -30 10 -38 Q6 -14 14 0 Z" fill={color} />
    </g>
  )
}

function Butterfly({ y = 260, dur = 18, delay = 0, color = '#ff8fb8' }) {
  return (
    <g className="pl-fly" style={{ animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}>
      <g transform={`translate(0 ${y})`}>
        <g className="pl-bob">
          <g className="pl-flap">
            <ellipse cx="-9" cy="0" rx="10" ry="13" fill={color} />
            <ellipse cx="9" cy="0" rx="10" ry="13" fill={color} />
          </g>
          <rect x="-2" y="-10" width="4" height="20" rx="2" fill="#2a1b3d" />
        </g>
      </g>
    </g>
  )
}

function Bird({ y = 140, dur = 22, delay = 0 }) {
  return (
    <g className="pl-fly" style={{ animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}>
      <g transform={`translate(0 ${y})`}>
        <g className="pl-flap">
          <path d="M-18 0 Q-9 -12 0 0 Q9 -12 18 0" stroke="#2a1b3d" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      </g>
    </g>
  )
}

function Hills({ back = '#a8e07a', front = '#7cc95a', ground = '#6dbb4c' }) {
  return (
    <g>
      <path d="M0 420 Q150 330 320 400 T640 380 T1000 390 V600 H0 Z" fill={back} />
      <path d="M0 470 Q200 400 420 460 T820 450 T1000 440 V600 H0 Z" fill={front} />
      <rect x="0" y="540" width="1000" height="60" fill={ground} />
    </g>
  )
}

// ── Themes ────────────────────────────────────────────────────────────────

function Meadow({ tap }) {
  return (
    <g>
      <defs>
        <linearGradient id="pl-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd3ff" /><stop offset="1" stopColor="#e4f6ff" />
        </linearGradient>
      </defs>
      <rect width="1000" height="600" fill="url(#pl-sky)" />
      <Sun tap={tap} />
      <Cloud y={60}  dur={70} delay={10} tap={tap} />
      <Cloud y={150} dur={95} delay={60} scale={0.7} tap={tap} />
      <Cloud y={30}  dur={120} delay={95} scale={0.55} tap={tap} />
      <Bird y={170} dur={26} delay={8} />
      <Hills />
      <Butterfly y={380} dur={20} delay={4} />
      <Butterfly y={330} dur={27} delay={16} color="#ffd34d" />
      {[60, 180, 330, 470, 610, 760, 900].map((x, i) => <Tuft key={x} x={x} y={560 + (i % 2) * 18} />)}
      <Flower x={110} y={590} color="#ff6b5b" />
      <Flower x={260} y={575} color="#ffffff" s={0.8} />
      <Flower x={720} y={585} color="#ff8fb8" />
      <Flower x={880} y={572} color="#4aa3ff" s={0.85} />
    </g>
  )
}

function Pond({ tap }) {
  return (
    <g>
      <Meadow tap={tap} />
      <ellipse cx="500" cy="560" rx="420" ry="70" fill="#4aa3ff" opacity="0.9" />
      <ellipse cx="500" cy="552" rx="400" ry="58" fill="#7cc4ff" />
      {[300, 520, 700].map((x, i) => (
        <g key={x} className="pl-bob" style={{ animationDelay: `-${i}s` }}>
          <ellipse cx={x} cy={555 + (i % 2) * 8} rx="38" ry="12" fill="#4fae4a" />
        </g>
      ))}
    </g>
  )
}

function Sea({ tap }) {
  return (
    <g>
      <defs>
        <linearGradient id="pl-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5ec8f2" /><stop offset="1" stopColor="#1f6fb2" />
        </linearGradient>
      </defs>
      <rect width="1000" height="600" fill="url(#pl-sea)" />
      {[120, 380, 640, 860].map((x, i) => (
        <polygon key={x} points={`${x},0 ${x + 60},0 ${x + 160},600 ${x + 40},600`} fill="#fff" opacity="0.07" className="pl-glow" style={{ animationDelay: `-${i * 0.7}s` }} />
      ))}
      {[[-1, 210, 28, '#ffb648'], [-1, 330, 36, '#ff8fb8'], [-1, 140, 44, '#9be15d']].map(([, y, dur, c], i) => (
        <g key={i} className="pl-swim" style={{ animationDuration: `${dur}s`, animationDelay: `-${i * 9}s` }}>
          <g transform={`translate(0 ${y})`}>
            <g className="pl-bob">
              <ellipse cx="0" cy="0" rx="26" ry="15" fill={c} />
              <polygon points="-22,0 -42,-14 -42,14" fill={c} />
              <circle cx="12" cy="-4" r="3.5" fill="#2a1b3d" />
            </g>
          </g>
        </g>
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx={40 + i * 70} cy={620} r={4 + (i % 4) * 3} fill="none" stroke="#fff" strokeWidth="2" opacity="0.7"
          className="pl-rise" style={{ animationDuration: `${7 + (i % 5) * 2}s`, animationDelay: `-${i * 1.3}s` }} />
      ))}
      <path d="M0 540 Q250 510 500 535 T1000 530 V600 H0 Z" fill="#f4d58d" />
      {[90, 240, 760, 920].map((x, i) => (
        <g key={x} transform={`translate(${x} 560)`}>
          <path className="pl-sway" style={{ animationDelay: `-${i}s` }} d="M0 0 Q-16 -40 0 -80 Q16 -120 0 -160" stroke="#3fae6a" strokeWidth="12" fill="none" strokeLinecap="round" />
        </g>
      ))}
      <g transform="translate(600 556)" {...tapProps(tap, 'boing')}>
        <path d="M-26 0 L0 -30 L26 0 Z" fill="#ff8a5b" />
        <circle cx="0" cy="-12" r="5" fill="#fff" />
      </g>
    </g>
  )
}

function Night({ tap }) {
  return (
    <g>
      <defs>
        <linearGradient id="pl-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1446" /><stop offset="1" stopColor="#3b2f7a" />
        </linearGradient>
      </defs>
      <rect width="1000" height="600" fill="url(#pl-night)" />
      <Stars n={50} />
      <Moon tap={tap} />
      <Hills back="#2e2a63" front="#25224f" ground="#1f1c45" />
      {Array.from({ length: 8 }, (_, i) => (
        <circle key={i} cx={80 + i * 120} cy={470 + (i % 3) * 25} r="4" fill="#fff59a" className="pl-twinkle" style={{ animationDelay: `-${i * 0.6}s` }} />
      ))}
    </g>
  )
}

function Space({ tap }) {
  return (
    <g>
      <defs>
        <radialGradient id="pl-space" cx="0.3" cy="0.2" r="1">
          <stop offset="0" stopColor="#3a2a86" /><stop offset="1" stopColor="#120b32" />
        </radialGradient>
      </defs>
      <rect width="1000" height="600" fill="url(#pl-space)" />
      <Stars n={70} h={600} seed={9} />
      <g className="pl-comet"><g><circle r="6" fill="#fff" /><path d="M0 0 L80 -45" stroke="#fff" strokeWidth="4" opacity="0.6" strokeLinecap="round" /></g></g>
      <g transform="translate(830 130)" className="pl-bob">
        <g className="pl-cheerable" {...tapProps(tap, 'boing')}>
          <circle r="62" fill="#ff8fb8" />
          <ellipse rx="100" ry="20" fill="none" stroke="#ffd34d" strokeWidth="9" transform="rotate(-16)" />
          <circle cx="-20" cy="-14" r="10" fill="#ff6fa3" />
          <Face cx={6} cy={10} r={40} />
        </g>
      </g>
      <g transform="translate(140 470)">
        <circle r="120" fill="#5b4bb0" />
        <circle cx="-40" cy="-50" r="18" fill="#4a3c98" />
        <circle cx="40" cy="-10" r="12" fill="#4a3c98" />
      </g>
    </g>
  )
}

function Room({ tap }) {
  return (
    <g>
      <rect width="1000" height="600" fill="#ffe8c4" />
      {Array.from({ length: 21 }, (_, i) => <rect key={i} x={i * 50} y="0" width="22" height="470" fill="#ffdcae" />)}
      <g transform="translate(720 70)">
        <rect width="220" height="170" rx="10" fill="#9fdcff" stroke="#8a4f22" strokeWidth="12" />
        <g {...tapProps(tap, 'giggle')}><circle cx="160" cy="55" r="28" fill="#ffd84a" className="pl-cheerable" /></g>
        <Cloud y={70} dur={60} delay={30} scale={0.4} />
        <rect x="104" y="0" width="12" height="170" fill="#8a4f22" />
        <rect x="0" y="80" width="220" height="12" fill="#8a4f22" />
      </g>
      <g transform="translate(80 150)">
        <rect width="240" height="16" rx="4" fill="#a8693a" />
        <g className="pl-cheerable" {...tapProps(tap, 'boing')}>
          <circle cx="40" cy="-22" r="22" fill="#ff6b5b" />
          <rect x="90" y="-50" width="40" height="50" rx="6" fill="#4aa3ff" />
          <path d="M170 0 L190 -48 L210 0 Z" fill="#5cc45a" />
        </g>
      </g>
      <rect x="0" y="470" width="1000" height="130" fill="#c98a52" />
      {Array.from({ length: 6 }, (_, i) => <rect key={i} x="0" y={480 + i * 22} width="1000" height="3" fill="#b07440" />)}
      <ellipse cx="500" cy="560" rx="330" ry="40" fill="#ff8fb8" opacity="0.5" />
    </g>
  )
}

function Forest({ tap }) {
  return (
    <g>
      <defs>
        <linearGradient id="pl-forest" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bdeccb" /><stop offset="1" stopColor="#e9f8de" />
        </linearGradient>
      </defs>
      <rect width="1000" height="600" fill="url(#pl-forest)" />
      <Sun x={500} y={90} r={44} tap={tap} />
      {[[-20, '#6fbf73'], [160, '#5aa85f'], [380, '#6fbf73'], [600, '#5aa85f'], [800, '#6fbf73'], [960, '#5aa85f']].map(([x, c], i) => (
        <g key={i} transform={`translate(${x} ${330 + (i % 2) * 30})`}>
          <rect x="-12" y="40" width="24" height="200" fill="#8a5a33" />
          <g className="pl-sway" style={{ animationDuration: '5s', animationDelay: `-${i}s` }}>
            <circle cx="0" cy="0" r="80" fill={c} />
            <circle cx="-50" cy="40" r="56" fill={c} />
            <circle cx="50" cy="40" r="56" fill={c} />
          </g>
        </g>
      ))}
      <rect x="0" y="520" width="1000" height="80" fill="#5c9e45" />
      {[140, 520, 870].map((x, i) => (
        <g key={x} transform={`translate(${x} 540)`} className="pl-hopper" {...tapProps(tap, 'boing')}>
          <rect x="-7" y="-22" width="14" height="24" rx="4" fill="#fff4e0" />
          <path d="M-26 -18 Q0 -54 26 -18 Z" fill={i % 2 ? '#ff6b5b' : '#ff9f43'} />
          <circle cx="-8" cy="-28" r="4" fill="#fff" /><circle cx="8" cy="-33" r="3" fill="#fff" />
        </g>
      ))}
      <Butterfly y={300} dur={22} delay={6} color="#ffd34d" />
      {Array.from({ length: 7 }, (_, i) => <Tuft key={i} x={60 + i * 150} y={560 + (i % 2) * 20} color="#4b8f37" />)}
    </g>
  )
}

function Market({ tap }) {
  return (
    <g>
      <Meadow tap={tap} />
      <g>
        {Array.from({ length: 11 }, (_, i) => (
          <path key={i} d={`M${i * 100 - 10} 0 H${i * 100 + 90} V70 Q${i * 100 + 40} 110 ${i * 100 - 10} 70 Z`} fill={i % 2 ? '#fff' : '#ff6b5b'} />
        ))}
        <rect x="0" y="0" width="1000" height="10" fill="#c2412d" />
      </g>
      <rect x="0" y="500" width="1000" height="100" fill="#a8693a" />
      <rect x="0" y="500" width="1000" height="14" fill="#c98a52" />
    </g>
  )
}

const THEMES = { meadow: Meadow, sea: Sea, night: Night, space: Space, room: Room, forest: Forest, market: Market, pond: Pond }
