// Subtitle timing and dub speed planning. Lines are Bilibili subtitle entries: { from, to, content } in seconds.

const MAX_TTS_RATE = 2;
const MIN_VIDEO_RATE = 0.75;
const SAFETY = 0.85; // aim to finish at 85% of the slot so the last word isn't clipped by the next line
// shortcut: guessed TTS start delay + trailing fade per utterance (s); measure again if the voice changes.
const UTTER_OVERHEAD = 0.25;

// Speech length unit: whitespace-separated words (one Vietnamese word = one syllable). Rates per language live in languages.js.
function syllables(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Seconds available for line i: until the next line starts (AI subtitles are back-to-back).
function slotOf(lines, i) {
  const next = lines[i + 1];
  return Math.max(0.3, (next ? next.from : lines[i].to) - lines[i].from);
}

// Max words the translation of line i may use, at `rate` words/sec of natural speech.
function sylBudget(lines, i, rate) {
  return Math.max(2, Math.floor(slotOf(lines, i) * rate * 1.2));
}

// Index of the line showing at time t, or -1 in a gap.
function lineAt(lines, t) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].from <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 && t < lines[ans].to ? ans : -1;
}

// Speed up the voice first; if that still overruns the slot, slow the video down.
// slot is in video seconds; at userRate 1.5x it lasts slot/1.5 real seconds. videoRate is relative to userRate.
// tempo > 1 means the speaker talks faster than usual here; the voice speeds up at least that much.
function plan(syl, slot, sps, userRate = 1, tempo = 1) {
  const target = (slot / userRate) * SAFETY; // real seconds to finish within
  const maxTts = Math.min(3, MAX_TTS_RATE * Math.max(1, userRate)); // user chose fast playback: allow a faster voice
  const speech = syl / sps; // talking time at rate 1; the overhead doesn't shrink with rate
  const ttsRate = Math.min(maxTts, Math.max(1, tempo, speech / Math.max(0.2, target - UTTER_OVERHEAD)));
  const speakTime = speech / ttsRate + UTTER_OVERHEAD;
  const videoRate = speakTime > target ? Math.max(MIN_VIDEO_RATE, target / speakTime) : 1;
  return { ttsRate, videoRate };
}

// Median source chars/sec across the video: the speaker's normal pace.
function medianPace(lines) {
  const p = lines.map((l, i) => l.content.length / slotOf(lines, i)).sort((a, b) => a - b);
  return p.length ? p[p.length >> 1] : 1;
}

// How much faster than normal line i is spoken (e.g. an editor sped the clip up).
function tempoAt(lines, i, median) {
  return lines[i].content.length / slotOf(lines, i) / median;
}
