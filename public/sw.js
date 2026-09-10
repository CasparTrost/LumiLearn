// Self-destruct service worker.
//
// LumiLearn no longer uses a service worker. This file exists ONLY to
// clean up any old service worker that might still be registered in a
// visitor's browser from a previous deployment — without it, a browser
// that has one already installed will keep serving whatever it cached
// back then FOREVER, because deleting this file outright (as a previous
// cleanup did) makes the browser's automatic update-check for the
// already-registered worker fail silently (404), leaving the stale
// worker in full control with no way to reach it again.
//
// Do not delete this file. If it is ever safe to remove, first bump
// CACHE_BUSTER below a few times across deploys to make sure it has had
// a chance to reach everyone, THEN keep an empty stub in its place.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Drop every cache this (or any previous) worker may have created.
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))),
      self.registration.unregister(),
    ]).then(() => self.clients.matchAll({ type: 'window' })).then(clients => {
      clients.forEach(c => c.navigate(c.url))
    })
  )
})

// CACHE_BUSTER: 2
