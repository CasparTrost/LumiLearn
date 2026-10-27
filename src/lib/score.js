/**
 * Stars, the same rule in every game.
 *
 * The audit found a different rule in almost every game (failed attempts
 * here, right answers there, rounds won elsewhere), "7 von 7 richtig" next
 * to one star, and some games that always gave three. One rule now: what
 * counts is how many tasks were solved on the FIRST try.
 *
 *   onComplete(result(firstTry, total))
 *
 * score = tasks solved on the first try, total = tasks; the results screen
 * shows exactly these numbers next to the stars, so they always agree.
 * Finishing a level always earns at least one star — a child who kept going
 * until every task was solved has done the level.
 */
export function starsFor(firstTry, total) {
  if (!total) return 1
  const share = firstTry / total
  return share >= 0.85 ? 3 : share >= 0.6 ? 2 : 1
}

export function result(firstTry, total) {
  const score = Math.max(0, Math.min(firstTry, total))
  return { score, total, stars: starsFor(score, total) }
}
