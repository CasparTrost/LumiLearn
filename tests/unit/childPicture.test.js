// The child's picture keeps the figure recognisable; the movement break shows
// a picture that fits each move.
import { describe, it, expect } from 'vitest'
import { pictureOutfit } from '../../src/components/ShapeFigure.jsx'
import { MOVE_MOOD } from '../../src/screens/MoveBreakScreen.jsx'

describe("the child's picture", () => {
  it('leaves the face thing out (glasses, a mask, a nose), keeps the hat and the rest', () => {
    const o = { head: 'kochmuetze', face: 'heldenmaske', neck: 'schal', hold: 'ballon' }
    expect(pictureOutfit(o)).toEqual({ head: 'kochmuetze', face: null, neck: 'schal', hold: 'ballon' })
    expect(pictureOutfit(null)).toBe(null)
    // the outfit itself is not changed
    expect(o.face).toBe('heldenmaske')
  })
})

describe('the movement break', () => {
  it('a picture of its own for the moves, never the sleeping one', () => {
    expect(MOVE_MOOD.fly).toBe('wave')
    expect(MOVE_MOOD.clap).toBe('happy')
    expect(MOVE_MOOD.breath).toBe('idle')
    expect(new Set(Object.values(MOVE_MOOD)).size).toBeGreaterThan(2)
    expect(Object.values(MOVE_MOOD)).not.toContain('sleep')
  })
})
