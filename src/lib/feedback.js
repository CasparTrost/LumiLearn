/**
 * Spoken feedback, the same in every game.
 *
 * The audit found five of nine maths games and several others silent after
 * an answer: a child who cannot read saw a green or red frame and nothing
 * else. These helpers give every game the same few sentences, varied so they
 * don't sound like a machine, through the central narrator (one voice, no
 * overlaps, previews locked until it is done).
 *
 *   sayTask('Welches Bild passt zum Wort?')            // at round start
 *   sayRight('Kuh und Schuh reimen sich.')              // after a right answer
 *   sayWrong('Das ist die 7. Wir suchen die 3.')        // after a wrong one
 *
 * The praise is about what the child did, not about how clever it is
 * ("Gut überlegt!", not "Du bist schlau!"): praising effort and strategy
 * keeps children trying after a mistake, praising ability makes them avoid
 * hard tasks (Mueller & Dweck 1998; Gunderson et al. 2013). A right answer
 * after a miss is praised for not giving up, and a second miss in a row
 * gets a word that mistakes are part of learning.
 *
 * Every answer is also announced as a 'lumi:feedback' event, so Lumi in the
 * game's top bar can cheer or think along (components/LumiBuddy.jsx).
 */
import { narrate } from '../narrator.js'

const RIGHT = ['Super!', 'Richtig!', 'Genau!', 'Klasse!', 'Prima!', 'Ja, richtig!', 'Gut überlegt!', 'Gut aufgepasst!', 'Genau hingeschaut!']
// a right answer after a miss: the child kept going
const PERSIST = ['Du hast nicht aufgegeben. Super!', 'Drangeblieben! Jetzt stimmt es.', 'Siehst du? Weiterprobieren hilft!', 'Geschafft! Gut, dass du weitergemacht hast.']
// No "try again" here: some games move on to the next task after a miss
const WRONG = ['Hm, noch nicht.', 'Fast!', 'Nicht ganz.', 'Hm, das war es nicht.', 'Schau mal genau.']

let lastRight = -1, lastWrong = -1, lastPersist = -1
// misses in a row since the last right answer
let missed = 0

/** Lumi in the top bar reacts to this (components/LumiBuddy.jsx). */
export function announce(kind) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lumi:feedback', { detail: kind }))
}
const pick = (list, last) => {
  let i = Math.floor(Math.random() * list.length)
  if (i === last) i = (i + 1) % list.length
  return i
}

/** The task of a round. Interrupts whatever was still being said. */
export function sayTask(text, opts = {}) {
  // a new task: a right answer now is not "you kept going"
  missed = 0
  return narrate([{ text }], opts)
}

/** Praise, optionally followed by what was right ("Kuh und Schuh reimen sich."). */
export function sayRight(extra, opts = {}) {
  const kept = missed > 0
  missed = 0
  announce(kept ? 'persist' : 'right')
  let head
  if (kept) { lastPersist = pick(PERSIST, lastPersist); head = PERSIST[lastPersist] }
  else { lastRight = pick(RIGHT, lastRight); head = RIGHT[lastRight] }
  return narrate([{ text: extra ? `${head} ${extra}` : head }], opts)
}

/** Gentle correction, optionally with the hint or the right answer. */
export function sayWrong(hint, opts = {}) {
  missed++
  announce('wrong')
  lastWrong = pick(WRONG, lastWrong)
  const head = missed === 2 ? 'Nicht schlimm, Fehler gehören zum Lernen.' : WRONG[lastWrong]
  return narrate([{ text: hint ? `${head} ${hint}` : head }], opts)
}
