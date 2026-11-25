// The coins of a maze: three on side paths, off the shortest way, so a
// child chooses between the short way (the crown at the win) and the rich
// way (all three open the chest at the gate). Pure functions, no React.

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const key = p => `${p.x},${p.y}`

// Steps from `from` to every open cell
function distances(g, from) {
  const dist = new Map([[key(from), 0]])
  const queue = [from]
  while (queue.length) {
    const c = queue.shift(), d = dist.get(key(c))
    for (const [dx, dy] of DIRS) {
      const n = { x: c.x + dx, y: c.y + dy }
      if (g[n.y]?.[n.x] !== 0 || dist.has(key(n))) continue
      dist.set(key(n), d + 1)
      queue.push(n)
    }
  }
  return dist
}

// One shortest way from `from` to `to`, both ends included
function way(g, from, to) {
  const prev = new Map([[key(from), null]])
  const queue = [from]
  while (queue.length) {
    const c = queue.shift()
    if (c.x === to.x && c.y === to.y) break
    for (const [dx, dy] of DIRS) {
      const n = { x: c.x + dx, y: c.y + dy }
      if (g[n.y]?.[n.x] !== 0 || prev.has(key(n))) continue
      prev.set(key(n), c)
      queue.push(n)
    }
  }
  const out = []
  for (let p = prev.has(key(to)) ? to : null; p; p = prev.get(key(p))) out.unshift(p)
  return out
}

const orders = list => (list.length <= 1 ? [list]
  : list.flatMap((p, i) => orders([...list.slice(0, i), ...list.slice(i + 1)]).map(rest => [p, ...rest])))

/**
 * The fewest steps from the start that visit every one of `stops` (in any
 * order) and end at the exit, and the order that does it.
 */
export function bestTour({ g, start, exit }, stops) {
  const points = [start, ...stops, exit]
  const d = points.map(p => distances(g, p))
  const between = (i, j) => d[i].get(key(points[j])) ?? Infinity
  let best = { steps: Infinity, order: [] }
  for (const order of orders(stops.map((_, i) => i + 1))) {
    let steps = 0, cur = 0
    for (const next of [...order, points.length - 1]) { steps += between(cur, next); cur = next }
    if (steps < best.steps) best = { steps, order: order.map(i => points[i]) }
  }
  return best
}

/**
 * Three coin cells on side paths: as far off the shortest way (start →
 * potions → exit) as the maze allows — dead ends first — and apart from
 * each other, never on the dragon's patrol, a potion, the start or the exit,
 * and never where only the gate leads. A maze with too few side paths (a
 * few of the small ones) gets the rest on the way itself, so there are
 * always three to collect.
 */
export function coinSpots(maze, n = 3) {
  const { g, start, exit, potions, dragonWps = [] } = maze
  // the shortest way, cell by cell
  const tour = bestTour(maze, potions)
  const stops = [start, ...tour.order, exit]
  const onWay = []
  for (let i = 1; i < stops.length; i++) onWay.push(...way(g, stops[i - 1], stops[i]))
  // how far every cell is off it
  const off = new Map(onWay.map(p => [key(p), 0]))
  const queue = [...onWay]
  while (queue.length) {
    const c = queue.shift(), d = off.get(key(c))
    for (const [dx, dy] of DIRS) {
      const nb = { x: c.x + dx, y: c.y + dy }
      if (g[nb.y]?.[nb.x] !== 0 || off.has(key(nb))) continue
      off.set(key(nb), d + 1)
      queue.push(nb)
    }
  }
  // Walking onto the gate with all potions wins the level: a coin that can
  // only be reached through the gate could never be taken
  const closed = g.map((row, y) => row.map((v, x) => (x === exit.x && y === exit.y ? 1 : v)))
  const reach = distances(closed, start)
  const taken = new Set([start, exit, ...potions, ...dragonWps].map(key))
  const cells = []
  for (let y = 1; y < g.length - 1; y++) for (let x = 1; x < g[0].length - 1; x++) {
    if (g[y][x] !== 0 || taken.has(`${x},${y}`) || !reach.has(`${x},${y}`)) continue
    const ways = DIRS.filter(([dx, dy]) => g[y + dy]?.[x + dx] === 0).length
    // a cell beside the exit would be on the way after all
    if (Math.abs(x - exit.x) + Math.abs(y - exit.y) <= 1) continue
    cells.push({ x, y, off: off.get(`${x},${y}`) ?? 0, end: ways === 1 })
  }
  // further off is worth more; a dead end is the natural place for treasure
  cells.sort((a, b) => (b.off * 2 + (b.end ? 3 : 0)) - (a.off * 2 + (a.end ? 3 : 0)) || (b.x + b.y) - (a.x + a.y))
  // apart from each other, if the maze has room for that
  const picked = []
  for (const [minOff, apart] of [[2, Math.max(4, Math.round(g[0].length / 3))], [2, 3], [1, 3], [1, 2], [1, 1], [0, 3], [0, 1]]) {
    for (const c of cells) {
      if (picked.length >= n) break
      if (c.off < minOff || picked.includes(c)) continue
      if (picked.some(p => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) < apart)) continue
      picked.push(c)
    }
  }
  return picked.slice(0, n).map((c, id) => ({ id, x: c.x, y: c.y }))
}
