import { Art } from '../../components/play/index.js'
import Pal from './Pal.jsx'
import { holdNode, Blanket } from './cases.jsx'

/**
 * What the child can let Lumi do for a friend: the picture cards.
 *
 * Every card plays out on the stage, the helpful ones and the others, so
 * the child sees what it does to the friend. `play(c, k, ok)` gives the
 * timed steps, when the friend reacts (`hit`) and when it is over (`end`).
 * `c` moves Lumi (`H`), the friend (`F`), things flying between them
 * (`gift`) and the scenery (`P`).
 */
const OUT = '#4a2a22'
const ARRIVE = 900
const OFF = 470

// Lumi walks in, from the left unless `side` says otherwise
const enter = (c, { dx, side = 'l', hold = null, feel = 'kind' }) => [
  [0, () => c.H({ on: true, dx: side === 'r' ? OFF : -OFF, feel, arms: undefined, hold, flip: side === 'r', extra: null, walk: true, slow: false, hop: 0 })],
  [80, () => c.H({ dx })],
  [ARRIVE, () => c.H({ walk: false })],
]
// It did not help: Lumi sees it, and goes
const retreat = (c, t, side = 'l') => [
  [t, () => c.H({ feel: 'oops', arms: undefined, extra: null })],
  [t + 700, () => c.H({ dx: side === 'r' ? OFF : -OFF, walk: true, flip: side !== 'r' })],
  [t + 1500, () => c.H({ on: false, walk: false })],
]

export const ACTIONS = {
  hug: {
    say: 'detektiv/hilfe-arm', label: 'In den Arm nehmen',
    play: (c) => ({
      steps: [...enter(c, { dx: -150 }), [ARRIVE, () => c.H({ dx: -92, feel: 'calm', arms: 'hugR' })], [ARRIVE + 300, () => { c.F({ arms: 'hugL' }); c.react('lean') }]],
      hit: ARRIVE + 450, end: ARRIVE + 2300,
    }),
  },
  share: {
    say: 'detektiv/hilfe-teilen', label: 'Teilen',
    play: (c, k, ok) => {
      const item = ok ? k.gift : '🍪'
      return {
        steps: [...enter(c, { dx: -128, hold: item }),
          [ARRIVE + 100, () => { c.H({ hold: null, arms: 'holdR' }); c.gift({ item, from: [-78, 70], to: [40, 96] }); c.sfx('whoosh') }],
          [ARRIVE + 620, () => { if (ok) c.gift(null) }],
          ...(ok ? [[ARRIVE + 700, () => c.H({ feel: 'happy', arms: undefined })]] : [
            [ARRIVE + 1300, () => c.gift({ item, from: [40, 96], to: [-78, 70] })],
            [ARRIVE + 1800, () => { c.gift(null); c.H({ hold: item, arms: undefined }) }],
            ...retreat(c, ARRIVE + 1900)]),
        ],
        hit: ARRIVE + 640, end: ok ? ARRIVE + 2500 : ARRIVE + 3500,
      }
    },
  },
  rebuild: {
    say: 'detektiv/hilfe-bauen', label: 'Zusammen neu bauen',
    play: (c) => ({
      // Lumi stands behind the tower, so it stays in view where the stage is narrow
      steps: [...enter(c, { dx: 186, side: 'r' }), [0, () => c.H({ back: true })],
        [ARRIVE, () => { c.H({ arms: 'work' }); c.F({ arms: 'work', feel: 'content', strength: 1, tint: 1 }); c.P('fixed') }],
        ...[0, 1, 2, 3, 4].map(i => [ARRIVE + 250 + i * 320, () => c.sfx('pop')]),
        [ARRIVE + 1900, () => c.H({ arms: undefined, feel: 'happy' })],
      ],
      hit: ARRIVE + 1900, end: ARRIVE + 3700,
    }),
  },
  light: {
    say: 'detektiv/hilfe-licht', label: 'Das Licht anmachen',
    play: (c, k, ok) => (k.lamp != null
      ? { steps: [...enter(c, { dx: k.lamp - 22 }), [ARRIVE, () => c.H({ arms: 'wag', hop: 1 })], [ARRIVE + 260, () => c.sfx('flip')], [ARRIVE + 500, () => c.H({ arms: undefined, feel: 'happy' })]],
          hit: ARRIVE + 280, end: ARRIVE + 2200 }
      : { steps: [...enter(c, { dx: -125, hold: '💡' }), [ARRIVE, () => { c.H({ hop: 1 }); c.sfx('sparkle') }], ...(ok ? [] : retreat(c, ARRIVE + 1500))],
          hit: ARRIVE + 600, end: ARRIVE + 3100 }),
  },
  play: {
    say: 'detektiv/hilfe-spielen', label: 'Zusammen spielen',
    play: (c, k, ok) => {
      const there = { item: '⚽', from: [-96, 8], to: [-30, 8], low: true }, back = { item: '⚽', from: [-30, 8], to: [-96, 8], low: true }
      return {
        steps: [...enter(c, { dx: -150, hold: '⚽' }),
          [ARRIVE + 100, () => { c.H({ hold: null, arms: undefined }); c.gift(there); c.sfx('boing') }],
          ...(ok ? [
            [ARRIVE + 550, () => { c.gift(back); c.react('hop') }],
            [ARRIVE + 1000, () => { c.gift(there); c.H({ hop: 1, feel: 'happy' }); c.sfx('boing') }],
            [ARRIVE + 1450, () => { c.gift(back); c.react('hop') }],
            [ARRIVE + 1900, () => { c.gift(there); c.H({ hop: 2 }); c.sfx('boing') }],
          ] : [
            [ARRIVE + 1200, () => c.gift(back)],
            [ARRIVE + 1700, () => { c.gift(null); c.H({ hold: '⚽' }) }],
            ...retreat(c, ARRIVE + 1800),
          ]),
        ],
        hit: ARRIVE + 560, end: ok ? ARRIVE + 3200 : ARRIVE + 3400,
      }
    },
  },
  cheer: {
    say: 'detektiv/hilfe-mitfreuen', label: 'Mitfreuen',
    play: (c, k, ok) => ({
      steps: [...enter(c, { dx: -128 }), [ARRIVE, () => { c.H({ feel: 'happy' }); c.sfx('slideUp'); if (ok) c.burst('confetti', 18) }], ...(ok ? [] : retreat(c, ARRIVE + 1500))],
      hit: ARRIVE + 450, end: ok ? ARRIVE + 2300 : ARRIVE + 3100,
    }),
  },
  clap: {
    say: 'detektiv/hilfe-klatschen', label: 'Klatschen',
    play: (c, k, ok) => ({
      steps: [...enter(c, { dx: -128 }), [ARRIVE, () => c.H({ feel: 'happy', arms: 'clap' })],
        ...[0, 1, 2, 3, 4].map(i => [ARRIVE + 60 + i * 300, () => c.sfx('drum', true)]),
        ...(ok ? [[ARRIVE + 1600, () => c.H({ arms: undefined })]] : retreat(c, ARRIVE + 1600))],
      hit: ARRIVE + 650, end: ok ? ARRIVE + 2500 : ARRIVE + 3200,
    }),
  },
  blanket: {
    say: 'detektiv/hilfe-zudecken', label: 'Zudecken',
    play: (c, k, ok) => ({
      steps: [...enter(c, { dx: -128, hold: 'blanket' }),
        [ARRIVE + 100, () => { c.H({ hold: null, arms: 'holdR' }); c.gift({ item: 'blanket', from: [-78, 70], to: [0, 30] }); c.sfx('whoosh') }],
        ...(ok ? [[ARRIVE + 620, () => { c.gift(null); c.H({ feel: 'calm', arms: undefined }) }]] : [
          [ARRIVE + 1300, () => c.gift({ item: 'blanket', from: [0, 30], to: [-78, 70] })],
          [ARRIVE + 1800, () => { c.gift(null); c.H({ hold: 'blanket', arms: undefined }) }],
          ...retreat(c, ARRIVE + 1900)]),
      ],
      hit: ARRIVE + 640, end: ok ? ARRIVE + 2700 : ARRIVE + 3500,
    }),
  },
  look: {
    say: 'detektiv/hilfe-nachschauen', label: 'Zusammen nachschauen',
    play: (c, k, ok) => ({
      steps: [...enter(c, { dx: -118, hold: '🔍' }), [ARRIVE, () => { c.H({ hop: 1 }); if (ok) { c.P('fixed'); c.react('lean') } }],
        ...(ok ? [[ARRIVE + 1100, () => { c.sfx('pop'); c.H({ feel: 'happy' }) }]] : retreat(c, ARRIVE + 1500))],
      hit: ok ? ARRIVE + 1250 : ARRIVE + 700, end: ok ? ARRIVE + 3000 : ARRIVE + 3100,
    }),
  },
  wipe: {
    say: 'detektiv/hilfe-aufwischen', label: 'Zusammen aufwischen',
    play: (c) => ({
      steps: [...enter(c, { dx: 172, side: 'r', hold: '🧽' }),
        [ARRIVE, () => { c.H({ arms: 'work' }); c.F({ arms: 'work', feel: 'content', strength: 1, tint: 1 }); c.P('fixed'); c.sfx('whoosh') }],
        [ARRIVE + 600, () => c.sfx('whoosh')], [ARRIVE + 1200, () => c.sfx('sparkle')],
        [ARRIVE + 1700, () => c.H({ arms: undefined, feel: 'happy' })],
      ],
      hit: ARRIVE + 1700, end: ARRIVE + 3500,
    }),
  },

  // the unkind ones: they play out too, and the friend feels worse
  laugh: {
    say: 'detektiv/hilfe-auslachen', label: 'Auslachen', mean: true,
    play: (c) => ({
      steps: [...enter(c, { dx: -138 }), [ARRIVE, () => { c.H({ feel: 'laugh', extra: 'haha' }); c.sfx('giggle') }], [ARRIVE + 450, () => c.sfx('giggle')], ...retreat(c, ARRIVE + 1700)],
      hit: ARRIVE + 700, end: ARRIVE + 3300,
    }),
  },
  leave: {
    say: 'detektiv/hilfe-weggehen', label: 'Weggehen', mean: true,
    play: (c) => ({
      steps: [...enter(c, { dx: -150 }),
        [ARRIVE, () => c.H({ feel: 'away' })],
        [ARRIVE + 450, () => { c.H({ flip: true, dx: -OFF, walk: true, slow: true, extra: 'bye' }); c.react('reach'); c.sfx('step') }],
        [ARRIVE + 800, () => c.sfx('step')], [ARRIVE + 1150, () => c.sfx('step')],
        [ARRIVE + 2000, () => c.H({ on: false, walk: false, slow: false, extra: null })],
      ],
      hit: ARRIVE + 1500, end: ARRIVE + 2900,
    }),
  },
  scold: {
    say: 'detektiv/hilfe-schimpfen', label: 'Schimpfen', mean: true,
    play: (c) => ({
      steps: [...enter(c, { dx: -134 }), [ARRIVE, () => { c.H({ feel: 'scold', extra: 'zig' }); c.sfx('bump') }], [ARRIVE + 300, () => c.sfx('bump')], [ARRIVE + 600, () => c.sfx('bump')], ...retreat(c, ARRIVE + 1700)],
      hit: ARRIVE + 700, end: ARRIVE + 3300,
    }),
  },
}

// ── The pictures on the cards ─────────────────────────────────────────────
// Lumi doing it, drawn the way it then happens on the stage.

const Lumi = ({ s, ...p }) => <Pal kind="lumi" hat still size={s} {...p} />

/** The picture of a card, in a box of `size`. `k` is the case (who, and what is shared). */
export function CardArt({ id, k, size = 110 }) {
  const u = size / 110
  const box = { position: 'relative', width: size, height: size, flexShrink: 0 }
  const at = (left, bottom, node, extra) => <div style={{ position: 'absolute', left: left * u, bottom: bottom * u, ...extra }}>{node}</div>
  const lumi = (left, p, s = 70) => at(left, 4, <Lumi s={s * u} {...p} />)
  switch (id) {
    case 'hug': return (
      <div style={box}>
        {at(48, 4, <Pal kind={k.kind} feel="calm" arms="hugL" still size={62 * u} />)}
        {lumi(2, { feel: 'calm', arms: 'hugR' }, 60)}
        {at(40, 76, <Art art="❤" size={30 * u} />)}
      </div>
    )
    case 'share': {
      const item = k.good.includes('share') ? k.gift : '🍪'
      return (
        <div style={box}>
          {lumi(0, { feel: 'kind', arms: 'holdR' }, 64)}
          {at(58, 34, <div style={{ transform: `scale(${u})`, transformOrigin: '0 100%' }}>{holdNode(item)}</div>)}
          <svg viewBox="0 0 110 110" width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
            <path d="M52 22 Q78 4 98 26" stroke="#2f8f3a" strokeWidth="6" fill="none" strokeLinecap="round" /><path d="M88 12 L100 28 L82 30" stroke="#2f8f3a" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )
    }
    case 'rebuild': return (
      <div style={box}>
        {lumi(0, { feel: 'kind', arms: 'work' }, 62)}
        {[0, 1, 2].map(i => <div key={i} style={{ position: 'absolute', left: 66 * u, bottom: (6 + i * 26) * u, width: 30 * u, height: 26 * u, boxSizing: 'border-box', borderRadius: 6 * u, border: `${3 * u}px solid ${OUT}`, background: ['#ff6b5b', '#ffc93c', '#4aa3ff'][i] }} />)}
        {at(46, 78, <div style={{ width: 28 * u, height: 24 * u, boxSizing: 'border-box', borderRadius: 6 * u, border: `${3 * u}px solid ${OUT}`, background: '#5cc45a', transform: 'rotate(-18deg)' }} />)}
      </div>
    )
    case 'light': return (
      <div style={box}>
        <div style={{ position: 'absolute', inset: `${6 * u}px ${12 * u}px ${24 * u}px`, borderRadius: '50%', background: 'radial-gradient(circle, #fff3a0 30%, rgba(255,243,160,0) 70%)' }} />
        <svg viewBox="0 0 110 110" width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
          {[-70, -35, 0, 35, 70].map(a => <path key={a} d="M55 4 V16" stroke="#ffb200" strokeWidth="6" strokeLinecap="round" transform={`rotate(${a} 55 52)`} />)}
        </svg>
        {at(21, 12, <Art art="💡" size={68 * u} />)}
      </div>
    )
    case 'play': return (
      <div style={box}>
        {lumi(0, { feel: 'happy' }, 62)}
        {at(64, 30, <Art art="⚽" size={40 * u} />)}
        <svg viewBox="0 0 110 110" width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
          <path d="M70 100 q14 -8 28 0 M62 26 q8 -8 16 -8" stroke={OUT} strokeWidth="4" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    )
    case 'cheer': return <div style={box}>{at(52, 30, <Art art="🎉" size={56 * u} />)}{lumi(2, { feel: 'happy' }, 70)}</div>
    case 'clap': return <div style={box}>{lumi(0, { feel: 'happy', arms: 'clap' }, 58)}{at(46, 22, <Art art="👏" size={64 * u} />)}</div>
    case 'blanket': return <div style={box}>{lumi(0, { feel: 'kind', arms: 'holdR' }, 64)}{at(52, 30, <Blanket w={56 * u} />)}</div>
    case 'look': return <div style={box}>{lumi(0, { feel: 'curious', arms: 'holdR' }, 66)}{at(52, 36, <Art art="🔍" size={56 * u} />)}</div>
    case 'wipe': return (
      <div style={box}>
        {lumi(0, { feel: 'kind', arms: 'work' }, 64)}
        {at(48, 2, <div style={{ width: 60 * u, height: 16 * u, boxSizing: 'border-box', borderRadius: '50%', background: '#ffb347', border: `${3 * u}px solid ${OUT}` }} />)}
        {at(56, 14, <Art art="🧽" size={46 * u} />)}
      </div>
    )
    case 'laugh': return (
      <div style={box}>
        {lumi(0, { feel: 'laugh' }, 70)}
        <Haha u={u} style={{ position: 'absolute', right: 2 * u, top: 4 * u }} />
      </div>
    )
    case 'leave': return (
      <div style={box}>
        {lumi(4, { feel: 'away', flip: true }, 66)}
        {at(70, 40, <Art art="👋" size={38 * u} />)}
        <svg viewBox="0 0 110 110" width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
          <path d="M78 96 H104 M82 84 H100 M84 72 H98" stroke={OUT} strokeWidth="5" strokeLinecap="round" />
          <path d="M40 18 H10 M22 6 L8 18 L22 30" stroke="#c2412d" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
    case 'scold': return (
      <div style={box}>
        {lumi(0, { feel: 'scold' }, 68)}
        <Zig u={u} style={{ position: 'absolute', right: 0, top: 2 * u }} />
      </div>
    )
    default: return <div style={box} />
  }
}

/** "Ha ha!": the laughing-at, as a picture */
export function Haha({ u = 1, style }) {
  return (
    <svg viewBox="0 0 60 60" width={56 * u} height={56 * u} style={style} aria-hidden="true">
      <g fontFamily="var(--font-heading)" fontWeight="700" fill="#ffc93c" stroke={OUT} strokeWidth="1.6" paintOrder="stroke">
        <text x="2" y="24" fontSize="24" transform="rotate(-12 20 20)">HA</text>
        <text x="20" y="52" fontSize="24" transform="rotate(8 40 44)">HA</text>
      </g>
    </svg>
  )
}

/** Angry words: a jagged bubble with a scribble in it */
export function Zig({ u = 1, style }) {
  return (
    <svg viewBox="0 0 60 60" width={54 * u} height={54 * u} style={style} aria-hidden="true">
      <path d="M30 2 L37 11 L49 7 L48 19 L59 24 L50 32 L55 44 L42 44 L36 56 L28 46 L14 52 L16 39 L3 34 L12 25 L6 13 L20 14 Z" fill="#ff6b5b" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <path d="M17 26 L24 34 L30 24 L37 34 L44 25" stroke="#fff" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
