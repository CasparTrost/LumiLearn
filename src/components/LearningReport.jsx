import { useState } from 'react'
import { MODULES, WORLDS } from '../modules.js'
import { mastery, daysBetween } from '../lib/learning.js'
import { todayStr } from '../AppContext.jsx'

// Parent area: what a child can already do, and what comes back for review
// when — read from the same data that plans the daily journey
// (lib/learning.js). Plus, folded away, why the app works the way it does.

const H2 = { fontFamily: 'var(--font-heading)', fontSize: 19, fontWeight: 700, color: 'var(--px-ink)', margin: '0 0 10px' }
const SMALL = { fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }
const LEVELS = ['Noch nicht gespielt', 'Angefangen', 'Wird sicher', 'Sicher']

function reviewText(p, today) {
  const due = p?.skill?.due
  if (!due) return null
  const d = daysBetween(today, due)
  return d <= 0 ? 'Wiederholung jetzt dran' : d === 1 ? 'Wiederholung morgen' : `Wiederholung in ${d} Tagen`
}

export const PRINCIPLES = [
  ['Lumis Ideen statt Spiele-Wand',
    'Statt 25 Spiele gleich laut zu zeigen, hat Lumi jeden Tag ein paar Ideen: vier Spiele aus verschiedenen Bereichen und eine Bewegungspause, immer eine nach der anderen. Zu viel Auswahl überfordert kleine Kinder (Iyengar & Lepper 2000). Gemischte Bereiche festigen das Gelernte besser als lange Blöcke vom selben (Interleaving, Rohrer & Taylor 2007). Alle Spiele bleiben in ihren Welten frei wählbar.'],
  ['Spielen statt Abfragen',
    'Jedes Spiel ist eine kleine Geschichte mit einer Figur, die etwas will: Das Kind füttert, baut, sortiert und hilft, statt Antwortkarten anzutippen. Lernen, das aktiv, engagiert und bedeutsam ist, wirkt am besten (Hirsh-Pasek et al. 2015).'],
  ['Wiederholen, kurz bevor es vergessen wird',
    'Jedes Spiel ist eine Fähigkeit mit einem Wiederholungsplan (1, 2, 4, 7, 14, 30 Tage). Klappt es gut, kommt es später wieder, sonst früher. Abrufen im Abstand ist eine der am besten belegten Lernstrategien (Cepeda et al. 2006; Roediger & Karpicke 2006).'],
  ['Die richtige Schwierigkeit',
    'Am meisten lernt ein Kind, wenn es etwa vier von fünf Aufgaben schafft (Wilson et al. 2019; „Zone der nächsten Entwicklung“, Wygotski). Das nächste Level wird erst nach einer Runde mit mindestens 60 % auf Anhieb vorgeschlagen; nach zwei sehr schweren Runden schlägt Lumi das leichtere Level vor.'],
  ['Mit einem Erfolg starten',
    'Der Tag beginnt mit einer Wiederholung, die sicher klappt. Erfolgserlebnisse stärken das Zutrauen, auch Schweres zu probieren (Selbstwirksamkeit, Bandura 1977).'],
  ['Anstrengung loben, nicht Talent',
    'Lumi lobt, was das Kind getan hat („Gut überlegt!“, „Du hast nicht aufgegeben!“), nie, wie klug es ist. Prozess-Lob lässt Kinder nach Fehlern weitermachen; Lob für Klugheit macht sie vorsichtig (Mueller & Dweck 1998; Gunderson et al. 2013).'],
  ['Lumi als Begleiter',
    'Lumi reagiert in jedem Spiel auf jede Antwort. Kinder lernen mehr von Figuren, zu denen sie eine Beziehung aufbauen (Calvert et al. 2014).'],
  ['Bewegung zwischendurch',
    'Kurze Bewegungspausen verbessern danach die Aufmerksamkeit (Mahar et al. 2006). Die Atemübung am Ende beruhigt wieder.'],
  ['Buchstaben mit dem Finger schreiben',
    'Buchstaben nachzuspuren verankert sie besser als nur Ansehen oder Tippen (Longcamp et al. 2005; James & Engelhardt 2012). Darum gibt es die Buchstaben-Spuren.'],
  ['Belohnung fürs Mitmachen, ein klares Ende',
    'Den Sticker gibt es, wenn alle Ideen des Tages gespielt sind, unabhängig von den Sternen: Belohnungen für Leistung können die Freude am Spiel selbst verdrängen (Deci, Koestner & Ryan 1999). Die Ideen haben ein Ende („Morgen hat Lumi neue“), das macht das Aufhören leichter (Empfehlungen der American Academy of Pediatrics 2016).'],
]

export const TIPS = [
  'Spielen Sie ab und zu mit, und fragen Sie: „Wie hast du das herausgefunden?“ Gemeinsames Spielen und Darüber-Reden verstärkt den Lerneffekt (Joint Media Engagement, Takeuchi & Stevens 2011).',
  'Schauen Sie zusammen das Sticker-Album an: Was ist das? Wo lebt es? Welches Geräusch macht es?',
  'Greifen Sie Gelerntes im Alltag auf: Buchstaben auf Schildern suchen, beim Tischdecken zählen, Gefühle benennen.',
  'Lumis Ideen für einen Tag genügen. 15 bis 20 Minuten sind für Kinder dieses Alters eine gute Menge.',
]

export default function LearningReport({ profile }) {
  const [why, setWhy] = useState(false)
  const today = todayStr()
  const progress = profile?.progress ?? {}
  const journeys = (profile?.stickers ?? []).length
  const due = MODULES.filter(m => progress[m.id]?.skill?.due && progress[m.id].skill.due <= today)

  return (
    <div className="px-panel" style={{ padding: '16px 14px', marginBottom: 14 }}>
      <div style={H2}>Lernbericht: {profile?.name}</div>
      <div style={{ ...SMALL, marginBottom: 10 }}>
        ⭐ {journeys} {journeys === 1 ? 'Tag' : 'Tage'} mit allen Ideen geschafft
        {due.length > 0 && <> · 🔁 Heute zum Wiederholen: {due.map(m => m.title).join(', ')}</>}
      </div>
      {WORLDS.map(w => {
        const mods = MODULES.filter(m => m.world === w.id)
        return (
          <div key={w.id} style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--px-ink)', fontSize: 16, marginBottom: 4 }}>{w.emoji} {w.label}</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {mods.map(m => {
                const p = progress[m.id]
                const lv = mastery(p)
                const rev = reviewText(p, today)
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, ...SMALL, color: 'var(--px-ink)' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{m.title}</span>
                    <span aria-label={LEVELS[lv]} title={LEVELS[lv]} style={{ display: 'flex', gap: 2 }}>
                      {[1, 2, 3].map(i => <span key={i} className={`px-pip${i <= lv ? (lv === 3 ? ' px-pip--gold' : ' px-pip--done') : ''}`} style={{ width: 14, height: 10 }} />)}
                    </span>
                    <span style={{ width: 150, textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {lv ? `Level ${p?.currentLevel ?? 1}${rev ? ` · ${rev}` : ''}` : LEVELS[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      <button className="px-btn px-btn--parch px-btn--sm" onClick={() => setWhy(v => !v)} aria-expanded={why}>
        {why ? '▾' : '▸'} So lernt Ihr Kind mit LumiLearn
      </button>
      {why && (
        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
          {PRINCIPLES.map(([title, text]) => (
            <div key={title}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--px-ink)', fontSize: 16 }}>{title}</div>
              <div style={SMALL}>{text}</div>
            </div>
          ))}
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--px-ink)', fontSize: 16, marginTop: 4 }}>Was Sie tun können</div>
          <ul style={{ ...SMALL, margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}>
            {TIPS.map(t => <li key={t}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
