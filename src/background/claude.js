// Claude API client. Raw fetch: a no-build MV3 extension can't bundle the npm SDK.

const API = 'https://api.anthropic.com/v1';

async function settings() {
  const { apiKey = '', model = 'claude-haiku-5-5' } = await chrome.storage.local.get(['apiKey', 'model']);
  if (!apiKey) throw new Error('Chưa nhập Claude API key (bấm icon extension để nhập).');
  return { apiKey, model };
}

async function claude(path, body, apiKey) {
  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2026-10-21',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (body.fallbacks) headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  const r = await fetch(API + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Claude API ${r.status}: ${d.error?.message || r.statusText}`);
  return d;
}

function request(model, prompt, lang) {
  const body = {
    model,
    max_tokens: 16000,
    system: systemPrompt(lang),
    output_config: { effort: 'low', format: { type: 'json_schema', schema: TRANSLATION_SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  };
  // Haiku has no server-side fallback; Sonnet/Opus 5.5 re-run on another model if they refuse.
  if (model !== 'claude-haiku-5-5') body.fallbacks = 'default';
  return body;
}
