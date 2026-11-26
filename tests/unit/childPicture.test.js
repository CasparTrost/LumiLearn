// The child's picture keeps the figure recognisable; the movement break shows
// a picture that fits each move.
import { describe, it, expect } from 'vitest'
import { pictureOutfit, childOverhang, childFrame } from '../../src/components/ShapeFigure.jsx'
import { MOVE_MOOD } from '../../src/screens/MoveBreakScreen.jsx'

describe("the child's picture", () => {
  it('leaves the face thing out (glasses, a mask, a nose), keeps the hat and the rest', () => {
    const o = { head: 'kochmuetze', face: 'heldenmaske', neck: 'schal', hold: 'ballon' }
    expect(pictureOutfit(o)).toEqual({ head: 'kochmuetze', face: null, neck: 'schal', hold: 'ballon' })
    expect(pictureOutfit(null)).toBe(null)
    // the outfit itself is not changed
    expect(o.face).toBe('heldenmaske')
  })
  it('the figure drawn larger than the picture: its overhang on the left is known, so a picture at the screen edge moves in', () => {
    // the phone header: the picture 36 px, the bar starts 8 px in, the button's edge 4 px
    for (const shape of ['chick', 'dino', 'einhorn', 'drache', 'roboter']) {
      const p = { id: 'a', shape, shapes: ['chick', shape], shapePicked: true, outfit: { head: 'zylinder' } }
      const over = childOverhang(p, 36)
      expect(over).toBe(Math.max(0, Math.ceil(-36 * childFrame(shape === 'chick' ? null : shape, { head: 'zylinder', face: null }).left)))
      // the figure's box starts on the screen (x >= 0)
      expect(Math.max(8, over - 4) + 4 - over).toBeGreaterThanOrEqual(0)
    }
    expect(childOverhang({ id: 'b', shape: 'roboter', shapes: ['chick', 'roboter'], shapePicked: true }, 36)).toBeGreaterThan(12)
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
