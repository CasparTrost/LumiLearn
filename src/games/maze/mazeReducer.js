import { bfsDistance } from './mazeGen.js'

// The dragon patrols independently in real time (see the setInterval in
// MazeGame.jsx that dispatches DRAGON_STEP) — it is NOT tied to player
// moves. An earlier turn-locked design (dragon only moves when the player
// moves, plus a dedicated WAIT button) was mathematically provable but
// felt wrong to play: a maze game where the enemy freezes unless you act
// is confusing, and a bespoke "wait" button is not how anyone expects a
// patrolling enemy to work.
//
// Fairness rule (verified with an automated Playwright bot, see PR
// notes): a hit happens ONLY when the PLAYER moves onto the dragon (the
// MOVE case). A first version also counted the dragon's own step, and a
// player who stopped at the patrol's edge to wait for an opening was
// caught with no way to react (the bot died 12/12 times). Now the dragon
// never steps onto Lumi at all (DRAGON_STEP): it is a guard that turns
// round in front of a Lumi who stands still. Standing still is always
// safe, and the only thing that matters is not walking into the dragon,
// which is what the help says.

export function initState(maze, hasDragon = true) {
  return {
    maze,
    pos:        { ...maze.start },
    // Cells Lumi has stood on, as "x,y" keys. In fog levels they stay
    // faintly visible, so a child can see where they have already been.
    seen:       { [`${maze.start.x},${maze.start.y}`]: true },
    // The last cells walked, most recent last — where a hit puts Lumi back to
    trail:      [],
    dragon:     hasDragon ? (maze.dragonWps[0] ?? null) : null,
    coll:       [],           // collected potion ids
    lives:      3,
    moves:      0,
    facing:     1,            // 1 = right, -1 = left
    moving:     false,
    won:        false,
    dead:       false,
    invUntil:   0,            // invincibility timestamp (ms)
    bigUntil:   0,            // the pink potion: Lumi is big until this many moves, the dragon gets out of the way
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

// How far a hit sets Lumi back along the way just walked. It used to be all
// the way to the start — on the big fogged levels some fifty steps, very
// hard on a five-year-old.
const KNOCK_BACK = 4

function knockBackPos(s) {
  const onPatrol = p => s.maze.dragonWps.some(w => w.x === p.x && w.y === p.y)
  const t = s.trail
  for (let back = KNOCK_BACK; back <= t.length; back++) {
    const p = t[t.length - back]
    if (!onPatrol(p)) return { pos: p, trail: t.slice(0, t.length - back) }
  }
  return { pos: { ...s.maze.start }, trail: [] }
}

function checkCollision(s, now) {
  if (!s.dragon) return s
  if (s.dragon.x !== s.pos.x || s.dragon.y !== s.pos.y) return s
  if (now < s.invUntil) return s              // invincible — ignore
  // Big Lumi (the pink potion): the dragon jumps out of the way
  if (s.moves < s.bigUntil) return s.event ? s : { ...s, event: { type: 'scare' } }
  const lives = s.lives - 1
  const back  = knockBackPos(s)
  return {
    ...s,
    lives,
    pos:       back.pos,
    trail:     back.trail,
    invUntil:  now + 1800,
    dead:      lives <= 0,
    dangerLevel: computeDanger(s.maze.g, back.pos, s.dragon),
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

      // Wall collision
      if (s.maze.g[ny]?.[nx] !== 0) {
        return { ...s, facing, bumpKey: s.bumpKey + 1, event: { type: 'bump' } }
      }

      // Move
      let n = {
        ...s,
        pos:    { x: nx, y: ny },
        trail:  [...s.trail.slice(-11), s.pos],
        seen:   s.seen[`${nx},${ny}`] ? s.seen : { ...s.seen, [`${nx},${ny}`]: true },
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

      // Check exit (need all potions first). Standing on a closed exit
      // used to do nothing at all, and the child could not tell why.
      if (nx === s.maze.exit.x && ny === s.maze.exit.y) {
        const missing = s.maze.potions.length - n.coll.length
        if (missing <= 0) return { ...n, won: true, event: { type: 'won', moves: n.moves } }
        n = { ...n, event: { type: 'needPotions', missing } }
      }

      n = { ...n, dangerLevel: computeDanger(s.maze.g, n.pos, n.dragon) }
      return checkCollision(n, a.now)
    }

    // Dragon's own independent patrol step, dispatched by a setInterval
    // in MazeGame.jsx — not tied to player input at all.
    //
    // The story: the dragon guards its path. It never walks into Lumi;
    // only Lumi walking into it costs a heart (the MOVE case). So a step
    // onto the cell where Lumi stands is refused: the dragon stays where it
    // is (MazeGame.jsx turns it round instead of sending that step). This
    // keeps standing still unconditionally safe (a bot that stopped at the
    // edge of the patrol used to be caught 12/12 times when the dragon's
    // own step counted as a hit), and the two never share a cell without
    // the hit the child was warned about.
    case 'DRAGON_STEP': {
      if (s.won || s.dead) return s
      if (a.pos.x === s.pos.x && a.pos.y === s.pos.y) return s
      return { ...s, dragon: a.pos, dangerLevel: computeDanger(s.maze.g, s.pos, a.pos) }
    }

    // A pink potion: big for the next `steps` moves
    case 'BIG':
      return { ...s, bigUntil: Math.max(s.bigUntil, s.moves + a.steps) }

    case 'SET_MOVING':
      return { ...s, moving: a.value }

    // After the last heart: the same maze once more, from the start
    case 'RESTART':
      return initState(s.maze, s.dragon !== null)

    case 'CLEAR_EVENT':
      return s.event ? { ...s, event: null } : s

    default:
      return s
  }
}
