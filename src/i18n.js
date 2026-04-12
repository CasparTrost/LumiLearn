// i18n.js — central translations for LumiLearn
// Usage: import { useT } from '../i18n.js'
//        const t = useT()
//        t('welcome.title')

import { useApp } from './AppContext.jsx'

export const translations = {
  de: {
    'welcome.tagline': '✨ Lernen macht Spaß ✨',
    'welcome.subtitle': 'Dein persönlicher Lernbegleiter für Kinder von 3–7 Jahren',
    'welcome.cta': 'Jetzt starten 🚀',

    'language.title': 'Wähle deine Sprache',
    'language.subtitle': 'Choose your language',
    'language.selected': '✓ Ausgewählt',
    'language.continue': 'Weiter →',

    'profile.who': 'Wer spielt? 👋',
    'profile.tapName': 'Tippe deinen Namen um zu starten',
    'profile.addLearner': 'Neuen Lerner hinzufügen',
    'profile.create': 'Profil erstellen',
    'profile.ageLabel': 'Jahre · Bereit zum Lernen! ⭐',
    'profile.pickCharacter': 'Wähle deinen Charakter',
    'profile.whoDoYouWant': 'Wer möchtest du sein?',
    'profile.whatsName': 'Wie heißt du?',
    'profile.namePlaceholder': 'Deinen Namen eingeben...',
    'profile.howOld': 'Wie alt bist du?',
    'profile.almostThere': 'Fast geschafft!',
    'profile.tellUs': 'Erzähl uns von dir',
    'profile.next': 'Weiter →',
    'profile.letsGo': "Los geht's! 🎉",
    'profile.back': '← Zurück',
    'profile.cancel': 'Abbrechen',

    'home.new': 'Neu',
    'home.level': 'Level',
    'home.completed': 'Fertig! ⭐',

    'game.level': 'Level',

    'results.amazing': 'Fantastisch!',
    'results.great': 'Super gemacht!',
    'results.good': 'Gut gemacht!',
    'results.tryAgain': 'Nochmal versuchen',
    'results.nextLevel': 'Nächstes Level →',
    'results.home': 'Startseite',
    'results.newRecord': 'Neuer Rekord! 🏆',
    'results.moduleComplete': 'Modul abgeschlossen! 🎉',

    'module.number-intro': 'Zahlen entdecken',
    'module.letter-intro': 'ABC-Abenteuer',
    'module.emotions': 'Gefühlswelt',
    'module.listen': 'Hörabenteuer',
    'module.shadows': 'Schattenrätsel',
    'module.shapes': 'Farbenreich',
    'module.numbers': 'Zahlenland',
    'module.letters': 'Buchstabenwald',
    'module.words2': 'Silben-Spaß',
    'module.bubbles': 'Blasen-Blitz',
    'module.words': 'Memo-Welt',
    'module.patterns': 'Musterpark',
    'module.sort': 'Sortier-Spaß',
    'module.weight': 'Waage-Welt',
    'module.clock': 'Uhren-Uhr',
    'module.maze': 'Lumi-Labyrinth',
    'module.stories': 'Lumis Abenteuer',
  },

  en: {
    'welcome.tagline': '✨ Learning is fun ✨',
    'welcome.subtitle': 'Your personal learning companion for kids aged 3–7',
    'welcome.cta': "Let's go 🚀",

    'language.title': 'Choose your language',
    'language.subtitle': 'Wähle deine Sprache',
    'language.selected': '✓ Selected',
    'language.continue': 'Continue →',

    'profile.who': "Who's playing? 👋",
    'profile.tapName': 'Tap your name to start',
    'profile.addLearner': 'Add new learner',
    'profile.create': 'Create your profile',
    'profile.ageLabel': 'years · Ready to learn! ⭐',
    'profile.pickCharacter': 'Pick your character',
    'profile.whoDoYouWant': 'Who do you want to be?',
    'profile.whatsName': "What's your name?",
    'profile.namePlaceholder': 'Type your name...',
    'profile.howOld': 'How old are you?',
    'profile.almostThere': 'Almost there!',
    'profile.tellUs': 'Tell us about yourself',
    'profile.next': 'Next →',
    'profile.letsGo': "Let's go! 🎉",
    'profile.back': '← Back',
    'profile.cancel': 'Cancel',

    'home.new': 'New',
    'home.level': 'Level',
    'home.completed': 'Done! ⭐',

    'game.level': 'Level',

    'results.amazing': 'Amazing!',
    'results.great': 'Great job!',
    'results.good': 'Good job!',
    'results.tryAgain': 'Try again',
    'results.nextLevel': 'Next level →',
    'results.home': 'Home',
    'results.newRecord': 'New record! 🏆',
    'results.moduleComplete': 'Module complete! 🎉',

    'module.number-intro': 'Discover Numbers',
    'module.letter-intro': 'ABC Adventure',
    'module.emotions': 'Emotions World',
    'module.listen': 'Listening Adventure',
    'module.shadows': 'Shadow Puzzles',
    'module.shapes': 'Colorful Shapes',
    'module.numbers': 'Number Land',
    'module.letters': 'Letter Forest',
    'module.words2': 'Syllable Fun',
    'module.bubbles': 'Bubble Blitz',
    'module.words': 'Memory World',
    'module.patterns': 'Pattern Park',
    'module.sort': 'Sorting Fun',
    'module.weight': 'Weight World',
    'module.clock': 'Clock Time',
    'module.maze': 'Lumi Maze',
    'module.stories': "Lumi's Adventures",
  }
}

export function useT() {
  const { state } = useApp()
  const lang = state.language ?? 'en'
  const dict = translations[lang] ?? translations.en
  return (key, fallback) => dict[key] ?? fallback ?? key
}
