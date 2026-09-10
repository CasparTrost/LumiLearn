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
  // DFS mazes have exactly one path — keeping the patrol short ensures the player
  // can always wait for the dragon to move aside and slip past.
  const mid     = Math.floor(mainPath.length * 0.45)
  const wpStart = Math.max(Math.floor(mainPath.length * 0.20), mid - 2)
  const wpEnd   = Math.min(Math.floor(mainPath.length * 0.75), mid + 2)
  const dragonWps = mainPath.slice(wpStart, wpEnd + 1).filter(Boolean)

  return { g, cols, rows, start, exit, potions, dragonWps, mainPath }
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
