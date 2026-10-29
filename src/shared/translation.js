// Translation prompt, output schema and parsing.
// Depends on timing.js (sylBudget), prosody.js (TONES) and languages.js (langOf).

const CHUNK = 40; // subtitle lines per Claude request

function systemPrompt(lang) {
  const L = langOf(lang);
  return `You are a dubbing translator. Translate Chinese video subtitles into ${L.name} so a text-to-speech voice can read them in sync with the video.
- Natural spoken ${L.name}, the way people actually talk.
- Keep names and terms consistent across the whole video.
- NEVER exceed a line's maximum ${L.unit} count; drop minor details, keep the main point.
- Auto-generated subtitles may contain recognition errors: infer the intended words from context.
- text is shown on screen. say is what the voice reads: spell abbreviations, foreign words, names, numbers and symbols the way a ${L.name} speaker pronounces them (e.g. ${L.sayExamples}). Leave say empty when it would equal text. The length limit applies to the spoken version.
- Use expressive punctuation (commas, "...", "!", "?") in text and say so the voice pauses and inflects like a person.
- tone is the line's delivery from context and the speaker's emotion: neutral, excited, calm, question, emphasis, sad.
- Return every requested line with its exact index i.
${L.notes}`;
}

const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          text: { type: 'string' },
          say: { type: 'string' },
          tone: { type: 'string', enum: Object.keys(TONES) },
        },
        required: ['i', 'text', 'say', 'tone'],
        additionalProperties: false,
      },
    },
  },
  required: ['lines'],
  additionalProperties: false,
};

// ctx: the few lines before this chunk, [{ zh, tr }], so the translation keeps its thread.
function buildPrompt(title, lines, start, end, ctx, lang) {
  const L = langOf(lang);
  const todo = [];
  for (let i = start; i < end; i++) todo.push(`[${i}] (≤${sylBudget(lines, i, L.natural)}) ${lines[i].content}`);
  const before = ctx.length
    ? `Previous lines (context only, do NOT translate again):\n${ctx.map(c => `- ${c.zh} => ${c.tr}`).join('\n')}\n\n`
    : '';
  return `Video title: ${title}\n\n${before}Translate these lines. Format: [index] (max ${L.unit}) source\n${todo.join('\n')}`;
}

// Model output is untrusted: keep only in-range indices with string text; '' marks a missing line / no respelling.
function parseTranslation(obj, start, end) {
  const n = end - start;
  const tr = new Array(n).fill(''), say = new Array(n).fill(''), tone = new Array(n).fill('neutral');
  for (const l of obj?.lines || []) {
    if (!Number.isInteger(l.i) || l.i < start || l.i >= end || typeof l.text !== 'string') continue;
    tr[l.i - start] = l.text.trim();
    if (typeof l.say === 'string') say[l.i - start] = l.say.trim();
    if (Object.hasOwn(TONES, l.tone)) tone[l.i - start] = l.tone;
  }
  return { tr, say, tone };
}
