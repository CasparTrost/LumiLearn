// LumiLearn service worker: the app keeps working without a network.
//
// An earlier worker served what it had cached forever and kept children on
// an old version after every update; it was replaced by one that removed
// itself. This one is careful about exactly that:
//   • the page (index.html) always comes from the network first, the saved
//     copy only when there is no network — an update is never held back;
//   • the program files have a checksum in their name, so a saved copy is
//     never wrong; the ones a new version no longer lists are deleted
//     (asset-manifest.json, written by the build);
//   • pictures and recordings come from the cache at once and are refreshed
//     in the background; all pictures are saved once after the first visit
//     (media-manifest.json), unless the device asks to save data (the
//     clothes painted onto a figure only for the figures the children on
//     the device have, the others when first shown);
//   • range requests (how Safari fetches audio) pass through untouched:
//     Safari plays nothing from a cached full response.
const SHELL = 'lumi-shell-v1'
const MEDIA = 'lumi-media-v1'
const KEEP = [SHELL, MEDIA]
const SCOPE = new URL(self.registration.scope).pathname          // /LumiLearn/
const INDEX = SCOPE + 'index.html'
const MEDIA_DIRS = ['sprites/', 'images/', 'audio/'].map(d => SCOPE + d)
const FONTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']
// Servers add Vary (Origin, Accept-Encoding); a module script asks with an
// Origin header, the copy saved by this worker was fetched without one —
// with Vary honoured the saved copy never matched, and offline the app
// stayed white.
const MATCH = { ignoreVary: true }

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k)
    await self.clients.claim()
    await cacheApp()
  })())
})

// The page asks once per start (online): save every program file of this
// version, so any game opens offline later, and drop the old ones.
self.addEventListener('message', event => {
  if (event.data?.type === 'cache-app') event.waitUntil(cacheApp(event.data.figures))
})

async function cacheApp(figures) {
  let manifest
  try {
    const res = await fetch(SCOPE + 'asset-manifest.json', { cache: 'no-store' })
    if (!res.ok) return
    manifest = await res.json()
  } catch { return }                                              // offline: keep what we have
  const files = new Set([INDEX])
  for (const entry of Object.values(manifest)) {
    files.add(SCOPE + entry.file)
    for (const css of entry.css ?? []) files.add(SCOPE + css)
  }
  const cache = await caches.open(SHELL)
  // the page itself: on the very first visit it loaded before this worker ran
  try {
    const res = await fetch(SCOPE, { cache: 'no-store' })
    if (res.ok) {
      await cache.put(INDEX, res.clone())
      await cacheFonts(cache, await res.text())
    }
  } catch { /* offline */ }
  // old program files only; the page and the fonts stay
  for (const req of await cache.keys()) {
    const url = new URL(req.url)
    if (url.origin === location.origin && url.pathname.startsWith(SCOPE + 'assets/') && !files.has(url.pathname)) await cache.delete(req)
  }
  await fill(cache, [...files].filter(f => f !== INDEX))
  if (!navigator.connection?.saveData) await cacheMedia(figures)
}

// The Google Fonts stylesheet the page links to and the font files it
// names, so the app looks the same offline.
async function cacheFonts(cache, html) {
  for (const [, href] of html.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/[^"]+)"/g)) {
    const url = href.replace(/&amp;/g, '&')
    if (await cache.match(url, MATCH)) continue
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) continue
      await cache.put(url, res.clone())
      const fonts = [...(await res.text()).matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1])
      await fill(cache, fonts)
    } catch { /* next start */ }
  }
}

// The clothes painted onto a figure (sprites/wardrobe/worn/<figure>/, half
// of all pictures) only for the figures the page names (those its children
// have); the others are saved when first shown (fetch below). Without names
// (activated before the page spoke) none of them.
const WORN = /^sprites\/wardrobe\/worn\/([^/]+)\//
async function cacheMedia(figures = []) {
  let list
  try {
    const res = await fetch(SCOPE + 'media-manifest.json', { cache: 'no-store' })
    if (!res.ok) return
    list = await res.json()
  } catch { return }
  const wanted = f => { const m = WORN.exec(f); return !m || figures.includes(m[1]) }
  await fill(await caches.open(MEDIA), list.filter(wanted).map(f => SCOPE + f))
}

// what is not saved yet, a few at a time so the game being played still loads
async function fill(cache, urls) {
  const todo = []
  for (const u of urls) if (!(await cache.match(u, MATCH))) todo.push(u)
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(todo.slice(i, i + 6).map(async u => {
      try {
        const res = await fetch(u)
        if (res.ok) await cache.put(u, res)
      } catch { /* next start tries again */ }
    }))
  }
}

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET' || req.headers.has('range')) return
  const url = new URL(req.url)

  if (req.mode === 'navigate' && url.pathname.startsWith(SCOPE)) {
    event.respondWith(page(req))
  } else if (url.origin === location.origin && url.pathname.startsWith(SCOPE + 'assets/')) {
    event.respondWith(cacheFirst(req, SHELL))
  } else if (url.origin === location.origin && MEDIA_DIRS.some(d => url.pathname.startsWith(d))) {
    event.respondWith(fromCacheThenRefresh(event, req, MEDIA))
  } else if (FONTS.includes(url.origin)) {
    event.respondWith(fromCacheThenRefresh(event, req, SHELL))
  }
})

async function page(req) {
  const cache = await caches.open(SHELL)
  try {
    // a slow network still wins over the saved page for 4 seconds
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 4000)),
    ])
    if (res.ok) await cache.put(INDEX, res.clone())
    return res
  } catch {
    return (await cache.match(INDEX, MATCH)) ?? Response.error()
  }
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(req, MATCH)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) await cache.put(req, res.clone())
  return res
}

async function fromCacheThenRefresh(event, req, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(req, MATCH)
  const refresh = fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') return cache.put(req, res.clone()).then(() => res)
    return res
  })
  if (hit) {
    event.waitUntil(refresh.catch(() => {}))
    return hit
  }
  return refresh
}
