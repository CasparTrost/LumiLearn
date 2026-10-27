/**
 * Emoji -> pixel-art picture. Called by the build step for every child of
 * an HTML element (build/babel-plugin-emoji-art.js); anything that is not a
 * string containing an emoji comes back untouched.
 *
 * Pictures: public/sprites/emoji/<codepoints>.webp, made with gpt-image-2,
 * named by the emoji's code points without the variation selector and the
 * zero-width joiner (🍎 -> 1f34e.webp, 👨‍🍳 -> 1f468-1f373.webp). An emoji
 * without a picture stays an emoji.
 *
 * Things no emoji shows (a table, a yoghurt, a xylophone …) are written as
 * a token, `:px-tisch:`, and drawn from public/sprites/emoji/custom/<name>.webp.
 * Speech drops these tokens (narrator.js cleanText). Where a token cannot be
 * drawn (SVG text, canvas) use customArtSrc() and an <image>/<img> instead.
 */
import { EMOJI_ART, CUSTOM_ART } from './emojiArtList.js'

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
const EMOJI = /:px-([a-z0-9-]+):|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}️?\p{Emoji_Modifier}?(?:‍\p{Extended_Pictographic}️?\p{Emoji_Modifier}?)*/gu

export const emojiCode    = e => [...e].filter(c => c !== '‍' && c !== '️').map(c => c.codePointAt(0).toString(16)).join('-')
export const emojiSrc     = e => `${BASE}/sprites/emoji/${emojiCode(e)}.webp`
export const hasEmojiArt  = e => EMOJI_ART.has(emojiCode(e))
export const customArtSrc = name => `${BASE}/sprites/emoji/custom/${name}.webp`
/** `:px-tisch:` -> 'tisch', anything else -> null */
export const customName   = s => (typeof s === 'string' && /^:px-([a-z0-9-]+):$/.exec(s)?.[1]) || null

export function __emoji(value) {
  if (typeof value !== 'string' || !value) return value
  EMOJI.lastIndex = 0
  if (!EMOJI.test(value)) return value
  EMOJI.lastIndex = 0

  const parts = []
  let last = 0, k = 0, m
  while ((m = EMOJI.exec(value))) {
    const e = m[0]
    let src = null
    if (m[1]) src = CUSTOM_ART.has(m[1]) ? customArtSrc(m[1]) : null
    else if (hasEmojiArt(e)) src = emojiSrc(e)
    if (!src && !m[1]) continue           // plain emoji without a picture: keep it
    if (m.index > last) parts.push(value.slice(last, m.index))
    if (src) parts.push(<img key={`emo${k++}`} className="emo" src={src} alt={m[1] ?? e} draggable={false} />)
    last = m.index + e.length             // an unknown token is dropped, never shown raw
  }
  if (!parts.length && last === 0) return value
  if (last < value.length) parts.push(value.slice(last))
  return parts.length === 1 ? parts[0] : parts
}
