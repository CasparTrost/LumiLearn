// Browser smoke test against a production build (npm run build; npx vite preview).
// Fresh child on a phone through onboarding; every game opened at phone,
// tablet and desktop size; one game played to the results; Lumi's ideas to the sticker; the app and
// unopened games started again without a network. Fails on page
// errors, pictures that don't load, sideways scrolling and buttons off the
// screen.
//
//   URL=http://localhost:4173/LumiLearn/ node tests/e2e/smoke.mjs
// CHROMIUM=/path/to/chrome uses a browser other than Playwright's own.
import { chromium } from 'playwright'

const URL = process.env.URL ?? 'http://localhost:4173/LumiLearn/'
const SIZES = { phone: [360, 740], tablet: [1024, 768], desktop: [1440, 900] }
const save = { version: 2, language: 'de', activeProfileId: 'p1', settings: { parentPin: '1234', pinIsDefault: true },
  profiles: { p1: { id: 'p1', name: 'Mia', age: 7, avatar: '🦊', progress: {}, streak: { count: 0, lastDate: null },
    dailyMission: { date: null, missions: [], completedIds: [] }, lastPlayed: null } } }
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
  await page.getByRole('button', { name: 'Eule' }).click(); await page.waitForTimeout(1000)
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
    .map(b => b.getAttribute('aria-label').match(/^(.+?), Level/)?.[1]).filter(Boolean))])
  if (titles.length < 24) problems.push(`${size}: only ${titles.length} games on the home screen`)
  for (const t of titles) {
    try {
      await page.getByRole('button', { name: new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, Level`) }).last().click()
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

// Plays the shadow riddle to the results, answering from the picture shown
async function playShadows(page) {
  for (let round = 0; round < 12; round++) {
    const target = await page.evaluate(() => [...document.querySelectorAll('img.emo')]
      .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]?.src.split('/').pop())
    if (!target || !(await page.getByRole('button', { name: 'Spiel verlassen' }).count())) break
    await page.locator(`[role="button"]:has(img[src$="${target}"]), button:has(img[src$="${target}"])`).first().click(); await page.waitForTimeout(1200)
    const next = page.getByRole('button', { name: /Weiter|Fertig/ })
    if (await next.count()) { await next.first().click(); await page.waitForTimeout(1500) }
  }
  await page.waitForTimeout(2500)
}

// 3. One game to the end
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Schattenrätsel, Level/ }).last().click(); await page.waitForTimeout(2000)
  await playShadows(page)
  const text = await page.evaluate(() => document.body.innerText)
  if (!/8 von 8 gleich beim ersten Mal richtig/.test(text)) problems.push(`full game: results not as expected: ${text.slice(0, 120).replace(/\n/g, ' | ')}`)
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

// 3c. Musterpark (Tier-Band): a wrong animal is tried out on the empty stool
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
    await page.getByRole('button', { name: /^Lumis Idee: Schattenrätsel/ }).click(); await page.waitForTimeout(2000)
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
      await page.getByRole('button', { name: new RegExp(`^${t}, Level`) }).last().click(); await page.waitForTimeout(1800)
      await check(page, `offline ${t}`)
      await page.getByRole('button', { name: 'Spiel verlassen' }).click(); await page.waitForTimeout(300)
      await page.getByRole('button', { name: /Aufhören/ }).click(); await page.waitForTimeout(800)
    } catch (e) { problems.push(`offline ${t}: ${String(e).split('\n')[0]}`) }
  }
  problems.push(...page.errors.filter(e => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).map(e => `offline: ${e}`))
  await page.context().close()
}

await browser.close()
if (problems.length) {
  console.error(`${problems.length} problem(s):\n- ` + problems.join('\n- '))
  process.exit(1)
}
console.log('smoke test passed')
