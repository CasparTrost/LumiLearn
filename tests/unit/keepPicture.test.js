import { describe, it, expect } from 'vitest'
import { printCss, pictureName, PRINT_ID } from '../../src/games/coloring/keepPicture.js'

describe('printing a picture', () => {
  it('one A4 page, turned as the picture, only the picture', () => {
    const upright = printCss(false), wide = printCss(true)
    expect(upright).toMatch(/size: A4 portrait/)
    expect(wide).toMatch(/size: A4 landscape/)
    // the app is hidden for the print, the picture fits inside the margins
    expect(upright).toContain(`body > *:not(#${PRINT_ID}) { display: none !important }`)
    expect(upright).toMatch(/width: 188mm; height: 274mm/)
    expect(wide).toMatch(/width: 275mm; height: 187mm/)
    // and on screen the print copy is never seen
    expect(upright).toMatch(/@media screen \{ #lumi-print \{ display: none !important \} \}/)
  })
})

describe('saving a picture', () => {
  it('is a PNG named after the Mal-Atelier and the day', () => {
    expect(pictureName()).toMatch(/^Mal-Atelier-\d{4}-\d{2}-\d{2}-\d{4}\.png$/)
  })
})
