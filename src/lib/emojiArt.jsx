/**
 * Emoji -> pixel-art picture. Called by the build step for every child of
 * an HTML element (build/babel-plugin-emoji-art.js); anything that is not a
 * string containing an emoji comes back untouched.
 *
 * Pictures: public/sprites/emoji/<codepoints>.png, made with gpt-image-2,
 * named by the emoji's code points without the variation selector and the
 * zero-width joiner (🍎 -> 1f34e.png, 👨‍🍳 -> 1f468-1f373.png). An emoji
 * without a picture stays an emoji.
 */
import { EMOJI_ART } from './emojiArtList.js'

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
const EMOJI = /\p{Regional_Indicator}{2}|\p{Extended_Pictographic}️?\p{Emoji_Modifier}?(?:‍\p{Extended_Pictographic}️?\p{Emoji_Modifier}?)*/gu

export const emojiCode = e => [...e].filter(c => c !== '‍' && c !== '️').map(c => c.codePointAt(0).toString(16)).join('-')
export const emojiSrc  = e => `${BASE}/sprites/emoji/${emojiCode(e)}.png`
export const hasEmojiArt = e => EMOJI_ART.has(emojiCode(e))

export function __emoji(value) {
  if (typeof value !== 'string' || !value) return value
  EMOJI.lastIndex = 0
  if (!EMOJI.test(value)) return value
  EMOJI.lastIndex = 0

  const parts = []
  let last = 0, k = 0, m
  while ((m = EMOJI.exec(value))) {
    const e = m[0]
    if (!hasEmojiArt(e)) continue
    if (m.index > last) parts.push(value.slice(last, m.index))
    parts.push(
      <img key={`emo${k++}`} className="emo" src={emojiSrc(e)} alt={e} draggable={false} />,
    )
    last = m.index + e.length
  }
  if (!parts.length) return value
  if (last < value.length) parts.push(value.slice(last))
  return parts.length === 1 ? parts[0] : parts
}
