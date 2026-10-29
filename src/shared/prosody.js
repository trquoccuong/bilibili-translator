// Expressiveness for the browser voice: per-line tone from Claude + loudness of the original audio.

// Web Speech values: pitch 0–2 (1 = normal), volume 0–1. rate is a floor on top of the timing plan.
const TONES = {
  neutral: { pitch: 1, rate: 1, volume: 0.85 },
  excited: { pitch: 1.15, rate: 1.1, volume: 1 },
  calm: { pitch: 0.95, rate: 1, volume: 0.75 },
  question: { pitch: 1.1, rate: 1, volume: 0.85 },
  emphasis: { pitch: 1.05, rate: 1, volume: 1 },
  sad: { pitch: 0.9, rate: 1, volume: 0.7 },
};

const toneOf = t => (Object.hasOwn(TONES, t) ? TONES[t] : TONES.neutral);

// Original audio louder/quieter than its running average nudges our volume, within ±30%.
function loudnessGain(level, avg) {
  if (!(avg > 0) || !(level >= 0)) return 1;
  return Math.min(1.3, Math.max(0.7, Math.sqrt(level / avg)));
}
