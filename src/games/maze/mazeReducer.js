import { bfsDistance } from './mazeGen.js'

export function initState(maze) {
  return {
    maze,
    pos:        { ...maze.start },
    dragon:     maze.dragonWps[0] ?? null,
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

function checkCollision(s, now) {
  if (!s.dragon) return s
  if (s.dragon.x !== s.pos.x || s.dragon.y !== s.pos.y) return s
  if (now < s.invUntil) return s              // invincible — ignore
  const lives = s.lives - 1
  const resetDragon = s.maze.dragonWps[0] ?? s.dragon
  return {
    ...s,
    lives,
    pos:       { ...s.maze.start },
    invUntil:  now + 1800,
    dead:      lives <= 0,
    dragon:    resetDragon,
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

      // Check exit (need all potions first)
      const collAfter = n.coll
      if (
        collAfter.length >= s.maze.potions.length &&
        nx === s.maze.exit.x &&
        ny === s.maze.exit.y
      ) {
        n = { ...n, won: true, event: { type: 'won', moves: n.moves } }
      }

      // Update danger level
      n = { ...n, dangerLevel: computeDanger(s.maze.g, n.pos, s.dragon) }

      return checkCollision(n, a.now)
    }

    case 'DRAGON_STEP': {
      if (s.won || s.dead) return s
      const dangerLevel = computeDanger(s.maze.g, s.pos, a.pos)
      const n = { ...s, dragon: a.pos, dangerLevel }
      return checkCollision(n, a.now)
    }

    case 'SET_MOVING':
      return { ...s, moving: a.value }

    case 'CLEAR_EVENT':
      return s.event ? { ...s, event: null } : s

    default:
      return s
  }
}
