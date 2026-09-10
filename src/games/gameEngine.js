// gameEngine.js — question generators for ChoiceGame (numbers + patterns)
// Every call uses fresh Math.random() so each game session is unique.

export function generateQuestions(moduleId, level, count = 10) {
  if (moduleId === 'numbers')  return Array.from({ length: count }, () => numbersQ(level))
  if (moduleId === 'patterns') return Array.from({ length: count }, () => patternsQ(level))
  return []
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function shuffle(arr)    { return [...arr].sort(() => Math.random() - 0.5) }
function uniqueWrong(correct, count, min, max) {
  const s = new Set()
  // Guard: can't produce more unique values than the range holds (minus the correct one)
  const available = Math.max(0, max - min)
  const need = Math.min(count, available)
  let tries = 0
  while (s.size < need && tries < 400) {
    const n = rand(min, max)
    if (n !== correct) s.add(n)
    tries++
  }
  return [...s].map(String)
}

const COUNT_EMOJIS = ['⭐','🍎','🐟','🦋','🌸','🍭','🎈','🐶','🌙','🦁','🍕','❤️','🌻','🎵','🦄','🐸','🍓','🐠','🍩','🎀']

// ─── Numbers ────────────────────────────────────────────────────────────────
function numbersQ(level) {
  // Question types available per level
  const types1 = ['count','count','add']
  const types2 = ['count','add','add','missing']
  const types3 = ['count','add','sub','missing','missing']
  const types4 = ['add','sub','sub','multiply','compare','missing_step']
  const types5 = ['add','sub','multiply','multiply','compare','missing_step','missing_step']

  const typePool = level <= 1 ? types1 : level <= 2 ? types2 : level <= 3 ? types3 : level <= 4 ? types4 : types5
  const type     = shuffle(typePool)[0]
  const maxN     = level <= 1 ? 5 : level <= 2 ? 10 : level <= 3 ? 20 : level <= 4 ? 50 : 100

  // ── Count ──
  if (type === 'count') {
    const n     = rand(1, Math.min(maxN, 15)) // visual limit
    const emoji = COUNT_EMOJIS[rand(0, COUNT_EMOJIS.length - 1)]
    const wrong = uniqueWrong(n, 3, Math.max(1, n - 3), n + 5)
    return {
      prompt:  `Wie viele ${emoji} siehst du?`,
      visual:  emoji.repeat(n),
      options: shuffle([String(n), ...wrong]),
      answer:  String(n),
    }
  }

  // ── Addition ──
  if (type === 'add') {
    const half = Math.max(2, Math.floor(maxN / 2))
    const a    = rand(1, half)
    const b    = rand(1, half)
    const ans  = a + b
    const wrong = uniqueWrong(ans, 3, Math.max(1, ans - 4), ans + 6)
    const showVisual = ans <= 12
    return {
      prompt:  `${a} + ${b} = ?`,
      visual:  showVisual ? ('⭐'.repeat(a) + '  +  ' + '⭐'.repeat(b)) : null,
      options: shuffle([String(ans), ...wrong]),
      answer:  String(ans),
    }
  }

  // ── Subtraction ──
  if (type === 'sub') {
    const b   = rand(1, Math.floor(maxN / 2))
    const ans = rand(0, Math.floor(maxN / 2))
    const a   = ans + b
    const wrong = uniqueWrong(ans, 3, Math.max(0, ans - 4), ans + 6)
    const showVisual = a <= 12
    return {
      prompt:  `${a} − ${b} = ?`,
      visual:  showVisual ? ('🍎'.repeat(a) + '\n−  ' + '🍎'.repeat(b)) : null,
      options: shuffle([String(ans), ...wrong]),
      answer:  String(ans),
    }
  }

  // ── Multiplication (simple: 2×, 5×, 10× tables) ──
  if (type === 'multiply') {
    const multiplier = shuffle([2, 5, 10])[0]
    const n   = rand(1, level <= 4 ? 5 : 10)
    const ans = multiplier * n
    const wrong = uniqueWrong(ans, 3, Math.max(0, ans - multiplier * 2), ans + multiplier * 3)
    return {
      prompt:  `${multiplier} × ${n} = ?`,
      visual:  n <= 5 ? (Array.from({ length: n }, (_, i) => '⭐'.repeat(multiplier)).join('  +  ')) : null,
      options: shuffle([String(ans), ...wrong]),
      answer:  String(ans),
    }
  }

  // ── Comparison (greater / less) ──
  if (type === 'compare') {
    const a = rand(1, maxN)
    let b
    do { b = rand(1, maxN) } while (b === a)
    const ans = a > b ? String(a) : String(b)
    const wrong = [String(a > b ? b : a)]
    // Add two more distractors near the actual values
    const extras = uniqueWrong(Number(ans), 2, Math.max(1, Math.min(a,b) - 3), Math.max(a,b) + 4)
    return {
      prompt:  `Welche Zahl ist größer? 🔍`,
      visual:  `${a}  vs  ${b}`,
      options: shuffle([ans, ...wrong, ...extras]).slice(0, 4),
      answer:  ans,
    }
  }

  // ── Missing number in a sequence ──
  if (type === 'missing') {
    const start = rand(1, Math.max(1, maxN - 4))
    const seq   = [start, start + 1, start + 2, start + 3]
    const hide  = rand(0, 3)
    const ans   = seq[hide]
    const disp  = seq.map((n, i) => i === hide ? '?' : String(n))
    const wrong = uniqueWrong(ans, 3, Math.max(1, ans - 4), ans + 6)
    return {
      prompt:  'Welche Zahl fehlt? 🔢',
      visual:  disp.join('  →  '),
      options: shuffle([String(ans), ...wrong]),
      answer:  String(ans),
    }
  }

  // ── Missing number in a STEP sequence (by 2, 5, or 10) ──
  if (type === 'missing_step') {
    const step  = shuffle([2, 5, 10])[0]
    const start = rand(0, Math.floor((maxN - step * 4) / step)) * step
    const seq   = [start, start + step, start + step * 2, start + step * 3]
    const hide  = rand(0, 3)
    const ans   = seq[hide]
    const disp  = seq.map((n, i) => i === hide ? '?' : String(n))
    const wrong = uniqueWrong(ans, 3, Math.max(0, ans - step * 2), ans + step * 3)
    return {
      prompt:  `Welche Zahl fehlt? (+${step} Schritte)`,
      visual:  disp.join('  →  '),
      options: shuffle([String(ans), ...wrong]),
      answer:  String(ans),
    }
  }

  // fallback
  return numbersQ(Math.max(1, level - 1))
}

// ─── Patterns ────────────────────────────────────────────────────────────────
const PATTERN_POOL = [
  // Shapes & Colours
  '🔴','🔵','🟡','🟢','🟠','🟣','🟤','⚫','⚪',
  '🔷','🔶','🔸','🔹','🔺','🔻','🟥','🟦','🟨','🟩','🟧','🟪','🟫',
  '💎','⭐','🌟','✨','💫','❤️','🧡','💛','💚','💙','💜','🖤','🤍',
  // Animals
  '🐸','🐶','🐱','🐻','🐼','🐨','🦊','🐰','🐯','🦁','🐮','🐷','🐸',
  '🐔','🦄','🐙','🦋','🐝','🦎','🐢','🦀','🦞','🐟','🦈','🐬','🦜',
  // Nature
  '🌸','🌺','🌻','🌹','🌷','🍀','🌿','🍁','🍂','🌴','🌵','🌾','🎋',
  '🍄','🌙','☀️','🌈','⛄','🌊','🌋','🌸',
  // Food
  '🍎','🍊','🍋','🍇','🍓','🍒','🍑','🥝','🍕','🍩','🎂','🍭','🍦',
  '🍪','🥐','🌮','🍔','🌽','🥕','🥦','🍆','🧁',
  // Objects & Fun
  '🎈','🎁','🏆','💡','🔑','⚡','🎵','🎸','🎪','🚀','🌍','🏠','🎨',
  '🎲','⚽','🏀','🎾','🏆','🧩','🪄',
]

function patternsQ(level) {
  const typesByLevel = [
    ['AB','AB','ABB'],                                        // L1
    ['AB','ABC','AAB','ABB'],                                 // L2
    ['AB','ABC','AAB','ABB','AABB'],                         // L3
    ['ABC','AAB','AABB','ABBC','ABCA'],                      // L4
    ['ABC','AAB','AABB','ABBC','ABCA'],                      // L5
    ['ABC','AABB','ABBC','ABCA','ABC_skip'],                 // L6
    ['AABB','ABBC','ABCA','ABC_skip'],                       // L7
    ['AABB','ABBC','ABCA','ABC_skip','ABCD'],                // L8
    ['ABBC','ABCA','ABC_skip','ABCD'],                       // L9
    ['ABCA','ABC_skip','ABCD'],                              // L10
  ]
  const typePool = typesByLevel[Math.min(level - 1, typesByLevel.length - 1)]
  const type     = shuffle(typePool)[0]
  const pool     = shuffle(PATTERN_POOL)

  let pattern
  switch (type) {
    case 'ABC':      pattern = [pool[0], pool[1], pool[2]];                          break
    case 'AAB':      pattern = [pool[0], pool[0], pool[1]];                          break
    case 'ABB':      pattern = [pool[0], pool[1], pool[1]];                          break
    case 'AABB':     pattern = [pool[0], pool[0], pool[1], pool[1]];                 break
    case 'ABBC':     pattern = [pool[0], pool[1], pool[1], pool[2]];                 break
    case 'ABCA':     pattern = [pool[0], pool[1], pool[2], pool[0]];                 break
    case 'ABCD':     pattern = [pool[0], pool[1], pool[2], pool[3]];                 break
    case 'ABC_skip': {
      // Show A_B_C_ (skip every other), answer is next non-skipped element.
      // Randomise how many full+partial cycles are shown so the answer isn't always base[0].
      const base = [pool[0], pool[1], pool[2]]
      const extra = rand(0, base.length - 1)          // 0, 1, or 2 extra visible elements
      const showLen = base.length * 2 + extra * 2     // 6, 8, or 10 interleaved slots
      const seq = Array.from({ length: showLen }, (_, i) =>
        i % 2 === 0 ? base[Math.floor(i / 2) % base.length] : '⬜'
      )
      const answer = base[(showLen / 2) % base.length]
      const otherBase = [...new Set(base)].filter(e => e !== answer)
      const neededB   = Math.max(0, 3 - otherBase.length)
      const padB      = shuffle(PATTERN_POOL.filter(e => e !== answer && !otherBase.includes(e))).slice(0, neededB)
      const wrong     = shuffle([...otherBase, ...padB])
      return {
        prompt:  'Was kommt nach dem Lücken-Muster? 🔍',
        visual:  [...seq, '❓'].join(' '),
        options: shuffle([answer, ...wrong]),
        answer,
      }
    }
    default:         pattern = [pool[0], pool[1]] // AB
  }

  const extra   = rand(0, pattern.length - 1)
  const showLen = pattern.length * 2 + extra
  const nextIdx = showLen % pattern.length
  const answer  = pattern[nextIdx]
  const seq     = Array.from({ length: showLen }, (_, i) => pattern[i % pattern.length])
  const otherSymbols = [...new Set(pattern)].filter(e => e !== answer)
  const needed   = Math.max(0, 3 - otherSymbols.length)
  const padWrong = shuffle(PATTERN_POOL.filter(e => e !== answer && !otherSymbols.includes(e))).slice(0, needed)
  const wrong    = shuffle([...otherSymbols, ...padWrong])

  return {
    prompt:  'Was kommt als Nächstes? 🤔',
    visual:  [...seq, '❓'].join('  '),
    options: shuffle([answer, ...wrong]),
    answer,
  }
}
