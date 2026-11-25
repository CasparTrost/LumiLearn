// Gefühlswelt: what Lumi says after a wrong tap, and when the misses count
// afresh. Apart from the game so that it can be tested
// (tests/unit/gefuehleSpeech.test.js).
import { narrate } from '../../narrator.js'
import { newQuestion, sayWrong } from '../../lib/feedback.js'
import { feelingWord } from '../../lib/words.js'

/**
 * A new deal is a new task: its misses count afresh, as the other games
 * count them per task. Counted over the whole round, the second miss said
 * "Fehler gehören zum Lernen" even in a later deal after right taps, and
 * from the third on Lumi said nothing at all.
 */
export const newDeal = () => newQuestion()

/**
 * A wrong tap: "noch nicht" every time (the second of a deal: "Fehler
 * gehören zum Lernen"); silence after a wrong tap sounded like a yes.
 * `onEnd` once it is through.
 */
export const sayMiss = onEnd => sayWrong(null, { always: true, onEnd })

/**
 * The feeling looked for, said once: not started again while it is still
 * being said ("Trau– Traurig.").
 */
export const sayFeeling = feeling => narrate([feelingWord(feeling)], { skipIfSame: true })
