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
// notes): collision is checked ONLY when the PLAYER moves (the MOVE
// case), never when the dragon takes its own step (DRAGON_STEP). A
// first version checked collision on both, matching "it doesn't matter
// who moved onto whom" — that sounds fair but isn't: a player who
// stops right at the patrol's edge to wait for an opening can have the
// dragon walk onto their stationary cell with no way to react. The bot
// died 12/12 times that way. Making the dragon unable to "catch" a
// stationary player fixes this completely: standing still (not
// pressing anything) is unconditionally safe, so the player can watch
// the dragon for as long as they like with zero time pressure, and the
// only thing that ever matters is not pressing a direction that would
// step onto the dragon's cell as it visibly is right now.

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
    // IMPORTANT — deliberately does NOT call checkCollision. Verified by
    // an automated Playwright bot (see PR notes) that a real-time dragon
    // checked for collision on EVERY step — including its own — makes
    // the patrol genuinely unavoidable: a player who stops and waits
    // right at the edge of the patrol can still have the dragon walk
    // onto them while stationary, with no way to react (12/12 bot runs
    // died this way). The fix: collision only ever happens as a result
    // of the PLAYER's own MOVE (below) — never from the dragon's own
    // step. This makes standing still unconditionally safe, so the
    // player can watch the dragon for as long as they want (no timing
    // pressure) and only needs to avoid pressing a direction that walks
    // them onto the dragon's currently visible cell. The dragon still
    // moves entirely on its own in real time — it just can't "walk into
    // you" the way you can walk into it.
    case 'DRAGON_STEP': {
      if (s.won || s.dead) return s
      return { ...s, dragon: a.pos, dangerLevel: computeDanger(s.maze.g, s.pos, a.pos) }
    }

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
