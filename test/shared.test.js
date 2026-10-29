// Run: node test/shared.test.js
// Shared files are classic browser scripts (globals, no exports), so load them into one VM context like the browser does.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({});
for (const f of ['pricing', 'timing', 'lexicon', 'prosody', 'languages', 'translation']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/shared', f + '.js'), 'utf8'), ctx);
}
const L = vm.runInContext(
  '({ PRICES, CHUNK, costUSD, syllables, slotOf, sylBudget, lineAt, plan, medianPace, tempoAt, buildPrompt, parseTranslation, parseLexicon, applyLexicon, TONES, toneOf, loudnessGain, TRANSLATION_SCHEMA, LANGS, langOf, lexiconKey, voiceKey, cacheKey, systemPrompt })',
  ctx
);
// VM-realm objects have a different Object prototype; compare plain JSON copies.
const same = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b);

const lines = [
  { from: 0, to: 3, content: 'a' },
  { from: 3, to: 5, content: 'b' },
  { from: 6, to: 8, content: 'c' },
];

assert.strictEqual(L.lineAt(lines, 0), 0);
assert.strictEqual(L.lineAt(lines, 4.9), 1);
assert.strictEqual(L.lineAt(lines, 5.5), -1); // gap
assert.strictEqual(L.lineAt(lines, 9), -1);
assert.strictEqual(L.lineAt([], 1), -1);

assert.strictEqual(L.slotOf(lines, 1), 3); // runs until next line starts
assert.strictEqual(L.slotOf(lines, 2), 2);
assert.strictEqual(L.sylBudget(lines, 0, 5), 18);
assert.strictEqual(L.sylBudget(lines, 0, 2.8), 10);

assert.strictEqual(L.syllables('  xin chào   thế giới '), 4);

const near = (a, b) => Math.abs(a - b) < 1e-6;
// fits within 85% of the slot plus start/end overhead: no speed change
same(L.plan(10, 3, 5), { ttsRate: 1, videoRate: 1 });
// fills exactly 100% of the slot: voice now speeds up to finish early instead of being clipped
assert.ok(L.plan(15, 3, 5).ttsRate > 1.25);
// a bit long: voice speeds up so speech + overhead ends at 85% of the slot, video untouched
const a = L.plan(18, 3, 5);
assert.ok(near(a.ttsRate, 3.6 / 2.3) && near(a.videoRate, 1));
// way too long: voice capped at 2x, video slows, never below the floor
const p = L.plan(35, 3, 5);
assert.strictEqual(p.ttsRate, 2);
assert.strictEqual(p.videoRate, 0.75);
assert.strictEqual(L.plan(100, 1, 5).videoRate, 0.75);
// user plays at 2x: slot halves, voice goes ~2.9x, no video slowdown
const b = L.plan(15, 3, 5, 2);
assert.ok(near(b.ttsRate, 3 / 1.025) && near(b.videoRate, 1));
// voice capped at 3x even when user plays faster
assert.strictEqual(L.plan(30, 3, 5, 3).ttsRate, 3);
// speaker talks 1.6x faster than usual: voice speeds up even though the short translation fits
same(L.plan(5, 3, 5, 1, 1.6), { ttsRate: 1.6, videoRate: 1 });
// a slow line never slows the voice below 1x
assert.strictEqual(L.plan(5, 3, 5, 1, 0.5).ttsRate, 1);

// pace: median chars/sec; a sped-up line reads as tempo > 1
const paced = [
  { from: 0, to: 2, content: 'aaaa' },     // 2 cps
  { from: 2, to: 4, content: 'aaaa' },     // 2 cps
  { from: 4, to: 5, content: 'aaaaaaaa' }, // 8 cps, editor sped it up
];
assert.strictEqual(L.medianPace(paced), 2);
assert.strictEqual(L.tempoAt(paced, 2, 2), 4);
assert.strictEqual(L.medianPace([]), 1);

assert.ok(Math.abs(L.costUSD('claude-haiku-5-5', 1e6, 1e6) - 0.6) < 1e-9);
assert.strictEqual(L.costUSD('unknown', 5, 5), 0);

// untrusted output: out-of-range, wrong types and missing lines are dropped
same(
  L.parseTranslation({ lines: [{ i: 41, text: ' một AI ', say: 'một ây ai' }, { i: 99, text: 'x' }, { i: 42, text: 3 }] }, 40, 43),
  { tr: ['', 'một AI', ''], say: ['', 'một ây ai', ''], tone: ['neutral', 'neutral', 'neutral'] }
);
same(L.parseTranslation(null, 0, 2), { tr: ['', ''], say: ['', ''], tone: ['neutral', 'neutral'] });
// tone: known values kept, unknown or prototype keys fall back to neutral
same(
  L.parseTranslation({ lines: [{ i: 0, text: 'a', say: '', tone: 'excited' }, { i: 1, text: 'b', say: '', tone: 'toString' }] }, 0, 2).tone,
  ['excited', 'neutral']
);

// prosody
same(L.TRANSLATION_SCHEMA.properties.lines.items.properties.tone.enum, Object.keys(L.TONES));
assert.strictEqual(L.toneOf('question').pitch, 1.1);
assert.strictEqual(L.toneOf('constructor'), L.TONES.neutral);
assert.strictEqual(L.toneOf(undefined), L.TONES.neutral);
assert.strictEqual(L.loudnessGain(0.1, 0.1), 1);
assert.strictEqual(L.loudnessGain(1, 0.1), 1.3); // shouting: capped
assert.strictEqual(L.loudnessGain(0, 0.1), 0.7); // whisper: floored
assert.strictEqual(L.loudnessGain(0.5, 0), 1); // no average yet (meter off or silence)

// pronunciation dictionary: case-sensitive whole words only
const lex = L.parseLexicon('AI = ây ai\n  ComfyUI=com phi diu ai \nbroken line\n= x');
same(lex, [['AI', 'ây ai'], ['ComfyUI', 'com phi diu ai']]);
assert.strictEqual(L.applyLexicon('ai biết AI, dùng ComfyUI và MAIL?', lex), 'ai biết ây ai, dùng com phi diu ai và MAIL?');
assert.strictEqual(L.applyLexicon('AI-tạo', lex), 'ây ai-tạo');
same(L.parseLexicon(''), []);
same(L.parseLexicon('C++ = xê cộng cộng'), [['C++', 'xê cộng cộng']]);
assert.strictEqual(L.applyLexicon('học C++ nhé', L.parseLexicon('C++ = xê cộng cộng')), 'học xê cộng cộng nhé');

const prompt = L.buildPrompt('T', lines, 1, 3, [{ zh: 'a', tr: 'A' }], 'vi');
assert.ok(prompt.includes('[1] (≤18) b') && prompt.includes('[2] (≤12) c') && prompt.includes('- a => A'));
assert.ok(!prompt.includes('[0]'));
// English budgets in words at a slower rate
assert.ok(L.buildPrompt('T', lines, 1, 2, [], 'en').includes('[1] (≤10) b'));

// languages
assert.strictEqual(L.langOf('en').name, 'English');
assert.strictEqual(L.langOf('xx'), L.LANGS.vi);
assert.strictEqual(L.langOf('__proto__'), L.LANGS.vi);
// Vietnamese keeps the pre-multilanguage storage keys so earlier translations and lexicons still load
assert.strictEqual(L.cacheKey('BV1', 7, 'ai-zh', 'vi'), 'tr:BV1:7:ai-zh');
assert.strictEqual(L.cacheKey('BV1', 7, 'ai-zh', 'en'), 'tr:BV1:7:ai-zh:en');
assert.strictEqual(L.lexiconKey('vi'), 'lexicon');
assert.strictEqual(L.lexiconKey('en'), 'lexicon:en');
assert.strictEqual(L.voiceKey('en'), 'voice:en');
assert.ok(L.systemPrompt('en').includes('into English') && L.systemPrompt('en').includes('pinyin'));
assert.ok(L.systemPrompt('vi').includes('Hán Việt'));

console.log('all tests passed');
