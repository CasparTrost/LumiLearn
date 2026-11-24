export const BASE = import.meta.env.BASE_URL ?? '/'
export const asset = (path) => BASE.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
export const journeyArt = f => asset('sprites/journey/' + f)

// Lumi in the cartoon style of all other pictures (made with Tripo), one
// picture per pose. Any mood a game uses maps to the nearest pose. The pixel
// Lumi stays only in the maze, a pixel world of its own.
const LUMI_POSE = {
  happy: 'happy', dance: 'happy', eat: 'happy', excited: 'happy', encouraging: 'happy', cheer: 'happy', proud: 'happy',
  sad: 'sad',
  oops: 'think', think: 'think', thinking: 'think', curious: 'think',
  sleep: 'sleep', sleepy: 'sleep', tired: 'sleep',
  wave: 'wave', hello: 'wave',
}
export const lumiArt = (mood = 'idle') => asset(`sprites/emoji/custom/lumi-${LUMI_POSE[mood] ?? 'idle'}.webp`)
