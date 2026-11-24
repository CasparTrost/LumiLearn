import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import emojiArt from './build/babel-plugin-emoji-art.js'

// Every picture in public/sprites and public/images, for the service worker
// to save in the background (offline play, see public/sw.js). Recordings and
// music stay out: speech works without them, and they are the heavy part.
function mediaManifest() {
  const list = dir => readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? list(p) : /\.(webp|png|gif|jpg|svg)$/.test(f) ? [p] : []
  })
  let outDir = 'dist'
  return {
    name: 'media-manifest',
    apply: 'build',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir) },
    closeBundle() {
      const files = ['public/sprites', 'public/images'].flatMap(d => list(d)).map(p => relative('public', p).split('\\').join('/'))
      writeFileSync(join(outDir, 'media-manifest.json'), JSON.stringify(files))
    },
  }
}

export default defineConfig({
  base: '/LumiLearn/',
  // emojiArt: emoji in the UI become pictures (see the plugin)
  plugins: [react({ babel: { plugins: [emojiArt] } }), mediaManifest()],
  // the list of program files the service worker saves for offline play
  build: { manifest: 'asset-manifest.json' },
  server: {
    port: 3000,
    open: true,
  },
})
