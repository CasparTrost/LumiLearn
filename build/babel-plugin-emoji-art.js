/**
 * Babel plugin: emoji shown in the UI become pixel-art pictures.
 *
 * The app shows several hundred different emoji in some forty files —
 * item pictures in the games, labels, buttons. Instead of touching every
 * render site, this rewrites JSX at build time: every child of an HTML
 * element (lowercase tag) is passed through __emoji(), which swaps each
 * emoji that has a picture in public/sprites/emoji for an <img> and leaves
 * everything else exactly as it was (see src/lib/emojiArt.jsx).
 *
 * Only children of HTML elements are touched, never props: a component
 * that receives a label string still gets the string and does with it what
 * it likes; the emoji turns into a picture where that component finally
 * puts the text into an element. Elements whose children must stay plain
 * text (SVG <text>, <option>, <title>, <textarea>, …) are skipped, as is
 * emoji used outside JSX (speech, canvas drawing, document.title).
 */
const SKIP_TAGS = new Set(['text', 'tspan', 'textPath', 'title', 'option', 'optgroup', 'textarea', 'style', 'script'])
const HAS_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u
const HELPER = '__emoji'
const SOURCE = '/src/lib/emojiArt.jsx'

export default function emojiArtPlugin({ types: t }) {
  return {
    name: 'emoji-art',
    visitor: {
      Program: {
        exit(path, state) {
          if (!state.emojiUsed) return
          path.unshiftContainer('body', t.importDeclaration(
            [t.importSpecifier(t.identifier(HELPER), t.identifier(HELPER))],
            t.stringLiteral(SOURCE),
          ))
        },
      },
      JSXElement(path, state) {
        const file = state.filename ?? ''
        if (!file.includes('/src/') || file.endsWith('/lib/emojiArt.jsx')) return
        const name = path.node.openingElement.name
        if (name.type !== 'JSXIdentifier' || !/^[a-z]/.test(name.name) || SKIP_TAGS.has(name.name)) return

        let changed = false
        const children = path.node.children.map(child => {
          if (child.type === 'JSXText') {
            if (!HAS_EMOJI.test(child.value)) return child
            // Same whitespace rules React applies to JSX text
            const built = t.react.buildChildren(t.jsxElement(
              t.jsxOpeningElement(t.jsxIdentifier('x'), []), t.jsxClosingElement(t.jsxIdentifier('x')), [child],
            ))
            if (!built.length) return child
            changed = true
            return t.jsxExpressionContainer(t.callExpression(t.identifier(HELPER), [built[0]]))
          }
          if (child.type === 'JSXExpressionContainer') {
            const e = child.expression
            if (e.type === 'JSXEmptyExpression' || e.type === 'JSXElement' || e.type === 'JSXFragment'
                || e.type === 'NumericLiteral' || e.type === 'BooleanLiteral' || e.type === 'NullLiteral') return child
            if (e.type === 'StringLiteral' && !HAS_EMOJI.test(e.value)) return child
            if (e.type === 'TemplateLiteral' && e.expressions.length === 0 && !HAS_EMOJI.test(e.quasis[0].value.cooked)) return child
            if (e.type === 'CallExpression' && e.callee.type === 'Identifier' && e.callee.name === HELPER) return child
            changed = true
            return t.jsxExpressionContainer(t.callExpression(t.identifier(HELPER), [e]))
          }
          return child
        })
        if (changed) {
          path.node.children = children
          state.emojiUsed = true
        }
      },
    },
  }
}
