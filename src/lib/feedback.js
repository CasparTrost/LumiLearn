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
 */
import { narrate } from '../narrator.js'

const RIGHT = ['Super!', 'Richtig!', 'Toll gemacht!', 'Genau!', 'Klasse!', 'Prima!', 'Ja, richtig!']
const WRONG = ['Hm, noch nicht.', 'Fast!', 'Versuch es nochmal.', 'Nicht ganz.', 'Schau noch einmal genau.']

let lastRight = -1, lastWrong = -1
const pick = (list, last) => {
  let i = Math.floor(Math.random() * list.length)
  if (i === last) i = (i + 1) % list.length
  return i
}

/** The task of a round. Interrupts whatever was still being said. */
export function sayTask(text, opts = {}) {
  return narrate([{ text }], opts)
}

/** Praise, optionally followed by what was right ("Kuh und Schuh reimen sich."). */
export function sayRight(extra, opts = {}) {
  lastRight = pick(RIGHT, lastRight)
  return narrate([{ text: extra ? `${RIGHT[lastRight]} ${extra}` : RIGHT[lastRight] }], opts)
}

/** Gentle correction, optionally with the hint or the right answer. */
export function sayWrong(hint, opts = {}) {
  lastWrong = pick(WRONG, lastWrong)
  return narrate([{ text: hint ? `${WRONG[lastWrong]} ${hint}` : WRONG[lastWrong] }], opts)
}
