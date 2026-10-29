// Dub target languages. Speech length is counted in whitespace-separated words:
// a Vietnamese word is one syllable, English words average ~1.4 syllables, hence the lower rates.
const LANGS = {
  vi: {
    name: 'Tiếng Việt',
    short: 'VI',
    flag: '🇻🇳',
    tts: 'vi',
    unit: 'âm tiết',
    natural: 5, // words/sec the translation may use; drives the prompt budget
    voiceGuess: 3.5, // measured: macOS "Linh" at rate 1; playback recalibrates it live
    sample: 'Xin chào, đây là giọng đọc thử cho video Bilibili.',
    sayExamples: 'AI → ây ai, ComfyUI → com phi diu ai, 3D → ba đê, 50% → năm mươi phần trăm',
    notes: `- Pick forms of address (tôi/bạn, anh/em, ta/ngươi...) from the speakers' relationship and keep them consistent.
- Write Chinese personal names in Sino-Vietnamese (Hán Việt) readings.`,
    defaultLexicon: 'AI = ây ai',
  },
  en: {
    name: 'English',
    short: 'EN',
    flag: '🇬🇧',
    tts: 'en',
    unit: 'words',
    natural: 2.8,
    voiceGuess: 2.5, // shortcut: guessed for macOS English voices; playback recalibrates it live
    sample: 'Hello, this is a sample of the dubbing voice for Bilibili videos.',
    sayExamples: '3D → three D, 50% → fifty percent, v2.1 → version two point one',
    notes: '- Write Chinese personal names in pinyin without tone marks.',
    defaultLexicon: '',
  },
};

const langOf = code => (Object.hasOwn(LANGS, code) ? LANGS[code] : LANGS.vi);

// Storage keys. Vietnamese keeps the original unsuffixed keys so earlier translations and lexicons still load.
const lexiconKey = lang => (lang === 'vi' ? 'lexicon' : `lexicon:${lang}`);
const voiceKey = lang => `voice:${lang}`;
const cacheKey = (bvid, cid, srcLan, lang) => `tr:${bvid}:${cid}:${srcLan}` + (lang === 'vi' ? '' : `:${lang}`);
