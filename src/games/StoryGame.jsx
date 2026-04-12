import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'

/**
 * Lumis Abenteuer — Narratives Lernen & Kausaldenken
 * Scientific basis:
 *   • Narrative Cognition (Bruner, 1991) — children understand and remember information
 *     embedded in stories 22x better than isolated facts (Willingham, 2009).
 *   • Causal Reasoning (Gopnik, 2004) — "What happens next?" questions train the
 *     causal inference system, a cornerstone of scientific and logical thinking.
 *   • Social Learning (Bandura, 1977) — character-driven dilemmas build moral reasoning
 *     and perspective-taking (Theory of Mind).
 *   • Choice-based narratives increase intrinsic motivation (self-determination theory).
 *
 * Mechanic: An illustrated mini-story unfolds panel by panel. At a key moment the
 * child picks what Lumi should do. The story continues based on their choice.
 * Each choice has a consequence shown & explained by Lumi.
 */

const STORIES = [
  {
    id: 'forest',
    title: 'Lumi im Wald',
    panels: [
      { text: 'Lumi spaziert durch den bunten Herbstwald. 🌲🍂\nPlötzlich hört Lumi ein leises Weinen...', emoji: '🌲', mood:'thinking' },
      { text: 'Da sitzt ein kleiner Igel. "Ich kann meinen Weg nach Hause nicht finden! 😢"', emoji: '🦔', mood:'encouraging' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '🤝 Lumi hilft dem Igel den Weg zu finden', value:'help', good:true },
        { text: '🏃 Lumi läuft schnell weiter', value:'run', good:false },
      ],
    },
    outcomes: {
      help: {
        panels: [
          { text: 'Lumi hilft dem Igel! Gemeinsam finden sie den Weg. 🗺️✨', emoji:'🦔❤️🦊', mood:'happy' },
          { text: '"Danke Lumi!" Der Igel bringt Lumi als Dankeschön Pilze mit! 🍄🎁', emoji:'🍄', mood:'excited' },
        ],
        lesson: '💡 Wenn wir anderen helfen, macht das uns BEIDE glücklich!',
        stars: 3,
      },
      run: {
        panels: [
          { text: 'Lumi läuft weiter... aber der Igel weint immer noch. 😢', emoji:'😞', mood:'sleepy' },
          { text: 'Lumi dreht sich um und geht doch zurück — besser spät als nie! 🔄', emoji:'🔄', mood:'encouraging' },
        ],
        lesson: '💡 Manchmal erkennen wir erst danach, was das Richtige wäre.',
        stars: 2,
      },
    },
  },
  {
    id: 'bakery',
    title: 'Der Kuchenladen',
    panels: [
      { text: 'Lumi steht vor dem Kuchenladen. 🍰\nEs riecht nach frischem Kuchen!', emoji:'🏪', mood:'happy' },
      { text: 'Lumi hat nur noch 1 Münze. Für sich oder für die kleine Maus, die hungrig daneben sitzt?', emoji:'🐭', mood:'thinking' },
    ],
    choice: {
      question: 'Was macht Lumi mit der Münze?',
      options: [
        { text: '🎁 Lumi kauft der Maus den Kuchen', value:'share', good:true },
        { text: '🍰 Lumi kauft sich selbst den Kuchen', value:'keep', good:false },
      ],
    },
    outcomes: {
      share: {
        panels: [
          { text: 'Die Maus freut sich riesig! 🐭🎉 "Das ist so lieb von dir, Lumi!"', emoji:'🐭😄', mood:'excited' },
          { text: 'Der Bäcker hat alles gesehen. Er schenkt Lumi einen extra großen Kuchen! 🍰🎁', emoji:'👨‍🍳🎂', mood:'excited' },
        ],
        lesson: '💡 Großzügigkeit kommt immer zurück — doppelt so groß!',
        stars: 3,
      },
      keep: {
        panels: [
          { text: 'Lumi isst alleine. Aber irgendwie schmeckt der Kuchen heute nicht so gut...', emoji:'😐🍰', mood:'sleepy' },
          { text: 'Lumi beschließt: das nächste Mal teilt Lumi. Teilen macht glücklicher! 🤝', emoji:'🤝', mood:'encouraging' },
        ],
        lesson: '💡 Selbst wenn wir nicht teilen, können wir daraus lernen.',
        stars: 2,
      },
    },
  },
  {
    id: 'rain',
    title: 'Der Regentag',
    panels: [
      { text: 'Es regnet! 🌧️ Lumi hatte draußen spielen wollen. Das ist schade...', emoji:'🌧️', mood:'sleepy' },
      { text: 'Oma fragt: "Lumi, magst du mir beim Backen helfen oder liest du alleine?" 📚🍪', emoji:'👵', mood:'happy' },
    ],
    choice: {
      question: 'Was wählt Lumi?',
      options: [
        { text: '👵🍪 Lumi hilft Oma beim Backen', value:'bake', good:true },
        { text: '📚 Lumi liest alleine in der Ecke', value:'read', good:true },
      ],
    },
    outcomes: {
      bake: {
        panels: [
          { text: 'Zusammen backen sie Plätzchen für die ganze Familie! 🍪🥰', emoji:'🍪', mood:'excited' },
          { text: 'Oma erzählt dabei alte Geschichten. Es ist der schönste Regentag ever! ☔❤️', emoji:'☔❤️', mood:'happy' },
        ],
        lesson: '💡 Zeit mit Familie ist wertvoller als jedes Wetter!',
        stars: 3,
      },
      read: {
        panels: [
          { text: 'Lumi taucht in ein spannendes Buch ein. 📚 ✨ Zeit vergeht wie im Flug!', emoji:'📖✨', mood:'happy' },
          { text: '"Lumi! Plätzchen sind fertig!" — Oma hatte trotzdem für Lumi gebacken. 🍪❤️', emoji:'🍪', mood:'excited' },
        ],
        lesson: '💡 Lesen und Fantasie sind Superkräfte!',
        stars: 3,
      },
    },
  },
  {
    id: 'playground',
    title: 'Auf dem Spielplatz',
    panels: [
      { text: 'Lumi will die Rutsche runterrutschen. Aber da wartet schon eine lange Schlange... 🧒🧒🧒', emoji:'🛝', mood:'thinking' },
      { text: 'Ein Kind sagt: "Komm vor! Ich kenne dich!" 😊', emoji:'👦', mood:'happy' },
    ],
    choice: {
      question: 'Was tut Lumi?',
      options: [
        { text: '⏳ Lumi wartet in der Reihe', value:'wait', good:true },
        { text: '🏃 Lumi geht vor', value:'skip', good:false },
      ],
    },
    outcomes: {
      wait: {
        panels: [
          { text: 'Lumi wartet geduldig. 🌟 Die anderen Kinder freuen sich!', emoji:'😊', mood:'happy' },
          { text: '"Du bist so fair!" sagen alle. Am Ende rutschen sie ZUSAMMEN! 🎉', emoji:'🛝🎉', mood:'excited' },
        ],
        lesson: '💡 Geduld und Fairness machen Freundschaften!',
        stars: 3,
      },
      skip: {
        panels: [
          { text: 'Lumi geht vor. Die anderen Kinder sind traurig und sauer. 😢', emoji:'😠', mood:'encouraging' },
          { text: 'Lumi sieht ihre Gesichter und entschuldigt sich. "Es tut mir leid." 💛', emoji:'💛', mood:'happy' },
        ],
        lesson: '💡 Entschuldigen ist mutig — jeder macht Fehler!',
        stars: 2,
      },
    },
  },
  // ── 5 ──────────────────────────────────────────────────────────────────────
  {
    id: 'kitten',
    title: 'Das Kätzchen im Regen',
    panels: [
      { text: 'Lumi geht nach Hause, als ein leises Miauen zu hören ist... 🌧️\nUnter einer Bank sitzt ein kleines Kätzchen, ganz nass und allein.', emoji:'🐱', mood:'thinking' },
      { text: 'Das Kätzchen schaut Lumi mit großen Augen an. Es hat kein Halsband und zittert vor Kälte. 🐱😢', emoji:'🐾', mood:'encouraging' },
    ],
    choice: {
      question: 'Was macht Lumi mit dem Kätzchen?',
      options: [
        { text: '🏠 Lumi nimmt das Kätzchen mit nach Hause', value:'help', good:true },
        { text: '🚶 Lumi geht weiter — vielleicht hilft jemand anderes', value:'leave', good:false },
      ],
    },
    outcomes: {
      help: {
        panels: [
          { text: 'Mama ist überrascht, aber sagt: "Wir schauen, ob wir den Besitzer finden." 🏠❤️', emoji:'🏠', mood:'happy' },
          { text: 'Am nächsten Tag finden sie die Besitzerin. Sie ist SO erleichtert! Als Dankeschön bekommt Lumi ein Foto vom Kätzchen. 📸🎉', emoji:'📸', mood:'excited' },
        ],
        lesson: '💡 Ein kleines Herz für Tiere kann einen riesigen Unterschied machen!',
        stars: 3,
      },
      leave: {
        panels: [
          { text: 'Lumi geht weiter... aber das leise Miauen ist nicht zu vergessen. 😔', emoji:'😟', mood:'sleepy' },
          { text: 'Lumi dreht um und bringt das Kätzchen doch nach Hause. Manchmal braucht das Herz einen Moment! 💛', emoji:'💛', mood:'encouraging' },
        ],
        lesson: '💡 Auf unser Herz zu hören ist immer eine gute Idee.',
        stars: 2,
      },
    },
  },
  // ── 6 ──────────────────────────────────────────────────────────────────────
  {
    id: 'lunchbox',
    title: 'Kein Frühstück',
    panels: [
      { text: 'In der Pause macht Lumi die Brotdose auf. Leckere Butterbrote! 🥪✨\nAber Jonas, der Klassenkamerad, sitzt still daneben und schaut auf den Boden.', emoji:'🥪', mood:'happy' },
      { text: '"Hast du etwas vergessen?" fragt Lumi. "Meine Brotdose..." flüstert Jonas. 😢', emoji:'🎒', mood:'thinking' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '🥪 Lumi teilt sein Brot mit Jonas', value:'share', good:true },
        { text: '😶 Lumi isst alleine — es ist ja sein Brot', value:'keep', good:false },
      ],
    },
    outcomes: {
      share: {
        panels: [
          { text: '"Möchtest du die Hälfte?" Jonas ist sprachlos vor Freude! 🥪😄', emoji:'🤝', mood:'excited' },
          { text: 'Nach der Schule fragt Jonas, ob Lumi zum Spielen kommen darf. Aus Fremden werden Freunde! 🤝✨', emoji:'🏠', mood:'happy' },
        ],
        lesson: '💡 Teilen schafft Freundschaften, die ein Leben lang halten!',
        stars: 3,
      },
      keep: {
        panels: [
          { text: 'Lumi isst... aber irgendwie schmeckt das Brot heute nicht so gut. 😐', emoji:'😐', mood:'sleepy' },
          { text: 'Beim nächsten Mal gibt Lumi Jonas die Hälfte: "Ich mache das besser!" Jonas lächelt. 💛', emoji:'💛', mood:'encouraging' },
        ],
        lesson: '💡 Es ist nie zu spät, das Richtige zu tun.',
        stars: 2,
      },
    },
  },
  // ── 7 ──────────────────────────────────────────────────────────────────────
  {
    id: 'vase',
    title: 'Die zerbrochene Vase',
    panels: [
      { text: 'PENG! 💥 Beim Spielen schubst Lumi aus Versehen Omas Lieblingsvase vom Tisch.\nScherben auf dem Boden...', emoji:'🏺', mood:'thinking' },
      { text: 'Oma ist noch beim Einkaufen. Lumi könnte die Scherben verstecken — oder die Wahrheit sagen. 🤔', emoji:'😟', mood:'thinking' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '🗣️ Lumi erzählt Oma sofort die Wahrheit', value:'truth', good:true },
        { text: '🫙 Lumi versteckt die Scherben unter dem Sofa', value:'hide', good:false },
      ],
    },
    outcomes: {
      truth: {
        panels: [
          { text: 'Oma kommt nach Hause. "Oma, ich muss dir etwas sagen..." Lumis Herz klopft. 💓', emoji:'👵', mood:'encouraging' },
          { text: 'Oma ist kurz traurig, dann umarmt sie Lumi fest. "Dass du ehrlich bist — darauf bin ich am stolzsten!" ❤️', emoji:'❤️', mood:'excited' },
        ],
        lesson: '💡 Die Wahrheit zu sagen ist mutig — und macht das Herz viel leichter!',
        stars: 3,
      },
      hide: {
        panels: [
          { text: 'Lumi versteckt die Scherben. Aber das Geheimnis liegt wie ein Stein im Bauch. 😟', emoji:'😟', mood:'sleepy' },
          { text: 'Beim Abendessen kommt es raus: "Oma, ich habe etwas angestellt..." Oma lächelt: "Gut, dass du es sagst." 💛', emoji:'💛', mood:'happy' },
        ],
        lesson: '💡 Geheimnisse, die wehtun, sollte man teilen. Ehrlichkeit befreit!',
        stars: 2,
      },
    },
  },
  // ── 8 ──────────────────────────────────────────────────────────────────────
  {
    id: 'climbingframe',
    title: 'Der mutige Kletterturm',
    panels: [
      { text: 'Im Park steht DER große Kletterturm. Alle Kinder klettern drauf. Lumi bleibt unten. 😟\n"Das ist zu hoch... was wenn ich falle?"', emoji:'🧗', mood:'thinking' },
      { text: 'Freundin Mia reicht Lumi die Hand: "Ich bin neben dir. Versuch es Schritt für Schritt!" 🤝', emoji:'🤝', mood:'encouraging' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '🧗 Lumi versucht es — mutig!', value:'brave', good:true },
        { text: '🌳 Lumi bleibt lieber unten', value:'stay', good:true },
      ],
    },
    outcomes: {
      brave: {
        panels: [
          { text: 'Schritt... für... Schritt. Lumi klettert! 💪 Oben angekommen sieht die Welt ganz anders aus.', emoji:'🌟', mood:'excited' },
          { text: '"ICH HABE ES GESCHAFFT!" 🎉 Alle jubeln. Mut wächst, wenn man ihn benutzt!', emoji:'🏆', mood:'excited' },
        ],
        lesson: '💡 Mutsein heißt nicht, keine Angst zu haben — sondern trotzdem zu versuchen!',
        stars: 3,
      },
      stay: {
        panels: [
          { text: 'Lumi bleibt unten — das ist auch mutig! Seine Grenzen zu kennen ist klug. 🌱', emoji:'🌱', mood:'happy' },
          { text: 'Lumi klettert auf den kleinen Turm und strahlt: "Nächstes Mal den großen!" ✨', emoji:'✨', mood:'excited' },
        ],
        lesson: '💡 Jeden Tag ein kleiner Schritt weiter — das ist echter Mut!',
        stars: 3,
      },
    },
  },
  // ── 9 ──────────────────────────────────────────────────────────────────────
  {
    id: 'newkid',
    title: 'Das neue Mädchen',
    panels: [
      { text: 'In der Schule gibt es ein neues Mädchen: Emma. Sie steht alleine im Schulhof. 🏫\nLumi kennt Emma nicht... aber Emma sieht einsam aus.', emoji:'🧒', mood:'thinking' },
      { text: 'Lumis Freunde rufen: "Lumi, komm spielen!" Lumi schaut zu Emma, dann zu den Freunden. 🤔', emoji:'👧', mood:'thinking' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '👋 Lumi geht zu Emma und stellt sich vor', value:'approach', good:true },
        { text: '🏃 Lumi rennt zu den alten Freunden', value:'ignore', good:false },
      ],
    },
    outcomes: {
      approach: {
        panels: [
          { text: '"Hallo! Ich bin Lumi. Willst du mitspielen?" Emmas Gesicht leuchtet auf! 😊✨', emoji:'😊', mood:'happy' },
          { text: 'Am Ende des Tages hat Lumi eine neue Freundin. Emma: "Du bist die erste, die freundlich war. Danke!" 💛', emoji:'💛', mood:'excited' },
        ],
        lesson: '💡 Eine kleine Geste kann für jemand anderen die Welt bedeuten!',
        stars: 3,
      },
      ignore: {
        panels: [
          { text: 'Lumi spielt... aber nach einer Weile weint Emma in einer Ecke. 😢 Das Lachen hört auf.', emoji:'😢', mood:'sleepy' },
          { text: 'Lumi geht zu Emma: "Es tut mir leid — willst du jetzt mitspielen?" Emma lächelt erleichtert. 💛', emoji:'💛', mood:'encouraging' },
        ],
        lesson: '💡 Es ist nie zu spät, freundlich zu sein. Aber früher ist besser!',
        stars: 2,
      },
    },
  },
  // ── 10 ─────────────────────────────────────────────────────────────────────
  {
    id: 'wallet',
    title: 'Das gefundene Portemonnaie',
    panels: [
      { text: 'Beim Spielen im Park findet Lumi ein schwarzes Portemonnaie im Gras. 💼\nDarin sind Geld, ein Foto und eine Telefonnummer.', emoji:'💼', mood:'thinking' },
      { text: 'Lumi könnte das Geld behalten — oder mit Mama zur Polizei gehen. 🤔', emoji:'🤔', mood:'thinking' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '👮 Lumi gibt das Portemonnaie zur Polizei', value:'return', good:true },
        { text: '💰 Lumi behält das Geld erst mal', value:'keep', good:false },
      ],
    },
    outcomes: {
      return: {
        panels: [
          { text: 'Lumi geht mit Mama zur Polizei. Der Beamte lobt Lumi sehr! 👮⭐', emoji:'👮', mood:'happy' },
          { text: 'Am nächsten Tag klingelt es — die Besitzerin umarmt Lumi: "Das war mein letztes Geld für Medikamente. Danke!" Sie schenkt Lumi ein Buch. 💛📚', emoji:'📚', mood:'excited' },
        ],
        lesson: '💡 Ehrlichkeit kann einem fremden Menschen wirklich helfen!',
        stars: 3,
      },
      keep: {
        panels: [
          { text: 'Lumi gibt das Geld aus... aber das Foto im Portemonnaie — eine alte Frau — lässt Lumi nicht schlafen. 😟', emoji:'😟', mood:'sleepy' },
          { text: 'Lumi geht doch zur Polizei. "Es tut mir leid." Der Beamte sagt: "Gut, dass du es überhaupt gebracht hast." 💛', emoji:'💛', mood:'encouraging' },
        ],
        lesson: '💡 Fehler machen ist menschlich — sie wieder gut machen ist heldenhaft!',
        stars: 2,
      },
    },
  },
]

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

export default function StoryGame({ level = 1, onComplete }) {
  const storyCount = level <= 3 ? 2 : level <= 6 ? 3 : level <= 8 ? 4 : Math.min(5, STORIES.length)
  const [stories]    = useState(() => shuffle(STORIES).slice(0, storyCount))
  const [storyIdx,   setStoryIdx]   = useState(0)
  const [panelIdx,   setPanelIdx]   = useState(0)
  const [chosen,     setChosen]     = useState(null)
  const [outPanel,   setOutPanel]   = useState(0)
  const [totalStars, setTotalStars] = useState(0)
  const [phase,      setPhase]      = useState('intro') // intro | choice | outcome | lesson

  const story   = stories[storyIdx]
  const outcome = chosen ? story.outcomes[chosen] : null

  const nextPanel = useCallback(() => {
    const maxIntro = story.panels.length - 1
    if (phase === 'intro') {
      if (panelIdx < maxIntro) { setPanelIdx(p => p + 1) }
      else { setPhase('choice') }
    } else if (phase === 'outcome') {
      const maxOut = (outcome?.panels.length ?? 1) - 1
      if (outPanel < maxOut) { setOutPanel(p => p + 1) }
      else { setPhase('lesson') }
    }
  }, [phase, panelIdx, story, outcome, outPanel])

  const makeChoice = useCallback((value) => {
    setChosen(value)
    setPhase('outcome')
    setOutPanel(0)
    const s = story.outcomes[value]?.stars ?? 2
    setTotalStars(ts => ts + s)
  }, [story])

  const nextStory = useCallback(() => {
    const finalStars = totalStars + (chosen ? story.outcomes[chosen]?.stars ?? 2 : 0)
    if (storyIdx + 1 >= stories.length) {
      // Pass stars as score out of max (3 stars * number of stories)
      onComplete({ score: finalStars, total: stories.length * 3 })
    } else {
      setStoryIdx(i => i + 1)
      setPanelIdx(0)
      setChosen(null)
      setOutPanel(0)
      setPhase('intro')
    }
  }, [storyIdx, stories, totalStars, chosen, story, onComplete])

  const currentPanel = phase === 'intro' ? story.panels[panelIdx]
                     : phase === 'outcome' ? outcome?.panels[outPanel]
                     : null

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      padding:'clamp(14px,2.5vw,28px) clamp(16px,4vw,40px)',
      gap:'clamp(14px,2vw,22px)',
    }}>

      {/* Story progress */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        {stories.map((s, i) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:4,
            fontFamily:'var(--font-heading)', fontSize:14,
            color: i === storyIdx ? 'var(--violet-deep)' : i < storyIdx ? '#6BCB77' : 'var(--text-muted)',
          }}>
            <div style={{
              width:32, height:32, borderRadius:'50%', border:`3px solid ${i === storyIdx ? 'var(--violet-deep)' : i < storyIdx ? '#6BCB77' : '#ECE8FF'}`,
              background: i < storyIdx ? '#6BCB77' : i === storyIdx ? '#EDE5FF' : 'white',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700,
              color: i < storyIdx ? 'white' : 'inherit',
            }}>
              {i < storyIdx ? '✓' : i + 1}
            </div>
            {i < stories.length - 1 && <div style={{ width:20, height:2, background: i < storyIdx ? '#6BCB77' : '#ECE8FF', borderRadius:99 }} />}
          </div>
        ))}
        <span style={{ fontFamily:'var(--font-heading)', fontSize:15, color:'var(--text-muted)', marginLeft:6 }}>
          {story.title}
        </span>
      </div>

      {/* Story card */}
      <AnimatePresence mode="wait">
        <motion.div key={`${storyIdx}-${phase}-${panelIdx}-${outPanel}`}
          initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }}
          exit={{ opacity:0, x:-40 }}
          transition={{ type:'spring', stiffness:280, damping:22 }}
          style={{
            background:'white', borderRadius:32,
            padding:'clamp(20px,4vw,36px)',
            boxShadow:'0 10px 40px rgba(108,99,255,0.14)',
            width:'100%', maxWidth:680,
            display:'flex', flexDirection:'column', alignItems:'center', gap:18,
          }}
        >
          {/* Big emoji */}
          {currentPanel && (
            <div style={{ fontSize:'clamp(56px,14vw,88px)', lineHeight:1, textAlign:'center' }}>
              {currentPanel.emoji}
            </div>
          )}

          {/* Text */}
          {currentPanel && (
            <p style={{
              fontFamily:'var(--font-body)', fontSize:'clamp(16px,3.2vw,22px)',
              color:'var(--text-primary)', textAlign:'center', lineHeight:1.55,
              whiteSpace:'pre-line',
            }}>
              {currentPanel.text}
            </p>
          )}

          {/* Lesson phase */}
          {phase === 'lesson' && outcome && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, width:'100%' }}>
              <LumiCharacter mood="happy" size={80} />
              <div style={{
                background:'linear-gradient(135deg,#EDE5FF,#F5F0FF)',
                border:'2px solid var(--violet-light)',
                borderRadius:20, padding:'16px 22px',
                fontFamily:'var(--font-heading)', fontSize:'clamp(16px,3.5vw,22px)',
                color:'var(--violet-deep)', textAlign:'center',
              }}>
                {outcome.lesson}
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {Array.from({length:3}).map((_,i) => (
                  <span key={i} style={{ fontSize:28, filter: i < (outcome.stars ?? 2) ? 'none' : 'grayscale(1) opacity(0.3)' }}>⭐</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Lumi character (intro/outcome phases) */}
      {(phase === 'intro' || phase === 'outcome') && currentPanel && (
        <LumiCharacter mood={currentPanel.mood ?? 'happy'} size={72} />
      )}

      {/* CTA buttons */}
      {phase === 'intro' && (
        <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}} onClick={nextPanel}
          style={{
            background:'linear-gradient(135deg,#6C63FF,#4A00E0)',
            color:'white', borderRadius:99, padding:'16px clamp(28px,6vw,52px)',
            fontFamily:'var(--font-heading)', fontSize:'clamp(18px,4vw,24px)', fontWeight:600,
            boxShadow:'0 8px 28px rgba(108,99,255,0.4)',
            cursor:'pointer',
          }}
        >
          Weiter ▶
        </motion.button>
      )}

      {phase === 'choice' && (
        <div style={{
          display:'flex', flexDirection:'column', gap:'clamp(10px,2vw,16px)',
          width:'100%', maxWidth:600,
        }}>
          <p style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(18px,4vw,24px)', color:'var(--violet-deep)', textAlign:'center' }}>
            {story.choice.question}
          </p>
          {story.choice.options.map((opt) => (
            <motion.button key={opt.value}
              whileHover={{scale:1.03, x:4}} whileTap={{scale:0.97}}
              onClick={() => makeChoice(opt.value)}
              style={{
                background: opt.good ? 'linear-gradient(135deg,#6BCB77,#44D498)' : 'linear-gradient(135deg,#FFD93D,#FFA500)',
                color:'white', borderRadius:22,
                padding:'clamp(14px,3vw,22px) clamp(16px,4vw,28px)',
                fontFamily:'var(--font-heading)', fontSize:'clamp(16px,3.5vw,22px)', fontWeight:600,
                boxShadow: opt.good ? '0 6px 22px rgba(107,203,119,0.4)' : '0 6px 22px rgba(255,165,0,0.35)',
                cursor:'pointer', textAlign:'left',
              }}
            >
              {opt.text}
            </motion.button>
          ))}
        </div>
      )}

      {phase === 'outcome' && (
        <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}} onClick={nextPanel}
          style={{
            background:'linear-gradient(135deg,#FD79A8,#E84393)',
            color:'white', borderRadius:99, padding:'16px clamp(28px,6vw,52px)',
            fontFamily:'var(--font-heading)', fontSize:'clamp(18px,4vw,24px)', fontWeight:600,
            boxShadow:'0 8px 28px rgba(253,121,168,0.4)',
            cursor:'pointer',
          }}
        >
          Weiter ▶
        </motion.button>
      )}

      {phase === 'lesson' && (
        <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}} onClick={nextStory}
          style={{
            background:'linear-gradient(135deg,#6BCB77,#44D498)',
            color:'white', borderRadius:99, padding:'16px clamp(28px,6vw,52px)',
            fontFamily:'var(--font-heading)', fontSize:'clamp(18px,4vw,24px)', fontWeight:600,
            boxShadow:'0 8px 28px rgba(107,203,119,0.4)',
            cursor:'pointer',
          }}
        >
          {storyIdx + 1 >= stories.length ? '🏆 Fertig!' : 'Nächste Geschichte ➡️'}
        </motion.button>
      )}
    </div>
  )
}
