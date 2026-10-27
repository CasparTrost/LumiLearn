// Feeling words and their faces, shared by Gefühlswelt, Gefühlsdetektiv and
// Lumis Abenteuer. The audit found the two feeling games using different
// words for the same thing (Glücklich here, fröhlich there) and Stolz drawn
// with nearly the same face as Glücklich; a child who cannot read goes by
// the face, so one feeling has one word and one picture in every game.
export const FEELING_ICON = {
  'Glücklich':    '😄',
  'Traurig':      '😢',
  'Wütend':       '😡',
  'Ängstlich':    '😨',
  'Aufgeregt':    '🤩',
  'Müde':         '😴',
  'Verlegen':     '😳',
  'Dankbar':      '🥰',
  'Überrascht':   '😮',
  'Stolz':        '💪',
  'Gelangweilt':  '😑',
  'Eifersüchtig': '😒',
  'Neugierig':    '🤔',
  'Einsam':       '😔',
}

// The feelings that come out bright; the others are the heavy ones. Lumi's
// face after an answer follows this.
export const BRIGHT = new Set(['Glücklich', 'Aufgeregt', 'Dankbar', 'Überrascht', 'Stolz', 'Neugierig'])

export function shuffle(a) {
  const s = [...a]
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]]
  }
  return s
}
