import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/LumiLearn/',
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
})
// cache bust: 20260414072604
// 095757
// 101006
// rebuild 102128
// 110131
// 110957
// 143620
// 180754
// 183323
// 192239
// 192311
// 192503
// 062016
// 063104
// 080427
// 080924
