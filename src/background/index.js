// Service worker: answers content-script messages ({ type: 'estimate' | 'translate' }).
importScripts(
  '/src/shared/pricing.js',
  '/src/shared/timing.js',
  '/src/shared/prosody.js',
  '/src/shared/languages.js',
  '/src/shared/translation.js',
  '/src/background/claude.js',
  '/src/background/history.js'
);

async function estimate({ title, lines, lang }) {
  const { apiKey, model } = await settings();
  const { system, messages } = request(model, buildPrompt(title, lines, 0, lines.length, [], lang), lang);
  const { input_tokens } = await claude('/messages/count_tokens', { model, system, messages }, apiKey);
  // shortcut: assumes output ≈ input tokens; the real cost lands in history after each chunk.
  return { model, cost: costUSD(model, input_tokens, input_tokens) };
}

async function translate({ title, lines, start, end, ctx, video, bvid, lang }) {
  const { apiKey, model } = await settings();
  const d = await claude('/messages', request(model, buildPrompt(title, lines, start, end, ctx, lang), lang), apiKey);
  const used = PRICES[d.model] ? d.model : model; // a fallback may have served the request
  await record({
    ts: Date.now(), video, bvid, title, lang, model: used,
    inTok: d.usage.input_tokens, outTok: d.usage.output_tokens,
    cost: costUSD(used, d.usage.input_tokens, d.usage.output_tokens),
  });
  if (d.stop_reason === 'refusal') throw new Error('Claude từ chối dịch đoạn này.');
  if (d.stop_reason === 'max_tokens') throw new Error('Bản dịch bị cắt do quá dài.');
  const text = d.content.find(b => b.type === 'text')?.text || '{}';
  return parseTranslation(JSON.parse(text), start, end);
}

const handlers = { estimate, translate };

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  handlers[msg.type](msg)
    .then(send)
    .catch(e => send({ error: e.message }));
  return true; // async response
});
