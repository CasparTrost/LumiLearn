import './gefuehle.css'

/**
 * The faces of the Gefühle-Haus: ten feelings, each drawn two ways, on ten
 * different heads (bear, rabbit, cat, mouse, pig, dog, fox, lion, koala and
 * a little monster) and on the plain round face of Lumi's sign. The sign's
 * faces are also the feeling chips of Gefühlsdetektiv (with Neugierig, which
 * only that game asks), so one feeling has one face in both games.
 *
 * The game is about reading an expression, not about finding the same
 * picture twice. So the feeling is in what a face does (brows, eyes, mouth,
 * tears, a blush), and the head around it changes from window to window.
 * Everything is drawn bold: at a phone's window size a face is about 75 px
 * wide, and a brow must still read as angry or sad.
 *
 * The features live in a 100 × 100 box (eyes at y 48, mouth at y 76); the
 * heads are drawn around that box.
 */
const INK = '#3d2314'
const DARK = '#5a1c22'      // the inside of an open mouth
const TONGUE = '#ff7d8e'
const TEAR = '#58b4ff'

export const slug = w => String(w).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')

// What each feeling's face is made of; the first is the one on the sign.
const LOOKS = {
  'Glücklich': [
    { eyes: 'arc', mouth: 'grin', cheeks: true },
    { eyes: 'dot', brows: 'soft', mouth: 'smile', cheeks: true },
  ],
  'Traurig': [
    { eyes: 'down', brows: 'sad', mouth: 'frown', tear: true },
    { eyes: 'cry', brows: 'sad', mouth: 'wail', streams: true },
  ],
  'Wütend': [
    { eyes: 'glare', brows: 'angry', mouth: 'grit', flush: true, steam: true },
    { eyes: 'glare', brows: 'angry', mouth: 'shout', flush: true, steam: true },
  ],
  'Ängstlich': [
    { eyes: 'tiny', brows: 'worried', mouth: 'wobble', sweat: 1, chill: true },
    { eyes: 'tiny', brows: 'worried', mouth: 'chatter', sweat: 2, chill: true },
  ],
  'Überrascht': [
    { eyes: 'wide', brows: 'high', mouth: 'O', pop: true },
    { eyes: 'wide', brows: 'high', mouth: 'gasp', pop: true },
  ],
  // tired in the face itself, not only by the floating Zz (it can be out of
  // sight): heavy lids and a big yawn in both
  'Müde': [
    { eyes: 'half', brows: 'flat', mouth: 'yawn', zzz: true },
    { eyes: 'heavy', brows: 'droop', mouth: 'gape', yawnTear: true, zzz: true },
  ],
  'Stolz': [
    { eyes: 'lid', brows: 'soft', mouth: 'smug', cheeks: true, medal: true, sparkle: 1 },
    { eyes: 'wink', brows: 'soft', mouth: 'smug', cheeks: true, medal: true, sparkle: 1 },
  ],
  'Verlegen': [
    // not the round white eyes and the wavy mouth of 'Ängstlich': dark eyes
    // that look down and away, and a small crooked smile under a big blush
    { eyes: 'shy', look: [-5, 3], brows: 'worried', mouth: 'sheepish', blush: true, paws: 'chin' },
    { eyes: 'shy', look: [5, 3], brows: 'worried', mouth: 'sheepish', blush: true, paws: 'cheek' },
  ],
  'Gelangweilt': [
    { eyes: 'half', look: [4, 0], brows: 'low', mouth: 'flat', paws: 'prop' },
    { eyes: 'half', look: [-4, 0], brows: 'low', mouth: 'pout', paws: 'prop' },
  ],
  'Aufgeregt': [
    { eyes: 'star', brows: 'high', mouth: 'biggrin', cheeks: true, sparkle: 2 },
    { eyes: 'star', brows: 'soft', mouth: 'grin', cheeks: true, sparkle: 2 },
  ],
  // Only on the chips of Gefühlsdetektiv, where a story goes with it; the
  // house leaves it out (gefuehle/rounds.js): one brow up, eyes to the side,
  // a little "o", and a question mark
  'Neugierig': [
    { eyes: 'side', look: [5, -2], brows: 'quizzical', mouth: 'o', question: true },
  ],
}

const stroke = (w = 5) => ({ fill: 'none', stroke: INK, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' })

function Eye({ kind, cx, cy = 48, look = [0, 0], right }) {
  const [lx, ly] = look
  switch (kind) {
    case 'arc':  return <path d={`M${cx - 10} ${cy + 4} Q${cx} ${cy - 11} ${cx + 10} ${cy + 4}`} {...stroke(5.5)} />
    case 'lid':  return <path d={`M${cx - 10} ${cy - 2} Q${cx} ${cy + 9} ${cx + 10} ${cy - 2}`} {...stroke(5.5)} />
    case 'cry':  return <path d={`M${cx - 10} ${cy + 1} Q${cx} ${cy + 9} ${cx + 10} ${cy + 1}`} {...stroke(5.5)} />
    case 'shut': return <path d={`M${cx - 10} ${cy + 3} L${cx + 10} ${cy + 3}`} {...stroke(5.5)} />
    case 'wink': return right
      ? <path d={`M${cx - 10} ${cy + 4} Q${cx} ${cy - 11} ${cx + 10} ${cy + 4}`} {...stroke(5.5)} />
      : <g><ellipse cx={cx} cy={cy} rx="8" ry="9.5" fill={INK} /><circle cx={cx - 3} cy={cy - 3.5} r="3" fill="#fff" /></g>
    case 'glare': {
      // a dark eye with its top cut off slanted, under the angry brow
      const d = right ? -1 : 1
      return <path d={`M${cx - 9} ${cy - 2 - 3 * d} L${cx + 9} ${cy - 2 + 3 * d} L${cx + 9} ${cy + 3} A9 8 0 0 1 ${cx - 9} ${cy + 3} Z`} fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    }
    case 'tiny': return <g><circle cx={cx} cy={cy} r="11.5" fill="#fff" stroke={INK} strokeWidth="3" /><circle cx={cx} cy={cy + 1} r="3.6" fill={INK} /></g>
    case 'wide': return <g><circle cx={cx} cy={cy} r="11.5" fill="#fff" stroke={INK} strokeWidth="3" /><circle cx={cx} cy={cy} r="6.5" fill={INK} /><circle cx={cx - 2.5} cy={cy - 2.5} r="2.4" fill="#fff" /></g>
    case 'shy': // dark, turned down and to the side, under a lowered lid
      return (
        <g>
          <ellipse cx={cx + lx} cy={cy + ly + 1} rx="7" ry="8" fill={INK} />
          <circle cx={cx + lx * 1.5} cy={cy + ly + 3.5} r="2.4" fill="#fff" />
        </g>
      )
    case 'heavy': return (
      // nearly shut: a thick lid over a sliver of eye, and a bag below
      <g>
        <path d={`M${cx - 11} ${cy + 2} A11 8 0 0 0 ${cx + 11} ${cy + 2} Z`} fill="#fff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <circle cx={cx} cy={cy + 6} r="3.6" fill={INK} />
        <path d={`M${cx - 12.5} ${cy + 2} Q${cx} ${cy + 5} ${cx + 12.5} ${cy + 2}`} {...stroke(6.5)} />
        <path d={`M${cx - 8} ${cy + 15} Q${cx} ${cy + 19} ${cx + 8} ${cy + 15}`} {...stroke(2.6)} opacity="0.55" />
      </g>
    )
    case 'side': return <g><circle cx={cx} cy={cy} r="11" fill="#fff" stroke={INK} strokeWidth="3" /><circle cx={cx + lx} cy={cy + ly} r="5.5" fill={INK} /><circle cx={cx + lx - 2} cy={cy + ly - 2} r="1.8" fill="#fff" /></g>
    case 'half': return (
      <g>
        <path d={`M${cx - 11} ${cy} A11 10 0 0 0 ${cx + 11} ${cy} Z`} fill="#fff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <circle cx={cx + lx} cy={cy + 4} r="4.2" fill={INK} />
        <path d={`M${cx - 12.5} ${cy} L${cx + 12.5} ${cy}`} {...stroke(6)} />
      </g>
    )
    case 'star': {
      const p = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 ? 5 : 12.5, a = -Math.PI / 2 + (i * Math.PI) / 5
        return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
      }).join(' L')
      return <path d={`M${p} Z`} fill="#ffb300" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
    }
    case 'down': // open, looking down, wet
      return <g><ellipse cx={cx} cy={cy + 2} rx="8" ry="9" fill={INK} /><circle cx={cx - 3} cy={cy - 1} r="3.4" fill="#fff" /><circle cx={cx + 3} cy={cy + 5} r="1.8" fill="#fff" /></g>
    default:
      return <g><ellipse cx={cx} cy={cy} rx="8" ry="9.5" fill={INK} /><circle cx={cx - 3} cy={cy - 3.5} r="3" fill="#fff" /></g>
  }
}

// The left brow; the right one is its mirror image
const BROWS = {
  soft:    ['M20 33 Q30 26 40 32', 4.5],
  sad:     ['M19 39 L41 29', 5.5],
  angry:   ['M18 27 L43 39', 7],
  worried: ['M19 35 Q28 24 41 27', 5],
  high:    ['M19 28 Q30 17 41 27', 5],
  flat:    ['M19 33 L41 34', 5],
  low:     ['M18 36 L42 37', 5.5],
  droop:   ['M19 37 Q30 32 41 35', 5],
}

function Brows({ kind }) {
  // curious: the left brow level, the right one raised
  if (kind === 'quizzical') return <g><path d="M19 33 Q30 30 41 33" {...stroke(5)} /><path d="M59 26 Q70 13 82 22" {...stroke(5)} /></g>
  const b = BROWS[kind]
  if (!b) return null
  return <g><path d={b[0]} {...stroke(b[1])} /><path d={b[0]} {...stroke(b[1])} transform="translate(100 0) scale(-1 1)" /></g>
}

function Mouth({ kind }) {
  switch (kind) {
    case 'smile':  return <path d="M33 72 Q50 90 67 72" {...stroke(5.5)} />
    case 'grin':   return <g><path d="M33 70 Q50 98 67 70 Z" fill={DARK} stroke={INK} strokeWidth="4" strokeLinejoin="round" /><ellipse cx="50" cy="84" rx="8" ry="4.5" fill={TONGUE} /></g>
    case 'biggrin': return (
      <g>
        <path d="M29 68 Q50 104 71 68 Z" fill={DARK} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path d="M33.5 70 L66.5 70 L63 77 L37 77 Z" fill="#fff" />
        <ellipse cx="50" cy="88" rx="9" ry="5" fill={TONGUE} />
      </g>
    )
    case 'frown':  return <path d="M35 84 Q50 68 65 84" {...stroke(5.5)} />
    case 'wail':   return <path d="M35 86 Q50 62 65 86 Q50 80 35 86 Z" fill={DARK} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    case 'grit':   return <g><rect x="33" y="69" width="34" height="15" rx="6" fill="#fff" stroke={INK} strokeWidth="4" /><path d="M44 70 V83 M56 70 V83 M34 76.5 H66" stroke={INK} strokeWidth="2.6" /></g>
    case 'shout':  return <g><path d="M34 86 L39 70 Q50 65 61 70 L66 86 Z" fill={DARK} stroke={INK} strokeWidth="4" strokeLinejoin="round" /><path d="M40.5 70.5 Q50 67 59.5 70.5 L58.5 75 L41.5 75 Z" fill="#fff" /></g>
    case 'wobble': return <path d="M32 78 q4.5 -7 9 0 q4.5 7 9 0 q4.5 -7 9 0 q4.5 7 9 0" {...stroke(5)} />
    case 'chatter': return <g><rect x="34" y="69" width="32" height="15" rx="5" fill="#fff" stroke={INK} strokeWidth="4" /><path d="M35 77 l5 -4 l5 4 l5 -4 l5 4 l5 -4 l5 4" fill="none" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" /></g>
    case 'O':      return <ellipse cx="50" cy="79" rx="10" ry="12" fill={DARK} stroke={INK} strokeWidth="4" />
    case 'gasp':   return <g><ellipse cx="50" cy="79" rx="13" ry="11" fill={DARK} stroke={INK} strokeWidth="4" /><ellipse cx="50" cy="85" rx="7" ry="3.5" fill={TONGUE} /></g>
    case 'o':      return <ellipse cx="50" cy="78" rx="6" ry="7" fill={DARK} stroke={INK} strokeWidth="3.5" />
    case 'gape':   return <g><ellipse cx="50" cy="80" rx="10" ry="15" fill={DARK} stroke={INK} strokeWidth="4" /><ellipse cx="50" cy="89" rx="6" ry="4" fill={TONGUE} /></g>
    case 'yawn':   return <g><ellipse cx="50" cy="79" rx="12" ry="13.5" fill={DARK} stroke={INK} strokeWidth="4" /><ellipse cx="50" cy="87" rx="7" ry="4" fill={TONGUE} /></g>
    case 'flat':   return <path d="M36 79 L64 77" {...stroke(5.5)} />
    case 'pout':   return <path d="M38 81 Q50 73 62 81" {...stroke(5.5)} />
    case 'smug':   return <path d="M34 73 Q49 86 67 69" {...stroke(5.5)} />
    case 'sheepish': return <path d="M40 76 Q47 83 60 74" {...stroke(5)} />
    default:       return <path d="M42 77 Q50 82 58 77" {...stroke(5)} />
  }
}

function Sparkle({ x, y, r = 8, delay = 0 }) {
  const k = r * 0.28
  return (
    <path className="gf-twinkle" style={{ animationDelay: `${delay}s` }}
      d={`M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`}
      fill="#ffcf3a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
  )
}

const Drop = ({ x, y, s = 1, ...rest }) => (
  <path d={`M${x} ${y} q${-5.5 * s} ${9 * s} 0 ${13 * s} q${5.5 * s} ${-4 * s} 0 ${-13 * s} Z`} fill={TEAR} stroke={INK} strokeWidth="2" strokeLinejoin="round" {...rest} />
)

/** Behind the eyes and the mouth: a red forehead, a blush, cheeks. */
function Under({ L }) {
  return (
    <>
      {L.flush && <ellipse cx="50" cy="26" rx="27" ry="11" fill="#ff3d2e" opacity="0.38" />}
      {L.chill && (
        <g>
          <ellipse cx="50" cy="25" rx="27" ry="11" fill="#5c9dff" opacity="0.4" />
          <path d="M60 14 V25 M67 16 V27 M74 20 V29" stroke="#3567c9" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      )}
      {L.cheeks && <g fill="#ff8aa2" opacity="0.7"><ellipse cx="17" cy="66" rx="8.5" ry="6" /><ellipse cx="83" cy="66" rx="8.5" ry="6" /></g>}
      {L.blush && (
        <g>
          <g fill="#ff5d7a" opacity="0.8"><ellipse cx="19" cy="65" rx="14" ry="9" /><ellipse cx="81" cy="65" rx="14" ry="9" /></g>
          <path d="M11 68 l5 -7 M17 69 l5 -7 M23 69 l5 -7 M72 69 l5 -7 M78 69 l5 -7 M84 68 l5 -7" stroke="#d92f55" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )}
    </>
  )
}

/** On top of the face and around the head: tears, steam, Zzz, a medal, paws. */
function Over({ L, fur }) {
  const paw = { fill: fur, stroke: INK, strokeWidth: 3.2 }
  return (
    <>
      {L.tear && <Drop x={29} y={59} s={1.15} className="gf-tear" />}
      {L.streams && (
        <g fill={TEAR} stroke={INK} strokeWidth="2">
          <path className="gf-stream" d="M24.5 54 h9 v26 a4.5 4.5 0 0 1 -9 0 Z" />
          <path className="gf-stream" style={{ animationDelay: '.4s' }} d="M66.5 54 h9 v26 a4.5 4.5 0 0 1 -9 0 Z" />
        </g>
      )}
      {L.steam && (
        <g fill="#fff" stroke={INK} strokeWidth="2.4">
          {[[-2, 10], [84, 6]].map(([x, y], i) => (
            <g key={i} className="gf-steam" style={{ animationDelay: `${i * 0.35}s` }}>
              <circle cx={x + 2} cy={y + 5} r="6" /><circle cx={x + 10} cy={y} r="7.5" /><circle cx={x + 17} cy={y + 6} r="5.5" />
            </g>
          ))}
        </g>
      )}
      {L.yawnTear && <Drop x={84} y={52} s={0.8} />}
      {L.question && (
        <text x="80" y="22" fontSize="34" fontFamily="var(--font-heading)" fontWeight="700" fill="#6b3fd6" stroke="#fff" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">?</text>
      )}
      {L.sweat >= 1 && <Drop x={90} y={22} />}
      {L.sweat >= 2 && <Drop x={9} y={30} s={0.85} />}
      {L.pop && (
        <g className="gf-twinkle" strokeLinecap="round">
          <path d="M80 3 L84 -9 M91 9 L100 0 M96 20 L107 17" stroke={INK} strokeWidth="8" />
          <path d="M80 3 L84 -9 M91 9 L100 0 M96 20 L107 17" stroke="#ffb300" strokeWidth="4.5" />
        </g>
      )}
      {L.zzz && (
        <g className="gf-zzz" fontFamily="var(--font-heading)" fontWeight="700" fill="#3f86f0" stroke="#fff" strokeWidth="3.5" paintOrder="stroke" strokeLinejoin="round">
          <text x="72" y="16" fontSize="25">Z</text><text x="91" y="2" fontSize="17">z</text>
        </g>
      )}
      {L.sparkle >= 1 && <Sparkle x={93} y={8} r={9} />}
      {L.sparkle >= 2 && <><Sparkle x={6} y={14} r={7} delay={0.4} /><Sparkle x={101} y={34} r={5.5} delay={0.8} /></>}
      {L.medal && (
        <g>
          <path d="M41 88 L50 102 L59 88" fill="none" stroke="#3f7fe0" strokeWidth="6" strokeLinejoin="round" />
          <circle cx="50" cy="103" r="10" fill="#ffc93c" stroke={INK} strokeWidth="3" />
          <path d="M50 96.5 l2 4.2 4.6 .6 -3.4 3.1 .9 4.5 -4.1 -2.2 -4.1 2.2 .9 -4.5 -3.4 -3.1 4.6 -.6 z" fill="#fff6c8" />
        </g>
      )}
      {L.paws === 'chin' && <g><ellipse cx="33" cy="92" rx="11" ry="9" {...paw} /><ellipse cx="67" cy="92" rx="11" ry="9" {...paw} /></g>}
      {L.paws === 'cheek' && <ellipse cx="80" cy="82" rx="10" ry="12" transform="rotate(-20 80 82)" {...paw} />}
      {L.paws === 'prop' && <ellipse cx="85" cy="80" rx="10" ry="14" transform="rotate(-24 85 80)" {...paw} />}
    </>
  )
}

function Features({ feeling, variant = 0, fur }) {
  const L = (LOOKS[feeling] ?? LOOKS['Glücklich'])[variant] ?? LOOKS[feeling][0]
  return (
    <g>
      <Under L={L} />
      <Brows kind={L.brows} />
      <Eye kind={L.eyes} cx={30} look={L.look} />
      <Eye kind={L.eyes} cx={70} look={L.look} right />
      <Mouth kind={L.mouth} />
      <Over L={L} fur={fur} />
    </g>
  )
}

// ── Heads ─────────────────────────────────────────────────────────────────

const line = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }
const both = draw => <>{draw()}<g transform="translate(100 0) scale(-1 1)">{draw()}</g></>
const HEADS = {
  round:  <ellipse cx="50" cy="54" rx="46" ry="44" />,
  wide:   <ellipse cx="50" cy="56" rx="48" ry="42" />,
  tall:   <ellipse cx="50" cy="54" rx="43" ry="45" />,
  square: <rect x="5" y="11" width="90" height="87" rx="30" />,
  small:  <ellipse cx="50" cy="55" rx="42" ry="41" />,
}
const nose = (fill, y = 60) => <path d={`M44 ${y - 3} Q50 ${y - 5} 56 ${y - 3} Q54 ${y + 4} 50 ${y + 4} Q46 ${y + 4} 44 ${y - 3} Z`} fill={fill} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
const whiskers = both(() => <path d="M10 66 L-6 62 M10 72 L-6 75" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />)

/** The ten who live in the house. `name` is what a screen reader says. */
export const CAST = [
  { name: 'Bär', fur: '#dba468', head: 'round',
    back: f => both(() => <g><circle cx="15" cy="16" r="14" fill={f} {...line} /><circle cx="15" cy="16" r="7" fill="#f6d9ae" /></g>),
    front: () => <><ellipse cx="50" cy="74" rx="25" ry="20" fill="#f8e2bf" />{nose(INK)}</> },
  { name: 'Hase', fur: '#f4eff8', head: 'tall',
    back: f => both(() => <g transform="rotate(-12 30 20)"><ellipse cx="30" cy="6" rx="11" ry="21" fill={f} {...line} /><ellipse cx="30" cy="8" rx="5" ry="13" fill="#ffb7c8" /></g>),
    front: () => nose('#ff8fa8') },
  { name: 'Katze', fur: '#fbb655', head: 'wide',
    back: f => both(() => <g><path d="M7 36 L11 -8 L42 16 Z" fill={f} {...line} /><path d="M14 24 L16 3 L31 15 Z" fill="#ffc7d2" /></g>),
    front: () => <><path d="M43 14 V23 M50 12 V23 M57 14 V23" stroke="#e58e25" strokeWidth="4" strokeLinecap="round" />{whiskers}{nose('#ff8fa8')}</> },
  { name: 'Maus', fur: '#c9d1de', head: 'round',
    back: f => both(() => <g><circle cx="10" cy="14" r="20" fill={f} {...line} /><circle cx="10" cy="14" r="11.5" fill="#ffc4d1" /></g>),
    front: () => <>{whiskers}{nose('#ff8fa8')}</> },
  { name: 'Schwein', fur: '#ffc4cf', head: 'wide',
    back: f => both(() => <path d="M10 34 L6 -2 L38 14 Z" fill={f} {...line} />),
    front: () => <g><ellipse cx="50" cy="60" rx="11.5" ry="8" fill="#ff9db2" stroke={INK} strokeWidth="2.6" /><ellipse cx="45.5" cy="60" rx="2" ry="3.2" fill={INK} /><ellipse cx="54.5" cy="60" rx="2" ry="3.2" fill={INK} /></g> },
  { name: 'Hund', fur: '#f5dcb2', head: 'round',
    back: () => both(() => <ellipse cx="6" cy="42" rx="12" ry="27" transform="rotate(14 6 42)" fill="#b3723f" {...line} />),
    front: () => <><ellipse cx="50" cy="74" rx="23" ry="19" fill="#fffaf0" />{nose(INK)}</> },
  { name: 'Fuchs', fur: '#ff9f5b', head: 'wide',
    back: f => both(() => <g><path d="M5 36 L9 -12 L42 14 Z" fill={f} {...line} /><path d="M9 -12 L7.5 6 L20 -3 Z" fill={INK} /><path d="M13 26 L15 6 L30 16 Z" fill="#fff1dd" /></g>),
    front: () => <><ellipse cx="50" cy="75" rx="31" ry="20" fill="#fff4e3" />{nose(INK)}</> },
  { name: 'Löwe', fur: '#ffd684', head: 'small',
    back: f => <g>{Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2
      return <circle key={i} cx={50 + 44 * Math.cos(a)} cy={54 + 43 * Math.sin(a)} r="13" fill="#d17f2f" {...line} />
    })}<circle cx="50" cy="54" r="46" fill="#d17f2f" />{both(() => <circle cx="20" cy="19" r="9" fill={f} {...line} />)}</g>,
    front: () => nose('#9c532b') },
  { name: 'Koala', fur: '#c4ccd7', head: 'wide',
    back: f => both(() => <g><circle cx="7" cy="22" r="19" fill={f} {...line} /><circle cx="7" cy="22" r="10.5" fill="#eef2f6" /></g>),
    front: () => <ellipse cx="50" cy="60" rx="6.5" ry="7.5" fill="#4b4f5c" stroke={INK} strokeWidth="2" /> },
  { name: 'Monster', fur: '#86dcc8', head: 'square',
    back: () => both(() => <g><path d="M32 14 L26 -6" stroke={INK} strokeWidth="4" strokeLinecap="round" /><circle cx="25" cy="-8" r="6.5" fill="#ffcf4a" {...line} strokeWidth="3" /></g>),
    front: () => <g fill="#5fc4ad"><circle cx="16" cy="30" r="4" /><circle cx="86" cy="36" r="3" /><circle cx="24" cy="22" r="2.4" /></g> },
]

// The face on Lumi's sign: no animal, just the feeling
const PLAIN = { name: 'Gesicht', fur: '#ffd84d', head: 'round', back: () => null, front: () => null }

function Head({ who, feeling, variant, paws, wave }) {
  const fur = who.fur
  const paw = { fill: fur, stroke: INK, strokeWidth: 3.2 }
  return (
    <>
      {who.back(fur)}
      <g fill={fur} {...line}>{HEADS[who.head]}</g>
      <ellipse cx="29" cy="24" rx="9" ry="5" fill="#fff" opacity="0.55" transform="rotate(-28 29 24)" />
      {who.front(fur)}
      <Features feeling={feeling} variant={variant} fur={fur} />
      {/* paws on the window sill; one of them waves at the party */}
      {paws && <ellipse cx="19" cy="109" rx="12" ry="8" {...paw} />}
      {paws && !wave && <ellipse cx="81" cy="109" rx="12" ry="8" {...paw} />}
      {wave && <ellipse className="gf-wave" cx="100" cy="62" rx="9" ry="13" {...paw} />}
    </>
  )
}

/** How much taller than wide a friend is drawn (ears above, paws below). */
export const FRIEND_RATIO = 132 / 112

/**
 * One of the house's animals with a feeling on its face. `size` is the
 * width; the picture is a little taller (FRIEND_RATIO).
 */
export function Friend({ animal = 0, feeling, variant = 0, size = 100, wave = false, paws = true, still = false }) {
  const who = CAST[animal % CAST.length]
  return (
    <svg viewBox="-6 -16 112 132" width={size} height={size * FRIEND_RATIO} aria-hidden="true"
      className={still ? undefined : `gf-feel gf-feel-${slug(feeling)}`}
      style={{ display: 'block', overflow: 'visible', transformOrigin: '50% 85%' }}>
      <Head who={who} feeling={feeling} variant={variant} paws={paws} wave={wave} />
    </svg>
  )
}

/** The plain face of a feeling, as on Lumi's sign. */
export function SignFace({ feeling, size = 120 }) {
  // a face with a medal under its chin sits a little higher on the sign,
  // so the medal stays clear of the sign's frame
  const drop = LOOKS[feeling]?.[0].medal ? 7 : 0
  return (
    <svg viewBox={`-12 ${drop - 12} 124 124`} width={size} height={size} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <Head who={PLAIN} feeling={feeling} variant={0} />
    </svg>
  )
}
