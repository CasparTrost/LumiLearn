// Browser smoke test against a production build (npm run build; npx vite preview).
// Fresh child on a phone through onboarding; every game opened at phone,
// tablet and desktop size; one game played to the results. Fails on page
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
  const r = await page.evaluate(() => {
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
  const crashed = await page.getByText(/gestolpert|Etwas ist schiefgegangen/).count()
  if (crashed) problems.push(`${where}: error screen`)
  if (r.sideways) problems.push(`${where}: scrolls sideways`)
  if (r.off.length) problems.push(`${where}: off screen: ${r.off.join(', ')}`)
  if (r.broken.length) problems.push(`${where}: pictures not loading: ${r.broken.join(', ')}`)
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

// 3. One game to the end: the shadow riddle, answered from the picture shown
{
  const page = await newPage(SIZES.phone, save)
  await page.goto(URL); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Schattenrätsel, Level/ }).last().click(); await page.waitForTimeout(2000)
  for (let round = 0; round < 12; round++) {
    const target = await page.evaluate(() => [...document.querySelectorAll('img.emo')]
      .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]?.src.split('/').pop())
    if (!target || !(await page.getByRole('button', { name: 'Spiel verlassen' }).count())) break
    await page.locator(`button:has(img[src$="${target}"])`).first().click(); await page.waitForTimeout(1200)
    const next = page.getByRole('button', { name: /Weiter|Fertig/ })
    if (await next.count()) { await next.first().click(); await page.waitForTimeout(1500) }
  }
  await page.waitForTimeout(2500)
  const text = await page.evaluate(() => document.body.innerText)
  if (!/8 von 8 gleich beim ersten Mal richtig/.test(text)) problems.push(`full game: results not as expected: ${text.slice(0, 120).replace(/\n/g, ' | ')}`)
  await check(page, 'results')
  problems.push(...page.errors.map(e => `full game: ${e}`))
  await page.context().close()
}

await browser.close()
if (problems.length) {
  console.error(`${problems.length} problem(s):\n- ` + problems.join('\n- '))
  process.exit(1)
}
console.log('smoke test passed')
