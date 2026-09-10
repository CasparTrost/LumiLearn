// Pure maze generation — no React deps

export function genMaze(cols, rows, seed = Date.now()) {
  // Simple seeded LCG random
  let s = seed >>> 0
  const rand = () => {
    s = Math.imul(s, 1664525) + 1013904223
    return (s >>> 0) / 4294967296
  }

  // Init grid: 1 = wall, 0 = path
  const g = Array.from({ length: rows }, () => Array(cols).fill(1))

  // DFS carve from (1,1)
  function carve(x, y) {
    g[y][x] = 0
    const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]].sort(() => rand() - 0.5)
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy
      if (ny > 0 && ny < rows - 1 && nx > 0 && nx < cols - 1 && g[ny][nx] === 1) {
        g[y + dy / 2][x + dx / 2] = 0
        carve(nx, ny)
      }
    }
  }
  carve(1, 1)

  // Ensure start and exit are open
  const start = { x: 1, y: 1 }
  const exit  = { x: cols - 2, y: rows - 2 }
  g[start.y][start.x] = 0
  g[exit.y][exit.x]   = 0

  // BFS helper — returns path array
  function bfs(from, to) {
    if (!from || !to) return []
    const visited = new Set()
    const queue = [[from, []]]
    while (queue.length) {
      const [cur, path] = queue.shift()
      const key = `${cur.x},${cur.y}`
      if (visited.has(key)) continue
      visited.add(key)
      if (cur.x === to.x && cur.y === to.y) return path
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = cur.x + dx, ny = cur.y + dy
        if (g[ny]?.[nx] === 0)
          queue.push([{ x: nx, y: ny }, [...path, { x: nx, y: ny }]])
      }
    }
    return []
  }

  // Place potions evenly along the main path
  const mainPath = bfs(start, exit)
  const potionCount = Math.min(3, Math.max(1, Math.floor(mainPath.length / 5)))
  const spacing = Math.floor(mainPath.length / (potionCount + 1))
  const potions = Array.from({ length: potionCount }, (_, i) => {
    const cell = mainPath[spacing * (i + 1)]
    return { id: i, x: cell?.x ?? exit.x - 2, y: cell?.y ?? exit.y - 2, type: i % 3 }
  }).filter(p => {
    const dStart = Math.abs(p.x - start.x) + Math.abs(p.y - start.y)
    return dStart > 4 && g[p.y]?.[p.x] === 0
  })

  // Dragon patrol: a SHORT stretch (5 cells) centred around 45% of the main path.
  const mid     = Math.floor(mainPath.length * 0.45)
  const wpStart = Math.max(Math.floor(mainPath.length * 0.20), mid - 2)
  const wpEnd   = Math.min(Math.floor(mainPath.length * 0.75), mid + 2)
  const dragonWps = mainPath.slice(wpStart, wpEnd + 1).filter(Boolean)

  // Carve an actual detour around the patrol — a real second path the
  // player can duck into to walk AROUND the dragon, not just wait for a
  // gap. A perfect (DFS) maze has exactly one route between any two
  // cells, so without this the only way past the dragon is timing a
  // dash through the same single corridor it patrols — which is
  // technically avoidable (proven separately) but doesn't feel like
  // "avoiding" anything since there's nowhere else to go. This opens a
  // short parallel corridor, offset by one cell perpendicular to the
  // patrol's direction of travel, connecting back to the main path just
  // before and just after the patrol zone.
  const hasBypass = addDragonBypass(g, cols, rows, mainPath, wpStart, wpEnd)

  return { g, cols, rows, start, exit, potions, dragonWps, mainPath, hasBypass, wpStart, wpEnd }
}

// Carves a detour around mainPath[wpStart..wpEnd] (the dragon's patrol)
// connecting the cells immediately before and after it, WITHOUT ever
// touching a patrol cell. Uses a 0-1 BFS (Dijkstra with only edge
// weights 0 and 1): moving onto an already-open cell is free, moving
// onto a wall costs 1 (we'll carve it), patrol cells are forbidden
// entirely. This finds the detour that requires carving the FEWEST new
// walls, preferring existing corridors where available — and unlike a
// fixed geometric offset, it naturally handles a patrol that bends
// (corners, zigzags), since it's a plain graph search around whatever
// shape the forbidden region actually has. Mutates `g` in place.
// Returns true if a route was found (always, in practice — the only
// failure mode is entry/exit missing at the very edge of the maze).
function addDragonBypass(g, cols, rows, mainPath, wpStart, wpEnd) {
  const entry = mainPath[wpStart - 1]
  const exit  = mainPath[wpEnd + 1]
  if (!entry || !exit) return false

  const patrolSet = new Set(mainPath.slice(wpStart, wpEnd + 1).map(c => `${c.x},${c.y}`))
  const key = p => `${p.x},${p.y}`

  const dist = new Map([[key(entry), 0]])
  const prev = new Map()
  const deque = [entry]

  while (deque.length) {
    const cur = deque.shift()
    if (cur.x === exit.x && cur.y === exit.y) break
    const curDist = dist.get(key(cur))

    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const n = { x: cur.x + dx, y: cur.y + dy }
      if (n.x <= 0 || n.x >= cols - 1 || n.y <= 0 || n.y >= rows - 1) continue
      const nKey = key(n)
      if (patrolSet.has(nKey)) continue
      const cost = g[n.y][n.x] === 0 ? 0 : 1
      const nd = curDist + cost
      if (!dist.has(nKey) || nd < dist.get(nKey)) {
        dist.set(nKey, nd)
        prev.set(nKey, cur)
        if (cost === 0) deque.unshift(n)
        else deque.push(n)
      }
    }
  }

  if (!dist.has(key(exit))) return false

  // Walk back from exit to entry, carving any wall cell used along the way
  let cur = exit
  while (key(cur) !== key(entry)) {
    if (g[cur.y][cur.x] === 1) g[cur.y][cur.x] = 0
    cur = prev.get(key(cur))
    if (!cur) break
  }
  return true
}

export function bfsDistance(g, from, to) {
  if (!g || !from || !to) return 999
  const visited = new Set()
  const queue = [[from, 0]]
  while (queue.length) {
    const [cur, d] = queue.shift()
    const key = `${cur.x},${cur.y}`
    if (visited.has(key)) continue
    visited.add(key)
    if (cur.x === to.x && cur.y === to.y) return d
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = cur.x + dx, ny = cur.y + dy
      if (g[ny]?.[nx] === 0) queue.push([{ x: nx, y: ny }, d + 1])
    }
  }
  return 999
}
