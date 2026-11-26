import { currentShape, shapeSrc } from './shapes.js'
export const BASE = import.meta.env.BASE_URL ?? '/'
export const asset = (path) => BASE.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
export const journeyArt = f => asset('sprites/journey/' + f)

// Lumi in the cartoon style of all other pictures (made with Tripo), one
// picture per pose. Any mood a game uses maps to the nearest pose. The pixel
// Lumi stays only in the maze, a pixel world of its own.
// 'hmm' is the thinking pose without the question mark drawn next to the
// head: Lumi's face after a miss ('oops'). The "?" stays for 'think' only.
const LUMI_POSE = {
  happy: 'happy', dance: 'happy', hop: 'happy', eat: 'happy', excited: 'happy', encouraging: 'happy', cheer: 'happy', proud: 'happy',
  sad: 'sad',
  oops: 'hmm', hmm: 'hmm', think: 'think', thinking: 'think', curious: 'think',
  sleep: 'sleep', sleepy: 'sleep', tired: 'sleep',
  wave: 'wave', hello: 'wave',
}
// in the shape the playing child chose for Lumi (lib/shapes.js)
export const lumiArt = (mood = 'idle') => asset(shapeSrc(currentShape(), LUMI_POSE[mood] ?? 'idle'))
