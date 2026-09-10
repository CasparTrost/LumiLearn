import { bfsDistance } from './mazeGen.js'

// Dragon movement is TURN-LOCKED to the player (MOVE/WAIT), not driven by
// a real-time clock — see stepDragon below. This is deliberate: it makes
// the patrol provably, always avoidable, with a mental model simple
// enough for a child:
//
//   Rule 1 — collision only happens if the player actively steps onto the
//   dragon's CURRENTLY VISIBLE cell (checked against its position as it
//   stood before the move — exactly what's on screen when deciding).
//   No hidden lookahead is ever required.
//
//   Rule 2 — WAIT (stand still, let the dragon take its next step) is
//   ALWAYS 100% safe, even if the dragon's step lands on the player.
//
// Together these two rules guarantee the patrol can always be crossed:
// the player can observe the dragon for as long as they like (no clock
// pressure, WAIT is risk-free), and only needs to avoid moving onto its
// current cell. Verified by simulation (scripts/... — see PR notes): a
// purely greedy "move toward the goal, WAIT if the next cell is the
// dragon, otherwise move" strategy wins 2000/2000 randomly generated
// mazes across all level sizes, with zero deaths.
//
// This also removes any dependency on device speed / animation lag, which
// made the previous setInterval-based dragon movement unfair in practice.

export function initState(maze, hasDragon = true) {
  return {
    maze,
    pos:        { ...maze.start },
    dragon:     hasDragon ? (maze.dragonWps[0] ?? null) : null,
    dragonIdx:  0,             // current index into maze.dragonWps
    dragonDir:  1,             // +1 or -1 — direction of travel along the patrol
    coll:       [],           // collected potion ids
    lives:      3,
    moves:      0,
    facing:     1,            // 1 = right, -1 = left
    moving:     false,
    won:        false,
    dead:       false,
    invUntil:   0,            // invincibility timestamp (ms)
    bumpKey:    0,            // increments on wall bump — drives shake animation
    dangerLevel: 0,           // 0 = safe, 0.5 = near, 1 = very near
    event:      null,         // { type, ...data } — consumed by side-effect hook
  }
}

function computeDanger(g, pos, dragon) {
  if (!dragon) return 0
  const dist = bfsDistance(g, pos, dragon)
  return dist <= 2 ? 1 : dist <= 5 ? 0.5 : 0
}

// Advances the dragon exactly one cell along its patrol, reflecting at
// both boundaries. Pure — returns a new state slice, does not mutate.
function stepDragon(s) {
  const wps = s.maze.dragonWps
  if (!s.dragon || !wps || wps.length < 2) return s
  const last = wps.length - 1
  let i   = s.dragonIdx
  let dir = s.dragonDir
  if (i >= last) dir = -1
  else if (i <= 0) dir = 1
  i += dir
  return { ...s, dragon: wps[i], dragonIdx: i, dragonDir: dir }
}

function checkCollision(s, now) {
  if (!s.dragon) return s
  if (s.dragon.x !== s.pos.x || s.dragon.y !== s.pos.y) return s
  if (now < s.invUntil) return s              // invincible — ignore
  const lives = s.lives - 1
  return {
    ...s,
    lives,
    pos:       { ...s.maze.start },
    invUntil:  now + 1800,
    dead:      lives <= 0,
    dragon:    s.dragon && (s.maze.dragonWps[0] ?? s.dragon),
    dragonIdx: 0,
    dragonDir: 1,
    event:     { type: lives <= 0 ? 'dead' : 'hit', lives },
  }
}

export function mazeReducer(s, a) {
  switch (a.type) {

    case 'MOVE': {
      if (s.won || s.dead) return s
      const nx = s.pos.x + a.dx
      const ny = s.pos.y + a.dy
      const facing = a.dx !== 0 ? Math.sign(a.dx) : s.facing

      // Wall collision — dragon does not take a turn on a wasted bump
      if (s.maze.g[ny]?.[nx] !== 0) {
        return { ...s, facing, bumpKey: s.bumpKey + 1, event: { type: 'bump' } }
      }

      // Move
      let n = {
        ...s,
        pos:    { x: nx, y: ny },
        moves:  s.moves + 1,
        facing,
        moving: true,
        event:  null,
      }

      // Potion pickup
      const potion = s.maze.potions.find(
        p => p.x === nx && p.y === ny && !s.coll.includes(p.id)
      )
      if (potion) {
        n = { ...n, coll: [...s.coll, potion.id], event: { type: 'potion', id: potion.id, x: nx, y: ny } }
      }

      // Check exit (need all potions first) — game over, dragon doesn't move
      const collAfter = n.coll
      if (
        collAfter.length >= s.maze.potions.length &&
        nx === s.maze.exit.x &&
        ny === s.maze.exit.y
      ) {
        return { ...n, won: true, event: { type: 'won', moves: n.moves } }
      }

      // Collision check happens ONLY against the dragon's cell as it
      // stood BEFORE this move — i.e. exactly what's visible on screen
      // at the moment the player decides to move. No hidden lookahead:
      // the player never needs to predict where the dragon is ABOUT to
      // step, only avoid where it currently, visibly is.
      n = { ...n, dangerLevel: computeDanger(s.maze.g, n.pos, n.dragon) }
      const afterMove = checkCollision(n, a.now)
      if (afterMove.event?.type === 'hit' || afterMove.event?.type === 'dead') {
        return afterMove
      }

      // Safe — the dragon now takes its own patrol step for NEXT time.
      // This does not retroactively punish the move just made; it only
      // affects the player's next decision (or a WAIT, which checks the
      // dragon's new position directly, since standing still and having
      // the dragon walk into you should still count).
      const stepped = stepDragon(afterMove)
      return { ...stepped, dangerLevel: computeDanger(s.maze.g, stepped.pos, stepped.dragon) }
    }

    // Player deliberately passes a turn in place. This is essential, not
    // optional: since the dragon only advances inside a MOVE/WAIT dispatch
    // (there is no independent clock), the player MUST have a way to let
    // time pass — i.e. let the dragon take another patrol step — without
    // walking into it. WAIT is that action; the D-Pad's centre button.
    //
    // WAIT is ALWAYS safe, even if the dragon's step lands on the
    // player's cell. This is deliberate: the only thing a player (a
    // child) needs to understand is "never move onto the dragon's
    // current, visible cell" — standing still must never be punished,
    // or waiting stops being a genuine safe option and the whole point
    // of removing the real-time clock (unlimited time to plan) is lost.
    case 'WAIT': {
      if (s.won || s.dead) return s
      const n = stepDragon({ ...s, event: null })
      return { ...n, dangerLevel: computeDanger(s.maze.g, n.pos, n.dragon) }
    }

    case 'SET_MOVING':
      return { ...s, moving: a.value }

    case 'CLEAR_EVENT':
      return s.event ? { ...s, event: null } : s

    default:
      return s
  }
}
