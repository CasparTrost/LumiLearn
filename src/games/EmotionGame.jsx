import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { voice } from '../voice.js'

/**
 * Gefühlswelt — Emotionale Intelligenz
 * Scientific basis:
 *   • CASEL Framework (Brackett & Rivers, 2014) — emotional literacy is foundational
 *     to academic achievement, social relationships, and mental health.
 *   • RULER Approach (Yale Center for Emotional Intelligence) — Recognizing, Understanding,
 *     Labeling, Expressing, Regulating emotions.
 *   • Theory of Mind (Baron-Cohen) — labeling emotions in others builds empathy.
 */

const SCENARIOS = [
  // Glücklich
  { face:'😄', situation:'Lumi bekommt ein riesiges Geschenk! 🎁',                    emotion:'Glücklich',  lumiMood:'happy',      faceColor:'#FFD93D', decoys:['Traurig','Wütend','Ängstlich'],    explain:'Wenn wir etwas toll finden, fühlen wir uns glücklich! 🌟' },
  { face:'😄', situation:'Lumi gewinnt beim Wettrennen gegen alle anderen! 🏆',       emotion:'Glücklich',  lumiMood:'excited',    faceColor:'#FFD93D', decoys:['Traurig','Verlegen','Müde'],       explain:'Wenn wir etwas Tolles schaffen, werden wir ganz glücklich!' },
  { face:'😄', situation:'Lumi trifft nach langer Zeit den besten Freund wieder! 🤗', emotion:'Glücklich',  lumiMood:'happy',      faceColor:'#FFD93D', decoys:['Traurig','Ängstlich','Wütend'],    explain:'Freunde wiederzusehen macht uns glücklich! 💛' },
  { face:'😄', situation:'Lumi darf heute so lange aufbleiben wie er möchte! 🌙',     emotion:'Glücklich',  lumiMood:'excited',    faceColor:'#FFD93D', decoys:['Müde','Traurig','Verlegen'],       explain:'Unerwartete Freuden machen uns glücklich! 🎉' },
  // Traurig
  { face:'😢', situation:'Lumis Lieblings-Eis fällt auf den Boden... 😿',            emotion:'Traurig',    lumiMood:'sleepy',     faceColor:'#74B9FF', decoys:['Glücklich','Wütend','Aufgeregt'],  explain:'Wenn etwas schiefgeht, das uns wichtig ist, fühlen wir uns traurig.' },
  { face:'😢', situation:'Lumis bester Freund zieht in eine andere Stadt... 📦',      emotion:'Traurig',    lumiMood:'sleepy',     faceColor:'#74B9FF', decoys:['Wütend','Aufgeregt','Verlegen'],   explain:'Menschen zu vermissen macht uns traurig.' },
  { face:'😢', situation:'Das Lieblingsspielzeug von Lumi ist kaputt gegangen. 💔',   emotion:'Traurig',    lumiMood:'sleepy',     faceColor:'#74B9FF', decoys:['Glücklich','Ängstlich','Verlegen'], explain:'Wenn wir etwas Liebgewonnenes verlieren, werden wir traurig.' },
  { face:'😢', situation:'Es regnet und Lumi kann draußen nicht spielen. ☔',         emotion:'Traurig',    lumiMood:'sleepy',     faceColor:'#74B9FF', decoys:['Wütend','Glücklich','Aufgeregt'],  explain:'Enttäuschungen können uns traurig machen.' },
  // Wütend
  { face:'😡', situation:'Ein Kind nimmt Lumi einfach das Spielzeug weg!',           emotion:'Wütend',     lumiMood:'thinking',   faceColor:'#FF6B6B', decoys:['Glücklich','Traurig','Überrascht'], explain:'Wenn wir uns ungerecht behandelt fühlen, werden wir wütend.' },
  { face:'😡', situation:'Jemand hat die Zeichnung von Lumi zerrissen! 😤',          emotion:'Wütend',     lumiMood:'thinking',   faceColor:'#FF6B6B', decoys:['Glücklich','Traurig','Verlegen'],  explain:'Wenn etwas Wichtiges kaputt gemacht wird, macht uns das wütend.' },
  { face:'😡', situation:'Lumi steht in der Reihe und jemand drängelt sich vor! 😠', emotion:'Wütend',     lumiMood:'thinking',   faceColor:'#FF6B6B', decoys:['Traurig','Überrascht','Müde'],     explain:'Unfairheit macht uns wütend.' },
  // Ängstlich  
  { face:'😨', situation:'Lumi hört mitten in der Nacht ein lautes Geräusch!',      emotion:'Ängstlich',  lumiMood:'thinking',   faceColor:'#A29BFE', decoys:['Wütend','Aufgeregt','Glücklich'], explain:'Wenn wir etwas nicht kennen und es unerwartet kommt, werden wir ängstlich.' },
  { face:'😨', situation:'Lumi soll alleine auf der großen Bühne auftreten. 🎭',     emotion:'Ängstlich',  lumiMood:'thinking',   faceColor:'#A29BFE', decoys:['Aufgeregt','Glücklich','Wütend'],  explain:'Vor einem großen Auftritt haben viele Menschen Angst.' },
  { face:'😨', situation:'Lumi sieht eine riesige Spinne im Zimmer! 🕷️',             emotion:'Ängstlich',  lumiMood:'thinking',   faceColor:'#A29BFE', decoys:['Wütend','Traurig','Verlegen'],    explain:'Dinge die uns erschrecken machen uns ängstlich.' },
  // Aufgeregt
  { face:'🤩', situation:'Morgen ist Lumis mega Geburtstagsparty! 🎉',               emotion:'Aufgeregt',  lumiMood:'excited',    faceColor:'#FD79A8', decoys:['Traurig','Wütend','Ängstlich'],   explain:'Wenn wir uns auf etwas Tolles freuen, sind wir aufgeregt!' },
  { face:'🤩', situation:'Lumi fährt heute zum ersten Mal in den Freizeitpark! 🎡',  emotion:'Aufgeregt',  lumiMood:'excited',    faceColor:'#FD79A8', decoys:['Ängstlich','Traurig','Müde'],     explain:'Etwas zum ersten Mal erleben macht uns ganz aufgeregt!' },
  { face:'🤩', situation:'Lumi darf mit Papa zusammen ein Modell bauen! 🏗️',         emotion:'Aufgeregt',  lumiMood:'excited',    faceColor:'#FD79A8', decoys:['Ängstlich','Traurig','Verlegen'], explain:'Mit jemandem etwas Tolles tun dürfen macht uns aufgeregt!' },
  // Müde
  { face:'😴', situation:'Es ist 21 Uhr und Lumi hatte einen langen spielreichen Tag.', emotion:'Müde',    lumiMood:'sleepy',     faceColor:'#B2BEC3', decoys:['Glücklich','Aufgeregt','Wütend'],  explain:'Nach einem langen Tag braucht unser Körper Erholung — dann sind wir müde.' },
  { face:'😴', situation:'Lumi hat den ganzen Tag Lesen geübt. Jetzt fallen die Augen zu. 📚', emotion:'Müde', lumiMood:'sleepy', faceColor:'#B2BEC3', decoys:['Traurig','Ängstlich','Verlegen'], explain:'Viel Konzentration macht uns müde.' },
  // Verlegen
  { face:'😳', situation:'Lumi hat versehentlich ein Glas umgeworfen. Alle schauen!', emotion:'Verlegen', lumiMood:'thinking',   faceColor:'#FFA07A', decoys:['Glücklich','Wütend','Traurig'],   explain:'Wenn uns etwas peinlich ist, fühlen wir uns verlegen.' },
  { face:'😳', situation:'Lumi stolpert vor allen Kindern im Turnsaal. 😬',          emotion:'Verlegen',   lumiMood:'thinking',   faceColor:'#FFA07A', decoys:['Glücklich','Wütend','Aufgeregt'], explain:'Wenn etwas Ungewolltes vor anderen passiert, werden wir verlegen.' },
  // Dankbar
  { face:'🥰', situation:'Lumis bester Freund teilt seine Schokolade! 🍫',           emotion:'Dankbar',    lumiMood:'happy',      faceColor:'#6BCB77', decoys:['Traurig','Ängstlich','Wütend'],   explain:'Wenn jemand nett zu uns ist, fühlen wir uns dankbar.' },
  { face:'🥰', situation:'Oma hat heimlich Lumis Lieblingskuchen gebacken! 🎂',      emotion:'Dankbar',    lumiMood:'happy',      faceColor:'#6BCB77', decoys:['Aufgeregt','Verlegen','Traurig'], explain:'Wenn jemand an uns denkt, sind wir dankbar.' },
  // Überrascht
  { face:'😮', situation:'Plötzlich klingeln alle: "Überraschung!" schreit die Familie! 🎊', emotion:'Überrascht', lumiMood:'excited', faceColor:'#FFB347', decoys:['Glücklich','Ängstlich','Wütend'], explain:'Wenn etwas Unerwartetes passiert, sind wir überrascht!' },
  { face:'😮', situation:'In der Geburtstagskiste ist ein Hund! 🐕',                 emotion:'Überrascht', lumiMood:'excited',    faceColor:'#FFB347', decoys:['Glücklich','Aufgeregt','Dankbar'], explain:'Unerwartete Dinge lassen uns staunen und überraschen!' },
  // Stolz
  { face:'😊', situation:'Lumi kann jetzt alleine Fahrrad fahren! 🚲',               emotion:'Stolz',      lumiMood:'happy',      faceColor:'#44D498', decoys:['Glücklich','Aufgeregt','Traurig'], explain:'Wenn wir etwas Neues schaffen, sind wir stolz auf uns!' },
  { face:'😊', situation:'Lumi hat sein erstes Gedicht auswendig gelernt. 📜',        emotion:'Stolz',      lumiMood:'happy',      faceColor:'#44D498', decoys:['Dankbar','Verlegen','Glücklich'],  explain:'Etwas Schwieriges zu meistern macht uns stolz!' },
  // Gelangweilt
  { face:'😑', situation:'Lumi wartet schon eine Stunde beim Arzt... ⏳',            emotion:'Gelangweilt', lumiMood:'sleepy',    faceColor:'#95A5A6', decoys:['Müde','Traurig','Ängstlich'],      explain:'Wenn nichts Interessantes passiert, werden wir gelangweilt.' },
  // Eifersüchtig
  { face:'😒', situation:'Das Geschwister bekommt mehr Spielzeit als Lumi. 📱',      emotion:'Eifersüchtig', lumiMood:'thinking', faceColor:'#F39C12', decoys:['Wütend','Traurig','Verlegen'],    explain:'Wenn andere etwas haben, das wir auch wollen, können wir eifersüchtig werden.' },
  // Neugierig
  { face:'🤔', situation:'Lumi sieht eine geheimnisvolle Box — was ist da wohl drin? 📦', emotion:'Neugierig', lumiMood:'thinking', faceColor:'#3498DB', decoys:['Aufgeregt','Ängstlich','Glücklich'], explain:'Wenn wir etwas herausfinden wollen, sind wir neugierig!' },
]

const EMOTION_ICON = {
  'Glücklich':'😄', 'Traurig':'😢',       'Wütend':'😡',       'Ängstlich':'😨',
  'Aufgeregt':'🤩', 'Müde':'😴',          'Verlegen':'😳',     'Dankbar':'🥰',
  'Überrascht':'😮','Stolz':'😊',          'Gelangweilt':'😑', 'Eifersüchtig':'😒',
  'Neugierig':'🤔',
}

// ─── Voice audio ─────────────────────────────────────────────────────────────
const GEF = 'audio/gefuehlswelt/'
const EMOTION_AUDIO = {
  'Glücklich':    GEF + 'lumi-war-gluecklich.mp3',
  'Traurig':      GEF + 'lumi-war-traurig.mp3',
  'Wütend':       GEF + 'lumi-war-wuetend.mp3',
  'Ängstlich':    GEF + 'lumi-war-aengstlich.mp3',
  'Aufgeregt':    GEF + 'lumi-war-aufgeregt.mp3',
  'Müde':         GEF + 'lumi-war-muede.mp3',
  'Verlegen':     GEF + 'lumi-war-verlegen.mp3',
  'Dankbar':      GEF + 'lumi-war-dankbar.mp3',
  'Überrascht':   GEF + 'lumi-war-ueberrascht.mp3',
  'Stolz':        GEF + 'lumi-war-stolz.mp3',
  'Gelangweilt':  GEF + 'lumi-war-gelangweilt.mp3',
  'Eifersüchtig': GEF + 'lumi-war-eifersuechtig.mp3',
  'Neugierig':    GEF + 'lumi-war-neugierig.mp3',
}

// [situationAudio, explainAudio] parallel to SCENARIOS — null where no file exists
const SCENARIO_AUDIO = [
  [GEF+'lumi-bekommt-ein-riesiges-geschenk.mp3',           GEF+'wenn-wir-etwas-toll-finden-fuehlen-wir-uns-gluecklich.mp3'],
  [GEF+'lumi-gewinnt-beim-wettrennen-gegen-alle-anderen.mp3', GEF+'wenn-wir-etwas-tolles-schaffen-werden-wir-ganz-gluecklich.mp3'],
  [GEF+'lumi-trifft-nach-langer-zeit-den-besten-freund-wieder.mp3', GEF+'freunde-wiederzusehen-macht-uns-gluecklich.mp3'],
  [GEF+'lumi-darf-heute-so-lange-aufbleiben-wie-er-moechte.mp3', GEF+'unerwartete-freuden-machen-uns-gluecklich.mp3'],
  [GEF+'lumis-lieblings-eis-faellt-auf-den-boden.mp3',     GEF+'wenn-etwas-schiefgeht-das-uns-wichtig-ist-fuehlen-wir-uns-traurig.mp3'],
  [GEF+'lumis-bester-freund-zieht-in-eine-andere-stadt.mp3', GEF+'menschen-zu-vermissen-macht-uns-traurig.mp3'],
  [GEF+'das-lieblingsspielzeug-von-lumi-ist-kaputt-gegangen.mp3', GEF+'wenn-wir-etwas-liebgewonnenes-verlieren-werden-wir-traurig.mp3'],
  [GEF+'es-regnet-und-lumi-kann-draussen-nicht-spielen.mp3', GEF+'enttaeuschungen-koennen-uns-traurig-machen.mp3'],
  [GEF+'ein-kind-nimmt-lumi-einfach-das-spielzeug-weg.mp3', GEF+'wenn-wir-uns-ungerecht-behandelt-fuehlen-werden-wir-wuetend.mp3'],
  [GEF+'jemand-hat-die-zeichnung-von-lumi-zerrissen.mp3',   GEF+'wenn-etwas-wichtiges-kaputt-gemacht-wird-macht-uns-das-wuetend.mp3'],
  [GEF+'lumi-steht-in-der-reihe-und-jemand-draengelt-sich-vor.mp3', GEF+'unfairheit-macht-uns-wuetend.mp3'],
  [GEF+'lumi-hoert-mitten-in-der-nacht-ein-lautes-geraeusch.mp3', GEF+'wenn-wir-etwas-nicht-kennen-und-es-unerwartet-kommt-werden-wir-aengstl.mp3'],
  [GEF+'lumi-soll-alleine-auf-der-grossen-buehne-auftreten.mp3', GEF+'vor-einem-grossen-auftritt-haben-viele-menschen-angst.mp3'],
  [GEF+'lumi-sieht-eine-riesige-spinne-im-zimmer.mp3',      GEF+'dinge-die-uns-erschrecken-machen-uns-aengstlich.mp3'],
  [GEF+'morgen-ist-lumis-mega-geburtstagsparty.mp3',        GEF+'wenn-wir-uns-auf-etwas-tolles-freuen-sind-wir-aufgeregt.mp3'],
  [GEF+'lumi-faehrt-heute-zum-ersten-mal-in-den-freizeitpark.mp3', GEF+'etwas-zum-ersten-mal-erleben-macht-uns-ganz-aufgeregt.mp3'],
  [GEF+'lumi-darf-mit-papa-zusammen-ein-modell-bauen.mp3',  GEF+'mit-jemandem-etwas-tolles-tun-duerfen-macht-uns-aufgeregt.mp3'],
  [GEF+'es-ist-21-uhr-und-lumi-hatte-einen-langen-spielreichen-tag.mp3', GEF+'nach-einem-langen-tag-braucht-unser-koerper-erholung-dann-sind-wir-mue.mp3'],
  [null, null], // Müde: Lesen geübt
  [null, null], // Verlegen: Glas umgeworfen
  [null, null], // Verlegen: stolpert
  [null, null], // Dankbar: Schokolade
  [null, null], // Dankbar: Kuchen
  [null, null], // Überrascht: Überraschungsparty
  [null, null], // Überrascht: Hund in der Kiste
  [null, null], // Stolz: Fahrrad
  [null, null], // Stolz: Gedicht
  [null, null], // Gelangweilt: Arzt
  [null, null], // Eifersüchtig: Geschwister
  [null, null], // Neugierig: geheimnisvolle Box
]

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

export default function EmotionGame({ level = 1, onComplete }) {
  const BASIC = ['Glücklich','Traurig','Wütend','Ängstlich','Aufgeregt']
  const MID   = [...BASIC,'Müde','Verlegen','Dankbar']
  const pool  = level <= 3 ? SCENARIOS.filter(s => BASIC.includes(s.emotion))
              : level <= 6 ? SCENARIOS.filter(s => MID.includes(s.emotion))
              : SCENARIOS
  const qCount = level <= 3 ? 6 : level <= 6 ? 8 : level <= 8 ? 10 : 12
  const [challenges] = useState(() =>
    shuffle(pool).slice(0, qCount).map(s => {
      const ai = SCENARIOS.indexOf(s)
      const [sa, ea] = ai >= 0 ? SCENARIO_AUDIO[ai] : [null, null]
      return { ...s, sa, ea }
    })
  )
  const [idx,        setIdx]      = useState(0)
  const [selected,   setSelected] = useState(null)
  const [correct,    setCorrect]  = useState(0)
  const [showInfo,   setShowInfo] = useState(false)

  // Stop narration when game unmounts
  useEffect(() => () => voice.stop(), [])

  // Speak the situation when a new scenario appears
  useEffect(() => {
    if (challenges[idx]?.sa) voice.play(challenges[idx].sa)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const ch      = challenges[idx]
  // Freeze option order per question — useMemo keyed on idx so it only shuffles when the question changes
  const options = useMemo(() => ch ? shuffle([ch.emotion, ...ch.decoys]) : [], [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = useCallback((emotion) => {
    if (selected !== null || !ch) return
    const ok = emotion === ch.emotion
    const nc = correct + (ok ? 1 : 0)
    setSelected(emotion)
    if (ok) setCorrect(nc)
    setShowInfo(true)

    if (ok) {
      voice.chain([EMOTION_AUDIO[ch.emotion], ch.ea])
      // Correct: show explanation 8 s, then advance
      setTimeout(() => {
        setShowInfo(false)
        setTimeout(() => {
          if (idx + 1 >= challenges.length) { onComplete({ score: nc, total: challenges.length }) }
          else { setIdx(i => i + 1); setSelected(null) }
        }, 200)
      }, 8000)
    } else {
      // Wrong: show explanation + face 8 s, then let them try again
      setTimeout(() => {
        setShowInfo(false)
        setSelected(null)  // re-enable buttons for another attempt
      }, 8000)
    }
  }, [selected, ch, correct, idx, challenges, onComplete])

  if (!ch) return null

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      padding:'clamp(14px,2.5vw,28px) clamp(16px,4vw,40px)',
      gap:'clamp(12px,2vw,22px)',
    }}>

      {/* Progress dots */}
      <div style={{ display:'flex', gap:8 }}>
        {challenges.map((_, i) => (
          <motion.div key={i}
            animate={{ scale: i === idx ? 1.4 : 1 }}
            style={{
              width:13, height:13, borderRadius:'50%',
              background: i < idx ? '#FD79A8' : i === idx ? '#FFD93D' : '#ECE8FF',
            }}
          />
        ))}
      </div>

      {/* Lumi + question bubble */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:14, width:'100%', maxWidth:760 }}>
        <LumiCharacter mood={selected ? ch.lumiMood : 'happy'} size={88} />
        <div style={{
          flex:1, background:'white', borderRadius:'24px 24px 24px 6px',
          padding:'16px 22px',
          boxShadow:'0 4px 24px rgba(253,121,168,0.12)',
          fontFamily:'var(--font-heading)',
          fontSize:'clamp(18px,3.8vw,26px)',
          color:'var(--text-primary)',
        }}>
          {selected === null ? 'Wie fühlt sich Lumi wohl? 🤔' : selected === ch.emotion ? 'Genau richtig! 🌟' : `Es war: ${ch.emotion}!`}
        </div>
      </div>

      {/* Face card + situation */}
      <AnimatePresence mode="wait">
        <motion.div key={idx}
          initial={{ scale:0.82, opacity:0 }} animate={{ scale:1, opacity:1 }}
          exit={{ scale:0.82, opacity:0 }}
          transition={{ type:'spring', stiffness:280, damping:20 }}
          style={{
            background:'white', borderRadius:30,
            padding:'24px clamp(20px,5vw,44px)',
            boxShadow:`0 10px 36px ${ch.faceColor}35`,
            textAlign:'center',
            display:'flex', flexDirection:'column', alignItems:'center', gap:14,
            width:'100%', maxWidth:520,
          }}
        >
          {/* Face hidden before answer — only revealed after picking */}
          <AnimatePresence mode="wait">
            {selected !== null ? (
              <motion.div
                key="face"
                initial={{ scale:0, rotate:-15, opacity:0 }}
                animate={{ scale:1, rotate:0, opacity:1 }}
                transition={{ type:'spring', stiffness:320, damping:18 }}
                style={{ fontSize:'clamp(70px,16vw,104px)', lineHeight:1 }}
              >
                {ch.face}
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity:0 }} animate={{ opacity:1 }}
                style={{ fontSize:'clamp(70px,16vw,104px)', lineHeight:1, filter:'grayscale(1) opacity(0.15)' }}
              >🙂</motion.div>
            )}
          </AnimatePresence>
          <p style={{
            fontFamily:'var(--font-body)',
            fontSize:'clamp(15px,3.5vw,20px)',
            color:'var(--text-secondary)',
            maxWidth:380,
          }}>
            {ch.situation}
          </p>

          {/* Explanation flash */}
          <AnimatePresence>
            {showInfo && (
              <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:6 }}
                style={{
                  background: selected === ch.emotion ? '#E8F8EE' : '#FFF4E5',
                  border: `2px solid ${selected === ch.emotion ? '#6BCB77' : '#FFD93D'}`,
                  borderRadius:16, padding:'10px 16px',
                  fontFamily:'var(--font-body)', fontSize:'clamp(13px,2.8vw,16px)',
                  color:'var(--text-secondary)', maxWidth:360,
                }}
              >
                {ch.explain}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Emotion option grid */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(2,1fr)',
        gap:'clamp(10px,2vw,18px)',
        width:'100%', maxWidth:760,
      }}>
        {options.map((emotion) => {
          const isCorrect = emotion === ch.emotion
          const isChosen  = emotion === selected
          const done      = selected !== null

          let bg     = '#FAFAFF'
          let border = '3px solid #ECE8FF'
          let shadow = '0 4px 16px rgba(108,99,255,0.07)'

          if (done && isCorrect)       { bg='#E8F8EE'; border='3px solid #6BCB77'; shadow='0 6px 24px rgba(107,203,119,0.35)' }
          else if (done && isChosen)   { bg='#FFE8E8'; border='3px solid #FF6B6B' }

          return (
            <motion.button key={emotion}
              whileHover={!done ? { scale:1.04 } : {}}
              whileTap={!done ? { scale:0.97 } : {}}
              onClick={() => pick(emotion)}
              style={{
                padding:'clamp(14px,3vw,22px) clamp(12px,2.5vw,20px)',
                borderRadius:22, background:bg, border, boxShadow:shadow,
                display:'flex', alignItems:'center', gap:14,
                cursor:done ? 'default' : 'pointer',
                transition:'all 0.22s',
              }}
            >
              <span style={{ fontSize:'clamp(28px,6vw,40px)', lineHeight:1 }}>
                {EMOTION_ICON[emotion] ?? '😶'}
              </span>
              <span style={{
                fontFamily:'var(--font-heading)',
                fontSize:'clamp(16px,3.8vw,22px)',
                color:'var(--text-primary)', fontWeight:600,
                flex:1, textAlign:'left',
              }}>
                {emotion}
              </span>
              {done && isCorrect && <span style={{ fontSize:22 }}>✅</span>}
              {done && isChosen && !isCorrect && <span style={{ fontSize:22 }}>❌</span>}
            </motion.button>
          )
        })}
      </div>

      <p style={{ fontFamily:'var(--font-heading)', fontSize:17, color:'var(--text-muted)' }}>
        ✅ {correct} von {Math.min(idx + (selected !== null ? 1 : 0), challenges.length)} richtig
      </p>
    </div>
  )
}
