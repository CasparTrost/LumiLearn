// Browser smoke test against a production build (npm run build; npx vite preview).
// Fresh child on a phone through onboarding; every game opened at phone,
// tablet and desktop size; one game played to the results; Lumi's ideas to the sticker; Lumi's
// wardrobe and Lumi dressed in a game; Lumi's shape chosen on the ring and shown everywhere; the app and
// unopened games started again without a network. Fails on page
// errors, pictures that don't load, sideways scrolling and buttons off the
// screen.
//
//   URL=http://localhost:4173/LumiLearn/ node tests/e2e/smoke.mjs
// CHROMIUM=/path/to/chrome uses a browser other than Playwright's own.
import { chromium } from 'playwright'
import { WARDROBE, SLOTS } from '../../src/lib/wardrobe.js'
import { STEPS, SHAPE_IDS } from '../../src/lib/shapes.js'

const URL = process.env.URL ?? 'http://localhost:4173/LumiLearn/'
const SIZES = { phone: [360, 740], tablet: [1024, 768], desktop: [1440, 900] }
const save = { version: 2, language: 'de', activeProfileId: 'p1', settings: { parentPin: '1234', pinIsDefault: true },
  profiles: { p1: { id: 'p1', name: 'Mia', age: 7, avatar: '🦊', progress: {}, streak: { count: 0, lastDate: null },
    dailyMission: { date: null, missions: [], completedIds: [] }, lastPlayed: null,
    // Lumi chosen (the chick): the free first choice would open by itself
    shapePicked: true, shapes: ['chick'], shape: 'chick',
    // the help box of every game is ticked off (it comes up by itself the
    // first time a game is played; section 6 looks at that)
    helpSeen: Object.fromEntries(['numbers', 'letters', 'listen', 'words', 'patterns', 'shapes', 'emotions', 'maze', 'shadows', 'bubbles', 'sort',
      'clock', 'words2', 'weight', 'number-intro', 'letter-intro', 'coloring', 'shape-build', 'empathy', 'initial-sound', 'rhyme', 'shapes-land',
      'rocket-math', 'trace'].map(id => [id, true])) } } }
// silent speech: headless browsers have no voices, and tests should not wait for them
const mute = () => {
  const SS = window.speechSynthesis
  if (SS) SS.speak = u => setTimeout(() => u.dispatchEvent(new Event('end')), 50)
}

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const problems = []

async function newPage([w, h], seed) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1000 })
  await ctx.addInitScript(mute)
  if (seed) await ctx.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('lumilearn_save', s); sessionStorage.setItem('seeded', '1') } }, JSON.stringify(seed))
  const page = await ctx.newPage()
  page.errors = []
  page.on('pageerror', e => page.errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()) })
  return page
}

async function check(page, where) {
  const r = await measure(page)
  // something sliding in (a character entering the stage) is off screen for
  // a moment: only what is still off screen a moment later counts
  if (r.off.length) {
    await page.waitForTimeout(1500)
    const again = await measure(page)
    r.off = r.off.filter(x => again.off.includes(x))
  }
  const crashed = await page.getByText(/gestolpert|Etwas ist schiefgegangen/).count()
  if (crashed) problems.push(`${where}: error screen`)
  if (r.sideways) problems.push(`${where}: scrolls sideways`)
  if (r.off.length) problems.push(`${where}: off screen: ${r.off.join(', ')}`)
  if (r.broken.length) problems.push(`${where}: pictures not loading: ${r.broken.join(', ')}`)
}

async function measure(page) {
  return page.evaluate(() => {
    const W = innerWidth, H = innerHeight
    // a page that scrolls down (the home screen) may have buttons further down
    const scrolls = document.documentElement.scrollHeight > H + 1
    const off = [...document.querySelectorAll('button')].filter(b => {
      const r = b.getBoundingClientRect(); const cs = getComputedStyle(b)
      // a row that scrolls sideways on purpose (the coloring page picker)
      const scroller = b.closest('[style*="overflow-x: auto"], [style*="overflow-x:auto"], [style*="overflow: auto"]')
      return r.width && cs.visibility !== 'hidden' && +cs.opacity > 0 && !scroller && (r.right > W + 1 || r.left < -1 || (!scrolls && r.bottom > H + 1))
    }).map(b => (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 30))
    const broken = [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.split('/').pop())
    return { sideways: document.documentElement.scrollWidth > W + 1, off, broken }
  })
}

// 1. A new child on a phone
{
  const page = await newPage(SIZES.phone)
  await page.goto(URL); await page.waitForTimeout(1200)
  await page.getByRole('button', { name: /Los geht/ }).click(); await page.waitForTimeout(800)
  // the child chooses its Lumi on the ring: turn once, then the green tick
  await page.locator('[data-turn="right"]').click(); await page.waitForTimeout(900)
  await page.locator('[data-confirm]').click({ force: true }); await page.waitForTimeout(2000)
  await page.getByRole('button', { name: '6', exact: true }).click()
  await page.getByRole('button', { name: /Los geht/ }).click(); await page.waitForTimeout(2000)
  await check(page, 'onboarding → home')
  if (!(await page.getByRole('button', { name: /Level/ }).count())) problems.push('onboarding: no games on the home screen')
  problems.push(...page.errors.map(e => `onboarding: ${e}`))
  await page.context().close()
}

// 2. Every game at every size
for (const [size, dim] of Object.entries(SIZES)) {
  const page = await newPage(dim, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await check(page, `${size} home`)
  const titles = await page.evaluate(() => [...new Set([...document.querySelectorAll('button[aria-label]')]
    .map(b => b.getAttribute('aria-label').match(/^(.+?)(?:, Level|\. Spielen$)/)?.[1]).filter(Boolean))])
  if (titles.length < 24) problems.push(`${size}: only ${titles.length} games on the home screen`)
  for (const t of titles) {
    try {
      await page.getByRole('button', { name: new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:, Level|\\. Spielen$)`) }).last().click()
      await page.waitForTimeout(1800)
      await check(page, `${size} ${t}`)
      await page.getByRole('button', { name: 'Spiel verlassen' }).click(); await page.waitForTimeout(300)
      await page.getByRole('button', { name: /Aufhören/ }).click(); await page.waitForTimeout(800)
    } catch (e) {
      problems.push(`${size} ${t}: ${String(e).split('\n')[0]}`)
      await page.goto(URL); await page.waitForTimeout(1500)
    }
  }
  problems.push(...page.errors.map(e => `${size}: ${e}`))
  await page.context().close()
}

// Plays Schattenrätsel (Taschenlampen-Jagd) to the results: the mouse
// shines on a shadow until it is caught, then the card of the shadow in
// focus (data-focus, where a tapped card goes) is tapped and flies to it.
// With `wrongOnce`, the first caught shadow gets a card that fits no lit
// shadow first (it shakes its head, the card flies back). Everything is
// read from data attributes and clicked by coordinates, never by waiting
// for an element to hold still: the shadows and cards are always moving.
async function playShadows(page, { wrongOnce = false } = {}) {
  const game = page.locator('[data-game="schatten"]')
  await game.waitFor({ timeout: 10000 }).catch(() => problems.push('Schattenrätsel: the game did not start'))
  let wrong = !wrongOnce
  const t0 = Date.now()
  while (Date.now() - t0 < 180000 && (await game.count())) {
    const s = await page.evaluate(() => {
      const root = document.querySelector('[data-game="schatten"]')
      if (!root) return null
      const mid = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }
      return {
        phase: root.dataset.phase,
        shadows: [...root.querySelectorAll('[data-shadow]')].map(el => ({ e: el.dataset.shadow, state: el.dataset.state, focus: el.dataset.focus === '1', ...mid(el) })),
        cards: [...root.querySelectorAll('[data-card]')].map(el => ({ e: el.dataset.card, ...mid(el) })),
      }
    }).catch(() => null)
    if (!s) break
    if (s.phase !== 'play') { await page.waitForTimeout(250); continue }
    const lit = s.shadows.filter(x => x.state === 'caught')
    const focus = lit.find(x => x.focus)
    if (focus) {
      let card = s.cards.find(c => c.e === focus.e)
      if (!wrong) {
        const other = s.cards.find(c => !lit.some(x => x.e === c.e))
        if (other) { wrong = true; card = other }
      }
      if (card) await page.mouse.click(card.x, card.y)
      await page.waitForTimeout(card ? 900 : 250)
      continue
    }
    const dark = s.shadows.find(x => x.state === 'dark' && x.e !== '🐱')
    if (dark) await page.mouse.move(dark.x, dark.y, { steps: 2 })
    await page.waitForTimeout(dark ? 120 : 250)
  }
  await page.waitForTimeout(2500)
}

// 3. One game to the end: Schattenrätsel, level 1 (three rooms of three
// shadows), one card first given to the wrong shadow
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Schattenrätsel, Level/ }).last().click()
  await playShadows(page, { wrongOnce: true })
  const text = await page.evaluate(() => document.body.innerText)
  if (!/8 von 9 gleich beim ersten Mal richtig/.test(text)) problems.push(`full game: results not as expected: ${text.slice(0, 120).replace(/\n/g, ' | ')}`)
  await check(page, 'results')
  problems.push(...page.errors.map(e => `full game: ${e}`))
  await page.context().close()
}

// 3b. Zahlenland (Sternbilder): the stars of a level connected in order, one
// wrong star on the way, to the results
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Zahlenland, Level/ }).last().click()
  const game = page.locator('[data-module="numbers"] [data-phase]')
  await page.locator('[data-star="next"]').waitFor({ timeout: 10000 }).catch(() => problems.push('Sternbilder: no stars'))
  let missed = false
  for (let i = 0; i < 400 && (await game.count()); i++) {
    const phase = await game.getAttribute('data-phase').catch(() => null)
    if (phase !== 'play') { await page.waitForTimeout(250); continue }
    // once, after the second star: a wrong one wobbles and the line stays where it was
    if (!missed && (await page.locator('[data-star="done"]').count()) === 2) {
      missed = true
      await page.locator('[data-star="todo"]').last().click(); await page.waitForTimeout(300)
      if ((await page.locator('[data-star="done"]').count()) !== 2) problems.push('Sternbilder: a wrong star was connected')
      continue
    }
    await page.locator('[data-star="next"]').click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(2500)
  const text = await page.evaluate(() => document.body.innerText)
  if (!/3 von 4 gleich beim ersten Mal richtig/.test(text)) problems.push(`Sternbilder: results not as expected: ${text.slice(0, 120).replace(/\n/g, ' | ')}`)
  await check(page, 'Sternbilder results')
  problems.push(...page.errors.map(e => `Sternbilder: ${e}`))
  await page.context().close()
}

// 3c. ABC-Abenteuer (Monster-Mampf): the four monsters of level 1 fed until
// they are full, one wrong bite on the way, to the results: the result
// counts bites (4 monsters x 5), one of them came after the wrong one
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^ABC-Abenteuer, Level/ }).last().click()
  const game = page.locator('[data-module="letter-intro"] [data-phase]')
  await game.waitFor({ timeout: 10000 }).catch(() => problems.push('Monster-Mampf: no stage'))
  // the hungry monster and what floats past, with where to tap
  const look = () => page.evaluate(() => {
    const m = document.querySelector('[data-monster][data-state="hungry"]')
    if (document.querySelector('[data-phase]')?.dataset.phase !== 'play' || !m) return null
    return {
      letter: m.dataset.monster, bites: +m.dataset.bites, spat: document.querySelectorAll('[data-spat]').length,
      things: [...document.querySelectorAll('[data-thing]')].map(t => {
        const r = t.querySelector('.mm-plate').getBoundingClientRect()
        return { letter: t.dataset.thing, x: r.left + r.width / 2, y: r.top + r.height / 2 }
      }).filter(t => t.x > 60 && t.x < innerWidth - 60),
    }
  })
  let missed = false
  for (let i = 0; i < 500 && (await game.count()); i++) {
    const s = await look()
    // once, after a monster's first bite: a thing that does not fit is spat
    // out again, and the monster is as hungry as before
    const wrong = !missed && s?.bites === 1
    const t = s?.things.find(t => (t.letter === s.letter) !== wrong)
    if (!t) { await page.waitForTimeout(250); continue }
    await page.mouse.click(t.x, t.y)
    await page.waitForTimeout(wrong ? 2000 : 700)
    if (wrong) {
      missed = true
      const after = await look()
      if (after?.letter !== s.letter || after.bites !== 1) problems.push('Monster-Mampf: a wrong thing was eaten')
      if (after && after.spat !== s.spat + 1) problems.push('Monster-Mampf: the wrong thing was not spat out')
    }
  }
  await page.waitForTimeout(2500)
  const text = await page.evaluate(() => document.body.innerText)
  if (!/19 von 20 gleich beim ersten Mal richtig/.test(text)) problems.push(`Monster-Mampf: results not as expected: ${text.slice(0, 120).replace(/\n/g, ' | ')}`)
  await check(page, 'Monster-Mampf results')
  problems.push(...page.errors.map(e => `Monster-Mampf: ${e}`))
  await page.context().close()
}

// 3d. Silben-Spaß (Frosch-Hüpfer): a level hopped through, a hop per
// syllable and then ashore; one hop too many on the way, to the results
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Silben-Spaß, Level/ }).last().click()
  const game = page.locator('[data-game="frosch"]')
  await game.waitFor({ timeout: 10000 }).catch(() => problems.push('Frosch-Hüpfer: no pond'))
  let splashed = false
  for (let i = 0; i < 600 && (await game.count()); i++) {
    const s = await game.evaluate(el => ({ ...el.dataset })).catch(() => null)
    if (!s || s.phase !== 'play') { await page.waitForTimeout(200); continue }
    const n = s.word.split('-').length, hops = Number(s.hops)
    // once, in the second word: no syllable is left, no pad comes, the frog
    // lands in the water and starts again from its bank
    const over = !splashed && s.round === '1' && hops === n
    if (over) splashed = true
    if (hops < n || over) await page.getByRole('button', { name: 'Hüpfen' }).click({ timeout: 3000 }).catch(() => {})
    else await page.locator('[data-thing]').click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(650)
    if (over) {
      await page.waitForTimeout(3500)
      if ((await game.getAttribute('data-hops').catch(() => null)) !== '0') problems.push('Frosch-Hüpfer: after a splash the frog is not back on its bank')
    }
  }
  await page.waitForTimeout(2500)
  const text = await page.evaluate(() => document.body.innerText)
  if (!/5 von 6 gleich beim ersten Mal richtig/.test(text)) problems.push(`Frosch-Hüpfer: results not as expected: ${text.slice(0, 120).replace(/\n/g, ' | ')}`)
  await check(page, 'Frosch-Hüpfer results')
  problems.push(...page.errors.map(e => `Frosch-Hüpfer: ${e}`))
  await page.context().close()
}

// 3e. Sortier-Spaß (Fließband-Füttern): every thing off the belt by a tap on
// it and a tap on the monster that eats it; one thing goes to the wrong
// monster first and is spat back; to the results
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Sortier-Spaß, Level/ }).last().click()
  const game = page.locator('[data-module="sort"] [data-phase]')
  await page.locator('[data-thing]').first().waitFor({ timeout: 10000 }).catch(() => problems.push('Fließband: nothing on the belt'))
  let missed = false
  for (let i = 0; i < 300 && (await game.count()); i++) {
    const phase = await game.getAttribute('data-phase').catch(() => null)
    const thing = page.locator('[data-thing][data-mode="belt"]').first()
    if (phase !== 'play' || !(await thing.count())) { await page.waitForTimeout(250); continue }
    const id = await thing.getAttribute('data-thing').catch(() => null)
    const to = await thing.getAttribute('data-to').catch(() => null)
    // the things ride and the monsters bob: no waiting for them to hold still
    await thing.click({ force: true, timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(150)
    if (!id || !(await page.locator(`[data-thing="${id}"][data-mode="picked"]`).count())) continue
    const wrong = !missed && (await game.getAttribute('data-fed')) === '1'
    if (wrong) missed = true
    await page.locator(`[data-target="${wrong ? (to === '0' ? 1 : 0) : to}"]`).click({ force: true, timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(wrong ? 1800 : 900)
    if (wrong && !(await page.locator(`[data-thing="${id}"]`).count())) problems.push('Fließband: the wrong monster kept the thing')
  }
  await page.waitForTimeout(2500)
  const text = await page.evaluate(() => document.body.innerText)
  if (!/7 von 8 gleich beim ersten Mal richtig/.test(text)) problems.push(`Fließband: results not as expected: ${text.slice(0, 120).replace(/\n/g, ' | ')}`)
  await check(page, 'Fließband results')
  problems.push(...page.errors.map(e => `Fließband: ${e}`))
  await page.context().close()
}

// 3f. Zahlen entdecken (Bruno fängt): level 1 to the results, the basket
// steered under every falling fruit; five animals end up at the picnic
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Zahlen entdecken, Level/ }).last().click()
  const game = page.locator('[data-game="bruno"]')
  await game.waitFor({ timeout: 10000 }).catch(() => problems.push('Bruno fängt: the game did not start'))
  let fed = 0
  const t0 = Date.now()
  while (Date.now() - t0 < 180000 && (await game.count())) {
    const s = await page.evaluate(() => {
      const root = document.querySelector('[data-game="bruno"]')
      if (!root) return null
      const mid = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, bottom: r.bottom } }
      return {
        phase: root.dataset.phase, field: mid(root.querySelector('[data-field]')), fed: Number(root.querySelector('[data-picnic]')?.dataset.picnic ?? 0),
        drops: [...root.querySelectorAll('[data-drop^="want"]')].map(mid),
      }
    })
    if (!s) break
    fed = Math.max(fed, s.fed)
    const lowest = s.drops.sort((a, b) => b.y - a.y)[0]
    if (s.phase === 'play' && lowest) await page.mouse.move(lowest.x, s.field.bottom - 30)
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(2500)
  const text = await page.evaluate(() => document.body.innerText)
  if (fed < 4) problems.push(`Bruno fängt: only ${fed} animals at the picnic`)
  if (!/5 von 5 gleich beim ersten Mal richtig/.test(text)) problems.push(`Bruno fängt: results not as expected: ${text.slice(0, 120).replace(/\n/g, ' | ')}`)
  await check(page, 'Bruno fängt results')
  problems.push(...page.errors.map(e => `Bruno fängt: ${e}`))
  await page.context().close()
}

// 3g. Musterpark (Tier-Band): a wrong animal is tried out on the empty stool
// and hops back, the right one finishes the row, and the next row comes
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Musterpark, Level/ }).last().click()
  const game = page.locator('[data-module="patterns"] [data-phase]')
  const phaseIs = async (p, ms) => {
    for (let t = 0; t < ms; t += 100) {
      if ((await game.getAttribute('data-phase').catch(() => null)) === p) return true
      await page.waitForTimeout(100)
    }
    return false
  }
  if (!(await phaseIs('play', 10000))) problems.push('Tier-Band: the row did not start')
  else {
    await check(page, 'Tier-Band')
    await page.locator('[data-card]:not([data-right])').first().click()
    if (!(await phaseIs('demo', 4000))) problems.push('Tier-Band: a wrong animal was not tried out')
    if (!(await phaseIs('play', 15000))) problems.push('Tier-Band: the wrong animal did not hop back')
    if ((await page.locator('[data-card][disabled]').count()) !== 1) problems.push('Tier-Band: the wrong animal is not sitting out')
    await page.locator('[data-card][data-right="1"]').click()
    if (!(await phaseIs('cheer', 4000))) problems.push('Tier-Band: the right animal did not finish the row')
    await page.waitForTimeout(1500)
    const stars = await page.locator('[data-module="patterns"] [data-juice="hud"]').getAttribute('aria-label').catch(() => null)
    if (stars !== '1 Stern') problems.push(`Tier-Band: star counter says "${stars}" after one row`)
    if (!(await phaseIs('play', 30000)) || (await game.getAttribute('data-round')) !== '1') problems.push('Tier-Band: the second row did not come')
  }
  problems.push(...page.errors.map(e => `Tier-Band: ${e}`))
  await page.context().close()
}

// 3h. Anlaut-Angeln: level 1 fished to the results: a tap
// on a swimmer hooks it, the first catch goes into the wrong bucket (the
// frog hands it back) and then into the right one, like all the others
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Anlaut-Angeln, Level/ }).last().click()
  const game = page.locator('[data-game="angeln"]')
  await game.waitFor({ timeout: 10000 }).catch(() => problems.push('Anlaut-Angeln: the game did not start'))
  let wrong = false, sorted = 0
  const t0 = Date.now()
  while (Date.now() - t0 < 150000 && (await game.count())) {
    const s = await page.evaluate(() => {
      const root = document.querySelector('[data-game="angeln"]')
      if (!root) return null
      const held = root.querySelector('[data-swimmer="word"][data-wet="1"]')
      const swimmer = [...root.querySelectorAll('[data-swimmer="word"]')].find(e => e.dataset.dry !== '1' && +getComputedStyle(e).opacity > 0.6)
      const r = swimmer?.getBoundingClientRect()
      return { phase: root.dataset.phase, held: held?.dataset.letter, letters: [...root.querySelectorAll('[data-bucket]')].map(b => b.dataset.bucket), at: r && { x: r.left + r.width / 2, y: r.top + r.height / 2 } }
    })
    if (!s) break
    if (s.phase === 'hold' && s.held) {
      const other = s.letters.find(l => l !== s.held)
      if (!wrong && other) {
        wrong = true
        await page.locator(`[aria-label="Eimer ${other}"]`).click()
        await page.waitForTimeout(2500)
        if (!(await page.locator('[data-game="angeln"] [data-swimmer="word"][data-wet="1"]').count())) problems.push('Anlaut-Angeln: the frog did not hand the catch back')
        continue
      }
      await page.locator(`[aria-label="Eimer ${s.held}"]`).click(); sorted++
      await page.waitForTimeout(900)
    } else if (s.phase === 'fish' && s.at) {
      await page.mouse.click(s.at.x, s.at.y)
      await page.waitForTimeout(1500)
    } else await page.waitForTimeout(300)
  }
  await page.waitForTimeout(2500)
  const text = await page.evaluate(() => document.body.innerText)
  if (sorted < 6) problems.push(`Anlaut-Angeln: only ${sorted} catches sorted`)
  if (!/5 von 6 gleich beim ersten Mal richtig/.test(text)) problems.push(`Anlaut-Angeln: results not as expected: ${text.slice(0, 120).replace(/\n/g, ' | ')}`)
  await check(page, 'Anlaut-Angeln results')
  problems.push(...page.errors.map(e => `Anlaut-Angeln: ${e}`))
  await page.context().close()
}

// 3i. Rechen-Rakete (Planeten-Hüpfer): level 1 flown with the thrust
// button, a hop per number and then the landing button; in the second sum
// one hop too many: someone else lives there, and the rocket flies back to
// the start; to the results
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Rechen-Rakete, Level/ }).last().click()
  const game = page.locator('[data-game="rakete"]')
  await game.waitFor({ timeout: 10000 }).catch(() => problems.push('Planeten-Hüpfer: the game did not start'))
  const state = () => game.evaluate(el => ({ ...el.dataset })).catch(() => null)
  const until = async (ok, ms) => {
    for (let t = 0; t < ms; t += 100) { const s = await state(); if (!s || ok(s)) return s; await page.waitForTimeout(100) }
    return null
  }
  let round = -1, overshot = false
  for (let i = 0; i < 40 && (await game.count()); i++) {
    const s = await until(x => x.phase === 'play', 15000)
    if (!s) break
    if (+s.idx === round) { await page.waitForTimeout(200); continue }
    const steps = Math.abs(+s.target - +s.from)
    const over = !overshot && s.idx === '1' && +s.target < 10
    if (s.idx === '3' || s.idx === '4' || s.idx === '5') {
      // flown by hand: hold the rocket, move slowly to the planet, let go (3);
      // a flame hop to the planet first, then picked up and set down there
      // again: that is the answer too, no tick (4); a quick swipe, let go at
      // once: it flies on to the planet under the finger, slowly, and lands
      // there (5: "Wo du loslässt, landet sie")
      const box = async sel => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
      if (s.idx === '4') {
        for (let k = 0; k < steps; k++) {
          await page.getByRole('button', { name: 'Vorwärts hüpfen' }).click({ timeout: 3000 }).catch(() => {})
          await page.waitForTimeout(520)
        }
        await until(x => x.pos === s.target, 3000)
        await page.waitForTimeout(400)
      }
      const r = await box('[data-rocket]'), p = await box(`[data-planet="${s.target}"] svg`), q = await box('[data-planet="0"] svg')
      const upright = Math.abs(p.y - q.y) > Math.abs(p.x - q.x)
      const to = s.idx === '4' ? (upright ? { x: r.x + 30, y: p.y } : { x: p.x, y: r.y - 30 }) : upright ? { x: r.x, y: p.y } : { x: p.x, y: r.y }
      await page.mouse.move(r.x, r.y); await page.mouse.down()
      const quick = s.idx === '5'
      for (let i = 1; i <= (quick ? 6 : 20); i++) { await page.mouse.move(r.x + (to.x - r.x) * i / (quick ? 6 : 20), r.y + (to.y - r.y) * i / (quick ? 6 : 20)); await page.waitForTimeout(quick ? 50 : 30) }
      if (quick) {
        // let go at once: the rocket has not got there yet
        if ((await state())?.pos === s.target) problems.push('Planeten-Hüpfer: the quick swipe did not outrun the rocket (the test proves nothing)')
      } else await page.waitForTimeout(s.idx === '4' ? 900 : steps * 900 + 800)
      await page.mouse.up()
      const set = await until(x => x.pos === s.target, 9000)
      for (let t = 0; t < 3000 && (await page.locator('[data-flying]').count()); t += 100) await page.waitForTimeout(100)
      if (!set) problems.push(`Planeten-Hüpfer: the rocket flown by hand did not come down on the planet (sum ${+s.idx + 1})`)
      // where it is set down is the answer: no tick needed
      if (!(await until(x => x.phase !== 'play' || +x.idx !== +s.idx, 6000))) problems.push('Planeten-Hüpfer: landing by hand was not taken as the answer')
      round = +s.idx
      await page.waitForTimeout(400)
      continue
    }
    if (s.idx === '2' && +s.target < 10) {
      // one hop too far, then the plain button back: the count goes back with it
      for (let k = 0; k <= steps; k++) {
        await page.getByRole('button', { name: 'Vorwärts hüpfen' }).click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(520)
      }
      await page.getByRole('button', { name: 'Zurück hüpfen' }).click({ timeout: 3000 }).catch(() => problems.push('Planeten-Hüpfer: no button back in level 1'))
      await page.waitForTimeout(600)
      if ((await state())?.pos !== s.target) problems.push('Planeten-Hüpfer: the button back did not hop back')
      await page.getByRole('button', { name: 'Landen' }).click({ timeout: 3000 }).catch(() => {})
      round = +s.idx
      await page.waitForTimeout(400)
      continue
    }
    for (let k = 0; k < steps + (over ? 1 : 0); k++) {
      await page.getByRole('button', { name: 'Vorwärts hüpfen' }).click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(520)
    }
    await page.getByRole('button', { name: 'Landen' }).click({ timeout: 3000 }).catch(() => {})
    if (over) {
      overshot = true
      await page.waitForTimeout(600)
      if (!(await page.locator('[data-creature="resident"]').count())) problems.push('Planeten-Hüpfer: nobody else answered on the wrong planet')
      const back = await until(x => x.phase === 'play', 6000)
      if (back?.pos !== s.from) problems.push('Planeten-Hüpfer: after a wrong landing the rocket is not back at the start')
      continue
    }
    round = +s.idx
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(6000)
  const text = await page.evaluate(() => document.body.innerText)
  if (!/5 von 6 gleich beim ersten Mal richtig/.test(text)) problems.push(`Planeten-Hüpfer: results not as expected: ${text.slice(0, 120).replace(/\n/g, ' | ')}`)
  await check(page, 'Planeten-Hüpfer results')
  problems.push(...page.errors.map(e => `Planeten-Hüpfer: ${e}`))
  await page.context().close()
}

// 3j. Waage-Welt (Wippe-Katapult): level 1 to the results. The first throw
// is the light thing: the mouse only hops, a mark stays on the tree. Then
// the heavy one every time; six animals end up on the branch
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Waage-Welt, Level/ }).last().click()
  const game = page.locator('[data-game="wippe"]')
  await game.waitFor({ timeout: 10000 }).catch(() => problems.push('Wippe-Katapult: the game did not start'))
  const phaseIs = async (p, ms) => {
    for (let t = 0; t < ms; t += 100) {
      const now = await game.getAttribute('data-phase').catch(() => null)
      if (now === p || now === null) return now === p
      await page.waitForTimeout(100)
    }
    return false
  }
  let missed = false, guests = 0
  const t0 = Date.now()
  while (Date.now() - t0 < 150000 && (await game.count())) {
    if (!(await phaseIs('aim', 20000))) break
    const target = await game.getAttribute('data-target')
    const pick = missed ? `[data-item][data-where="ground"][data-w="${target}"]` : `[data-item][data-where="ground"]:not([data-w="${target}"])`
    await page.locator(pick).first().click()
    if (!missed) {
      missed = true
      if (!(await phaseIs('aim', 15000))) { problems.push('Wippe-Katapult: no new try after a light throw'); break }
      if ((await page.locator('[data-mark]').count()) !== 1) problems.push('Wippe-Katapult: no mark on the tree after a throw')
      if ((await game.getAttribute('data-task')) !== '0') problems.push('Wippe-Katapult: a light throw ended the task')
      await check(page, 'Wippe-Katapult after a miss')
      continue
    }
    guests = Math.max(guests, Number(await game.getAttribute('data-guests').catch(() => 0)))
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(5000)
  const text = await page.evaluate(() => document.body.innerText)
  if (!/5 von 6 gleich beim ersten Mal richtig/.test(text)) problems.push(`Wippe-Katapult: results not as expected: ${text.slice(0, 120).replace(/\n/g, ' | ')}`)
  if (guests < 5) problems.push(`Wippe-Katapult: only ${guests} animals on the branch`)
  await check(page, 'Wippe-Katapult results')
  problems.push(...page.errors.map(e => `Wippe-Katapult: ${e}`))
  await page.context().close()
}

// 3k. Hörabenteuer (Hütchenspiel im Gebüsch): level 1 to the results: the
// things hop into their bushes, Lumi calls one, its bush is tapped; at the
// first call a wrong bush first (its thing pops out and goes back in)
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Hörabenteuer, Level/ }).last().click()
  const game = page.locator('[data-game="huetchen"]')
  await game.waitFor({ timeout: 10000 }).catch(() => problems.push('Hütchenspiel: the game did not start'))
  let calls = 0, wrong = false
  const t0 = Date.now()
  while (Date.now() - t0 < 150000 && (await game.count())) {
    const s = await page.evaluate(() => {
      const root = document.querySelector('[data-game="huetchen"]')
      if (!root) return null
      const bushes = [...root.querySelectorAll('[data-bush]')].filter(b => b.dataset.gone !== '1').map(b => ({ id: b.dataset.bush, word: b.dataset.word }))
      return { phase: root.dataset.phase, target: root.dataset.target, bushes }
    })
    if (!s) break
    if (s.phase !== 'find' || !s.target) { await page.waitForTimeout(200); continue }
    if (!wrong) {
      wrong = true
      const other = s.bushes.find(b => b.word !== s.target)
      await page.locator(`[data-bush="${other.id}"]`).click()
      await page.waitForTimeout(400)
      if ((await game.getAttribute('data-phase')) !== 'oops') problems.push('Hütchenspiel: a wrong bush did not show its thing')
      await page.waitForFunction(() => document.querySelector('[data-game="huetchen"]')?.dataset.phase === 'find', null, { timeout: 8000 }).catch(() => problems.push('Hütchenspiel: no new try after a miss'))
      continue
    }
    await page.locator(`[data-bush="${s.bushes.find(b => b.word === s.target).id}"]`).click()
    calls++
    await page.waitForTimeout(1200)
  }
  await page.waitForTimeout(2500)
  const text = await page.evaluate(() => document.body.innerText)
  if (calls < 6) problems.push(`Hütchenspiel: only ${calls} things found`)
  if (!/5 von 6 gleich beim ersten Mal richtig/.test(text)) problems.push(`Hütchenspiel: results not as expected: ${text.slice(0, 120).replace(/\n/g, ' | ')}`)
  await check(page, 'Hütchenspiel results')
  problems.push(...page.errors.map(e => `Hütchenspiel: ${e}`))
  await page.context().close()
}

// 4. Lumi's ideas for today: the last idea from the home screen, the
// movement break the results suggest, the sticker, the album
{
  const p2 = n => String(n).padStart(2, '0')
  const d = new Date(), today = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
  const stops = [{ kind: 'warmup', moduleId: 'number-intro', level: 1 }, { kind: 'new', moduleId: 'letter-intro', level: 1 },
    { kind: 'move' }, { kind: 'new', moduleId: 'emotions', level: 1 }, { kind: 'new', moduleId: 'shadows', level: 1 }]
  const seeded = structuredClone(save)
  seeded.profiles.p1.journey = { date: today, stops, done: [0, 1, 3], chest: null }
  const page = await newPage(SIZES.phone, seeded)
  try {
    await page.goto(URL); await page.waitForTimeout(1500)
    await check(page, 'ideas home')
    await page.getByRole('button', { name: /^Lumis Idee: Schattenrätsel/ }).click()
    await playShadows(page)
    await check(page, 'ideas results')
    await page.getByRole('button', { name: /Bewegungspause/ }).click(); await page.waitForTimeout(1200)
    await check(page, 'movement break')
    await page.getByRole('button', { name: 'Überspringen' }).click(); await page.waitForTimeout(1000)
    await page.getByRole('button', { name: /Weiter spielen/ }).click(); await page.waitForTimeout(1500)
    const got = await page.evaluate(() => JSON.parse(localStorage.getItem('lumilearn_save')).profiles.p1.stickers?.length)
    if (got !== 1) problems.push(`ideas: ${got} stickers after all ideas, expected 1`)
    await page.getByRole('button', { name: /^Mein Album/ }).first().click(); await page.waitForTimeout(1200)
    await check(page, 'album')
  } catch (e) { problems.push(`ideas: ${String(e).split('\n')[0]}`) }
  problems.push(...page.errors.map(e => `ideas: ${e}`))
  await page.context().close()
}

// 5. Offline: once opened online, the app and games never opened before
// still start without a network (public/sw.js)
{
  const page = await newPage(SIZES.tablet, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  const saved = await page.evaluate(async () => {
    await navigator.serviceWorker?.ready
    const pictures = (await (await fetch('media-manifest.json')).json()).length
    for (let i = 0; i < 240; i++) {                 // the worker saves the app and every picture
      const media = (await (await caches.open('lumi-media-v1')).keys()).length
      if (media >= pictures) return media
      await new Promise(r => setTimeout(r, 500))
    }
    return null
  })
  if (!saved) problems.push('offline: the service worker did not save the app')
  await page.context().setOffline(true)
  await page.reload(); await page.waitForTimeout(2000)
  await check(page, 'offline home')
  for (const t of ['Waage-Welt', 'Lumi-Labyrinth', 'Mal-Atelier', 'Formen-Land']) {
    try {
      await page.getByRole('button', { name: new RegExp(`^${t}(?:, Level|\\. Spielen$)`) }).last().click(); await page.waitForTimeout(1800)
      await check(page, `offline ${t}`)
      await page.getByRole('button', { name: 'Spiel verlassen' }).click(); await page.waitForTimeout(300)
      await page.getByRole('button', { name: /Aufhören/ }).click(); await page.waitForTimeout(800)
    } catch (e) { problems.push(`offline ${t}: ${String(e).split('\n')[0]}`) }
  }
  problems.push(...page.errors.filter(e => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).map(e => `offline: ${e}`))
  await page.context().close()
}

// 6. A game played for the first time explains itself: the help box is up
// before the game starts, a tap outside does not close it, and the game
// begins when it is ticked off. The second time the game starts at once.
{
  const fresh = structuredClone(save)
  fresh.profiles.p1.helpSeen = {}
  const page = await newPage(SIZES.phone, fresh)
  try {
    await page.goto(URL); await page.waitForTimeout(1500)
    const open = async () => { await page.getByRole('button', { name: /^Sortier-Spaß(?:, Level|\. Spielen$)/ }).last().click(); await page.waitForTimeout(1500) }
    await open()
    const box = page.locator('[data-help="first"]')
    if (!(await box.count())) problems.push('first help: no help box when a game is opened for the first time')
    await check(page, 'first help')
    if (await page.locator('.pl-game [data-belt], .pl-game button').count()) problems.push('first help: the game runs behind the help box')
    await page.mouse.click(4, 300); await page.waitForTimeout(400)
    if (!(await box.count())) problems.push('first help: a tap outside closed the box')
    const ok = page.locator('[data-help-ok]')
    await ok.waitFor({ state: 'visible' })
    // green and ready at once: a child need not wait for the reading
    if (await ok.isDisabled()) problems.push('first help: the tick is not ready at once')
    await ok.click({ force: true }); await page.waitForTimeout(1800)
    if (await box.count()) problems.push('first help: the box stayed after the tick')
    if (!(await page.locator('.pl-game button').count())) problems.push('first help: no game after the tick')
    await check(page, 'first help → game')
    await page.getByRole('button', { name: 'Spiel verlassen' }).click(); await page.waitForTimeout(300)
    await page.getByRole('button', { name: /Aufhören/ }).click(); await page.waitForTimeout(800)
    await open()
    if (await box.count()) problems.push('first help: the box came a second time')
  } catch (e) { problems.push(`first help: ${String(e).split('\n')[0]}`) }
  problems.push(...page.errors.map(e => `first help: ${e}`))
  await page.context().close()
}

// 7. Lumis Kleiderschrank. A child without stars finds the sign on the
// button, five picture tabs, the free thing glowing on the first one, at
// most two wrapped presents per place and a pile for the rest. A child with
// enough stars puts on the first thing of every place (one tab after the
// other), Lumi wears all five in the wardrobe and in a game's top bar, and
// the plain-Lumi button takes everything off at once. The things are read
// from the list (src/lib/wardrobe.js), so the test follows its order.
{
  const firstOf = slot => WARDROBE.find(t => t.slot === slot)
  const allFive = Math.max(...SLOTS.map(s => firstOf(s).stars))
  // stars spread over a few games, three a level
  const progressWith = n => {
    const ids = ['shapes-land', 'rhyme', 'listen', 'shadows', 'sort', 'clock']
    const prog = {}
    for (let i = 0; n > 0; i++) {
      const id = ids[Math.floor(i / 10)], lv = (i % 10) + 1
      prog[id] = prog[id] ?? { currentLevel: 1, levelStars: {}, plays: 1 }
      prog[id].levelStars[lv] = Math.min(3, n); prog[id].currentLevel = Math.min(10, lv + 1)
      n -= 3
    }
    return prog
  }
  for (const [size, stars] of [[SIZES.phone, 0], [SIZES.tablet, allFive]]) {
    const kid = structuredClone(save)
    kid.profiles.p1.progress = progressWith(stars)
    const page = await newPage(size, kid)
    const where = `wardrobe (${stars} stars)`
    const shelf = () => page.$$eval('[data-thing]', b => b.map(x => [x.dataset.thing, x.dataset.state]))
    const worn = () => page.$$eval('.pl-critter [data-wear]', b => b.map(x => x.dataset.wear).sort())
    try {
      await page.goto(URL); await page.waitForTimeout(1500)
      if (!(await page.locator('[data-wardrobe-new]').count())) problems.push(`${where}: no sign on the wardrobe button`)
      await page.getByRole('button', { name: /^Lumis Kleiderschrank/ }).click(); await page.waitForTimeout(1500)
      await check(page, where)
      if ((await page.locator('[data-tab]').count()) !== SLOTS.length) problems.push(`${where}: not ${SLOTS.length} tabs`)
      if (stars === 0) {
        const states = await shelf()
        if (!states.some(([, st]) => st === 'new')) problems.push(`${where}: no free thing on the first tab`)
        for (const slot of SLOTS) {
          await page.locator(`[data-tab="${slot}"]`).click(); await page.waitForTimeout(500)
          const st = (await shelf()).map(([, x]) => x)
          // two presents and a pile; one left over is a present of its own, not a pile of one
          const left = WARDROBE.filter(t => t.slot === slot && t.stars > 0).length
          if (st.filter(x => x === 'next' || x === 'locked').length !== Math.min(left, left === 3 ? 3 : 2)) problems.push(`${where}: not two presents on ${slot}`)
          if (left > 3 && !(await page.locator('[data-pile]').count())) problems.push(`${where}: no pile on ${slot}`)
          // a tap on the pile: the next present shakes with it, the bubble shows what its tile shows
          if (left > 3) {
            await page.locator('[data-pile]').click(); await page.waitForTimeout(150)
            const next = await page.locator('[data-state="next"] [data-progress]').getAttribute('data-progress')
            const bubble = await page.locator('[data-wish] [role="img"]').getAttribute('data-bubble')
            const span = +next.split('/')[1]
            if (bubble !== (span <= 5 ? next : 'bar')) problems.push(`${where}: the bubble (${bubble}) is not the tile (${next}) on ${slot}`)
            await page.waitForTimeout(2700)
          }
        }
        await check(page, `${where}, last tab`)
      } else {
        for (const slot of SLOTS) {
          await page.locator(`[data-tab="${slot}"]`).click(); await page.waitForTimeout(500)
          await page.locator(`[data-thing="${firstOf(slot).id}"]`).click(); await page.waitForTimeout(1600)
        }
        const all = SLOTS.map(s => firstOf(s).id).sort()
        if (String(await worn()) !== String(all)) problems.push(`${where}: Lumi wears ${await worn()}, not ${all}`)
        await check(page, `${where}, all five on`)
        await page.getByRole('button', { name: 'Zur Startseite' }).click(); await page.waitForTimeout(1200)
        if (await page.locator('[data-wardrobe-new]').count()) problems.push(`${where}: the sign stayed after the visit`)
        await page.getByRole('button', { name: /^Zahlenland(?:, Level|\. Spielen$)/ }).last().click(); await page.waitForTimeout(2000)
        for (const id of all) {
          if (!(await page.locator(`[data-lumi-buddy] [data-wear="${id}"]`).count())) problems.push(`${where}: Lumi in the game bar does not wear ${id}`)
        }
        await check(page, `${where} → game`)
        await page.getByRole('button', { name: 'Spiel verlassen' }).click(); await page.waitForTimeout(300)
        await page.getByRole('button', { name: /Aufhören/ }).click(); await page.waitForTimeout(1000)
        await page.getByRole('button', { name: /^Lumis Kleiderschrank/ }).click(); await page.waitForTimeout(1500)
        await page.locator('[data-undress]').click(); await page.waitForTimeout(1000)
        if ((await worn()).length) problems.push(`${where}: still worn after "everything off": ${await worn()}`)
      }
    } catch (e) { problems.push(`${where}: ${String(e).split('\n')[0]}`) }
    problems.push(...page.errors.map(e => `${where}: ${e}`))
    await page.context().close()
  }
}

// 7b. All stars (690): every place's shelf at a tablet, a phone upright and
// a phone sideways. Tiles never smaller than 64 px; what does not fit is
// below a clear "more below" arrow, and scrolling shows the last thing.
{
  const kid = structuredClone(save)
  // (the stars ever earned count for the wardrobe)
  kid.profiles.p1.starsEver = 690
  kid.profiles.p1.progress = { 'shapes-land': { currentLevel: 10, levelStars: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 3])), plays: 1 } }
  for (const size of [[1024, 768], [390, 844], [844, 390]]) {
    const page = await newPage(size, kid)
    const where = `wardrobe full (${size.join('×')})`
    try {
      await page.goto(URL); await page.waitForTimeout(1200)
      await page.getByRole('button', { name: /^Lumis Kleiderschrank/ }).click(); await page.waitForTimeout(1500)
      for (const slot of SLOTS) {
        await page.locator(`[data-tab="${slot}"]`).click(); await page.waitForTimeout(900)
        const r = await page.$eval('[data-shelf]', el => ({ tile: +el.dataset.tile, over: el.scrollHeight - el.clientHeight, n: el.querySelectorAll('[data-thing]').length }))
        const want = WARDROBE.filter(t => t.slot === slot).length
        if (r.n !== want) problems.push(`${where}: ${r.n} of ${want} things on ${slot}`)
        if (r.tile < 64) problems.push(`${where}: tiles of ${r.tile} px on ${slot}`)
        const arrow = await page.locator('[data-more]').count()
        if (r.over > 6 && !arrow) problems.push(`${where}: things hidden below without the arrow on ${slot}`)
        if (r.over > 6) {
          for (let k = 0; k < 12 && await page.locator('[data-more]').count(); k++) { await page.locator('[data-more]').click({ force: true }); await page.waitForTimeout(450) }
          const lastId = WARDROBE.filter(t => t.slot === slot).at(-1).id
          const seen = await page.$eval(`[data-thing="${lastId}"]`, el => { const a = el.getBoundingClientRect(), b = el.closest('[data-shelf]').getBoundingClientRect(); return a.bottom <= b.bottom + 2 && a.top >= b.top - 2 })
          if (!seen) problems.push(`${where}: the last thing on ${slot} cannot be reached with the arrow`)
        }
        await check(page, `${where}, ${slot}`)
      }
    } catch (e) { problems.push(`${where}: ${String(e).split('\n')[0]}`) }
    problems.push(...page.errors.map(e => `${where}: ${e}`))
    await page.context().close()
  }
}

// 8. Lumi verwandelt sich. A new child chooses its Lumi on the ring (a
// second child too, from the child picker), and it is Lumi everywhere: home,
// its picture in the bar, a game's bar. A child from before the shapes is
// offered the free first choice by itself. A child that reached a step gets
// the new shape as the big thing of the results and chooses it on the
// ring: the arrows, a drag, a swipe and a tap at the side each turn the ring
// by exactly one, turning alone changes nothing, the tick does.
{
  const withStars = n => {
    const levelStars = {}
    for (let l = 1; n > 0; l++) { levelStars[l] = Math.min(3, n); n -= 3 }
    return { 'shapes-land': { currentLevel: 1, levelStars, plays: 1 } }
  }
  const kidWith = (stars, more = {}) => {
    const k = structuredClone(save)
    Object.assign(k.profiles.p1, { progress: withStars(stars), ...more })
    return k
  }
  const front = page => page.getAttribute('[data-ring]', 'data-ring')
  const idx = id => SHAPE_IDS.indexOf(id)
  const turned = async (page, before, d, how, where) => {
    const now = await front(page)
    const want = SHAPE_IDS[(idx(before) + d + SHAPE_IDS.length) % SHAPE_IDS.length]
    console.log(`  ${where}: ${how}: ${before} → ${now}`)
    if (now !== want) problems.push(`${where}: ${how} turned to ${now}, not ${want}`)
    return now
  }
  // 8a: the very first start: a child is made with its Lumi, then a second one
  for (const [size, tag] of [[[390, 844], 'phone'], [SIZES.tablet, 'tablet'], [[844, 390], 'phone sideways']]) {
    const where = `shapes (first start, ${tag})`
    const page = await newPage(size)
    try {
      await page.goto(URL); await page.waitForTimeout(1200)
      await page.getByRole('button', { name: /Los geht/ }).click(); await page.waitForTimeout(1200)
      if (!(await page.locator('[data-shape-start]').count())) problems.push(`${where}: creating a child does not start with the ring`)
      await check(page, `${where}, ring`)
      await page.locator('[data-turn="left"]').click(); await page.waitForTimeout(900)
      const chosen = await front(page)
      await page.locator(`[data-confirm="${chosen}"]`).click({ force: true }); await page.waitForTimeout(2000)
      await page.getByRole('button', { name: '5', exact: true }).click()
      await check(page, `${where}, age`)
      await page.getByRole('button', { name: /Los geht/ }).click(); await page.waitForTimeout(2200)
      const lumi = await page.locator('.pl-critter [data-lumi-shape]').first().getAttribute('data-lumi-shape').catch(() => null)
      if (lumi !== chosen) problems.push(`${where}: Lumi at home is ${lumi}, not ${chosen}`)
      if (!(await page.locator(`button[aria-label="Profil wechseln"] [data-child-lumi="${chosen}"]`).count())) problems.push(`${where}: the child's picture is not its Lumi`)
      await check(page, `${where}, home`)
      // a second child from the child picker
      await page.getByRole('button', { name: 'Profil wechseln' }).click(); await page.waitForTimeout(800)
      await page.getByRole('button', { name: /Neues Kind|Kind hinzufügen|➕/ }).first().click(); await page.waitForTimeout(1500)
      if (!(await page.locator('[data-shape-start]').count())) problems.push(`${where}: a second child does not start with the ring`)
      await page.locator('[data-confirm]').click({ force: true }); await page.waitForTimeout(2000)
      await page.getByRole('button', { name: '6', exact: true }).click()
      await page.getByRole('button', { name: /Los geht/ }).click(); await page.waitForTimeout(2000)
      if (!(await page.locator('button[aria-label="Profil wechseln"] [data-child-lumi="chick"]').count())) problems.push(`${where}: the second child's picture is not the chick it chose`)
    } catch (e) { problems.push(`${where}: ${String(e).split('\n')[0]}`) }
    problems.push(...page.errors.map(e => `${where}: ${e}`))
    await page.context().close()
  }
  // 8b: a child from before the shapes: the ring opens by itself, leaving keeps the chick
  {
    const where = 'shapes (old save)'
    const page = await newPage([390, 844], kidWith(30, { shapePicked: undefined, shapes: undefined, shape: undefined }))
    try {
      await page.goto(URL); await page.waitForTimeout(2600)
      if ((await page.getAttribute('[data-shapes-screen]', 'data-shapes-screen').catch(() => null)) !== 'first') problems.push(`${where}: the free first choice did not open`)
      await page.getByRole('button', { name: 'Zur Startseite' }).click(); await page.waitForTimeout(1500)
      if (await page.locator('.pl-critter [data-lumi-shape]').count()) problems.push(`${where}: Lumi is not the chick after leaving`)
      if (!(await page.locator('[data-shape-present]').count())) problems.push(`${where}: no present beside Lumi while the choice waits`)
      await check(page, `${where}, home`)
    } catch (e) { problems.push(`${where}: ${String(e).split('\n')[0]}`) }
    problems.push(...page.errors.map(e => `${where}: ${e}`))
    await page.context().close()
  }
  // 8c: a new shape won: the results say it big, the ring chooses it; every way of turning turns by one
  {
    const where = 'shapes (won, tablet)'
    const page = await newPage(SIZES.tablet, kidWith(STEPS[0] + 2, { shapePicked: true, shapes: ['dino'], shape: 'dino' }))
    try {
      await page.goto(URL); await page.waitForTimeout(1500)
      if (!(await page.locator('[data-shapes-owed], [data-shape-present]').count())) problems.push(`${where}: no sign on the home screen`)
      await page.locator('[data-shape-present]').click(); await page.waitForTimeout(1500)
      if ((await page.getAttribute('[data-shapes-screen]', 'data-shapes-screen')) !== 'choose') problems.push(`${where}: the ring is not in choosing`)
      await check(page, where)
      let f = await front(page)
      await page.locator('[data-turn="right"]').click(); await page.waitForTimeout(1000)
      f = await turned(page, f, 1, 'arrow right', where)
      await page.locator('[data-turn="left"]').click(); await page.waitForTimeout(1000)
      f = await turned(page, f, -1, 'arrow left', where)
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1000)
      f = await turned(page, f, 1, 'key right', where)
      // a slow drag of a little more than one shape's width to the left
      const box = await page.locator('[data-ring]').boundingBox()
      const cy = box.y + box.height * 0.6
      await page.mouse.move(box.x + box.width / 2 + 100, cy); await page.mouse.down()
      for (let i = 1; i <= 20; i++) { await page.mouse.move(box.x + box.width / 2 + 100 - i * 16, cy); await page.waitForTimeout(30) }
      await page.mouse.up(); await page.waitForTimeout(1100)
      f = await turned(page, f, 1, 'drag left', where)
      // a quick short swipe to the right
      await page.mouse.move(box.x + box.width / 2 - 60, cy); await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2, cy, { steps: 3 }); await page.mouse.up(); await page.waitForTimeout(1100)
      f = await turned(page, f, -1, 'swipe right', where)
      // a tap on the shape just right of the front one
      const right = SHAPE_IDS[(idx(f) + 1) % SHAPE_IDS.length]
      await page.locator(`[data-shape="${right}"]`).click({ force: true }); await page.waitForTimeout(1100)
      f = await turned(page, f, 1, 'tap at the side', where)
      if (await page.locator('[data-move-in], [data-hud-lumi] [data-lumi-shape="dino"]').count() !== 1) problems.push(`${where}: turning changed who Lumi is`)
      // choose the one in front (a shape not owned yet), with a quick double tap
      const pick = f === 'dino' ? null : f
      if (pick) {
        await page.locator(`[data-confirm="${pick}"]`).dblclick({ force: true }); await page.waitForTimeout(1600)
        await page.getByRole('button', { name: 'Zur Startseite' }).click(); await page.waitForTimeout(1500)
        const lumi = await page.locator('.pl-critter [data-lumi-shape]').first().getAttribute('data-lumi-shape').catch(() => 'chick')
        if (lumi !== (pick === 'chick' ? 'chick' : pick)) problems.push(`${where}: after choosing ${pick} Lumi at home is ${lumi}`)
        await page.getByRole('button', { name: /^Zahlenland(?:, Level|\. Spielen$)/ }).last().click(); await page.waitForTimeout(2000)
        const bar = await page.locator('[data-lumi-buddy] [data-lumi-shape]').first().getAttribute('data-lumi-shape').catch(() => 'chick')
        if (bar !== pick) problems.push(`${where}: Lumi in the game bar is ${bar}, not ${pick}`)
        await check(page, `${where} → game`)
      }
    } catch (e) { problems.push(`${where}: ${String(e).split('\n')[0]}`) }
    problems.push(...page.errors.map(e => `${where}: ${e}`))
    await page.context().close()
  }
}

await browser.close()
if (problems.length) {
  console.error(`${problems.length} problem(s):\n- ` + problems.join('\n- '))
  process.exit(1)
}
console.log('smoke test passed')
