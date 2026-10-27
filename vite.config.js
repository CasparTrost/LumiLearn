import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import emojiArt from './build/babel-plugin-emoji-art.js'

export default defineConfig({
  base: '/LumiLearn/',
  // emojiArt: emoji in the UI become pixel-art pictures (see the plugin)
  plugins: [react({ babel: { plugins: [emojiArt] } })],
  server: {
    port: 3000,
    open: true,
  },
})
