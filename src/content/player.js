// Playback state and TTS sync: speaks the current line, nudging voice and video speed to stay in sync.

const DUCK = 0.25; // original audio volume while dubbing
const HOLD_RATE = 0.8; // video speed while the previous sentence finishes speaking; lower is a visible lurch
const HOLD_MAX_MS = 3000; // Chrome sometimes never fires onend; stop waiting after this
const RATE_STEP = 0.3; // max voice slowdown between consecutive sentences, so the speed doesn't jump around
const RATE_RESET_MS = 1500; // after this much silence the voice may start fresh at its natural speed

let pending = -1, holdSince = 0; // next line waiting for the current utterance to finish
let grpEnd = -1; // last line of the sentence being read
let lastRate = 1, lastEnd = 0; // previous utterance's voice rate and when it ended

let on = false, lines = [], tr = [], say = [], tone = [], lex = [], cur = -1, pace = 1, utter = null, timer = 0;
let meter = null, level = 0, avgLevel = 0; // original-audio loudness: short (~0.3 s) and long (~5 s) averages
let video = null, voice = null, sps = 3.5, baseRate = 1, baseVol = 1; // sps reset per language on start
let ourRate = 1; // last playbackRate we set, to tell our changes from the user's

// The saved voice for this language if still installed, else the first voice speaking it.
function pickVoice(code, name) {
  const pick = () => {
    const all = speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').startsWith(langOf(code).tts));
    return all.find(v => v.name === name) || all[0];
  };
  return new Promise(resolve => {
    if (pick()) return resolve(pick());
    speechSynthesis.addEventListener('voiceschanged', () => resolve(pick()), { once: true });
    setTimeout(() => resolve(pick()), 2000);
  });
}

let meterTry = 0;

// Taps the video's audio without rerouting it (works even while ducked/muted).
// The stream has no audio track until the video plays, so sampleLoudness retries; any browser refusal just disables it.
function startMeter() {
  meterTry = performance.now();
  let ctx;
  try {
    const stream = video.captureStream();
    if (!stream.getAudioTracks().length) return;
    ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    const mute = ctx.createGain();
    mute.gain.value = 0; // keeps the graph running without playing the audio twice
    ctx.createMediaStreamSource(stream).connect(analyser).connect(mute).connect(ctx.destination);
    meter = { ctx, analyser, buf: new Float32Array(analyser.fftSize) };
  } catch {
    ctx?.close();
  }
}

function stopMeter() {
  meter?.ctx.close();
  meter = null;
  level = avgLevel = 0;
}

function sampleLoudness() {
  if (!meter) {
    if (!video.paused && performance.now() - meterTry > 2000) startMeter();
    return;
  }
  meter.analyser.getFloatTimeDomainData(meter.buf);
  let s = 0;
  for (const x of meter.buf) s += x * x;
  const rms = Math.sqrt(s / meter.buf.length);
  level = 0.6 * level + 0.4 * rms;
  if (rms > 0.005) avgLevel = avgLevel ? 0.98 * avgLevel + 0.02 * rms : rms; // silence doesn't drag the average down
}

function hush() {
  utter = null;
  pending = -1;
  grpEnd = -1;
  speechSynthesis.cancel();
  setRate(baseRate);
  cur = -1; // re-speak the current line on resume
}

function setRate(r) {
  ourRate = r;
  video.playbackRate = r;
}

// User picked a new speed in the player: adopt it as the base instead of overwriting it.
function onRate() {
  if (Math.abs(video.playbackRate - ourRate) > 1e-3) baseRate = ourRate = video.playbackRate;
}

function tick() {
  const [b, p] = currentPage();
  if (b !== bvid || p !== pageNo) return stop(); // Bilibili switched video without a page reload
  sampleLoudness();
  if (pending >= 0 && performance.now() - holdSince > HOLD_MAX_MS) speakPending();
  const i = lineAt(lines, video.currentTime);
  if (i === cur) return;
  cur = i;
  if (i < 0) return void (sub.textContent = '');
  sub.textContent = tr[i] || lines[i].content;
  if (!tr[i] || video.paused || i <= grpEnd) return; // i <= grpEnd: already read as part of the current sentence
  if (utter) {
    // Previous line still talking: let it finish its last words instead of cutting it, and slow the video meanwhile.
    pending = i;
    holdSince = performance.now();
    setRate(baseRate * HOLD_RATE);
  } else speak(i);
}

function speakPending() {
  const p = pending;
  pending = -1;
  speak(p);
}

function speak(i) {
  const j = (grpEnd = sentenceEnd(lines, tr, i));
  const parts = [];
  for (let k = i; k <= j; k++) parts.push(say[k] || tr[k]);
  const text = applyLexicon(parts.join(' '), lex), syl = syllables(text), t = toneOf(tone[i]);
  // Going faster than the plan needs is safe (finishes early); a sudden slowdown is what sounds jerky.
  const floor = performance.now() - lastEnd < RATE_RESET_MS ? lastRate - RATE_STEP : 1;
  const tempo = Math.max(tempoAt(lines, i, pace, j) * t.rate, floor);
  const { ttsRate, videoRate } = plan(syl, slotOf(lines, i, j), sps, baseRate, tempo);
  lastRate = ttsRate;
  utter = null;
  speechSynthesis.cancel();
  setRate(baseRate * videoRate);
  const u = (utter = new SpeechSynthesisUtterance(text));
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = ttsRate;
  u.pitch = t.pitch;
  u.volume = Math.min(1, t.volume * loudnessGain(level, avgLevel));
  const t0 = performance.now();
  u.onend = () => {
    if (u !== utter) return; // cancelled or replaced
    utter = null;
    lastEnd = performance.now();
    const talk = (performance.now() - t0) / 1000 - UTTER_OVERHEAD;
    if (talk > 0.3) sps = 0.8 * sps + 0.2 * (syl / (talk * ttsRate)); // learn this voice's real speed
    if (pending >= 0) speakPending();
    else setRate(baseRate);
  };
  speechSynthesis.speak(u);
}
