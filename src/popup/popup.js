const $ = id => document.getElementById(id);

const MODEL_NAMES = {
  'claude-haiku-5-5': 'Haiku 5.5 · nhanh, rẻ nhất',
  'claude-sonnet-5-5': 'Sonnet 5.5 · cân bằng',
  'claude-opus-5-5': 'Opus 5.5 · chất lượng cao nhất',
};

const store = chrome.storage.local;
const s = await store.get(null);
let lang = Object.hasOwn(LANGS, s.lang) ? s.lang : 'vi';

// ---------- Tabs ----------
for (const tab of document.querySelectorAll('[role="tab"]')) {
  tab.onclick = () => {
    for (const t of document.querySelectorAll('[role="tab"]')) {
      t.setAttribute('aria-selected', String(t === tab));
      $(t.getAttribute('aria-controls')).hidden = t !== tab;
    }
  };
}

// ---------- Auto-save ----------
let savedTimer = 0;
async function save(values) {
  await store.set(values);
  $('saved').classList.add('show');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => $('saved').classList.remove('show'), 1400);
}
const debounce = (fn, ms) => {
  let t = 0;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
};

function renderStatus(apiKey) {
  $('status').textContent = apiKey ? 'Sẵn sàng' : 'Thiếu API key';
  $('status').className = 'chip ' + (apiKey ? 'ok' : 'warn');
}

// ---------- Language ----------
for (const [code, L] of Object.entries(LANGS)) {
  const label = document.createElement('label');
  label.innerHTML = `<input type="radio" name="lang" value="${code}"><span></span>`;
  label.querySelector('span').textContent = L.name;
  label.querySelector('input').checked = code === lang;
  $('lang').append(label);
}
$('lang').onchange = async e => {
  lang = e.target.value;
  await save({ lang });
  fillLanguage();
};

// ---------- Voice ----------
function voicesFor(code) {
  return speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').startsWith(langOf(code).tts));
}

async function fillVoices() {
  const saved = (await store.get(voiceKey(lang)))[voiceKey(lang)] || '';
  const list = voicesFor(lang);
  $('voice').replaceChildren(new Option('Tự động (giọng đầu tiên)', ''));
  for (const v of list) $('voice').add(new Option(v.localService ? v.name : `${v.name} · online`, v.name));
  $('voice').value = list.some(v => v.name === saved) ? saved : '';
  $('preview').disabled = !list.length;
  $('voice-hint').textContent = list.length
    ? `${list.length} giọng ${langOf(lang).name} trên máy này.`
    : `Chưa có giọng ${langOf(lang).name}. macOS: System Settings › Accessibility › Spoken Content › System voice › Manage Voices.`;
}
speechSynthesis.onvoiceschanged = fillVoices;

$('voice').onchange = () => save({ [voiceKey(lang)]: $('voice').value });

function setPreviewing(on) {
  $('preview').setAttribute('aria-pressed', String(on));
  $('preview').setAttribute('aria-label', on ? 'Dừng nghe thử' : 'Nghe thử giọng đọc');
  $('preview-icon').innerHTML = on ? '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/>' : '<path d="M4 2.5v9l7-4.5z"/>';
}
$('preview').onclick = () => {
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    return setPreviewing(false);
  }
  const list = voicesFor(lang);
  const u = new SpeechSynthesisUtterance(langOf(lang).sample);
  u.voice = list.find(v => v.name === $('voice').value) || list[0];
  u.lang = u.voice?.lang || langOf(lang).tts;
  u.onend = u.onerror = () => setPreviewing(false);
  setPreviewing(true);
  speechSynthesis.speak(u);
};

// ---------- Lexicon ----------
async function fillLexicon() {
  const k = lexiconKey(lang);
  $('lexicon').value = (await store.get(k))[k] ?? langOf(lang).defaultLexicon;
  $('lexicon').placeholder = lang === 'vi' ? 'AI = ây ai\nComfyUI = com phi diu ai' : 'Doubao = Dough-bow';
}
$('lexicon').oninput = debounce(() => save({ [lexiconKey(lang)]: $('lexicon').value }), 400);

function fillLanguage() {
  speechSynthesis.cancel();
  setPreviewing(false);
  fillVoices();
  fillLexicon();
}

// ---------- Model & key ----------
for (const m of Object.keys(PRICES)) $('model').add(new Option(MODEL_NAMES[m] || m, m));
$('model').value = PRICES[s.model] ? s.model : 'claude-haiku-5-5';
const modelHint = () => {
  const [i, o] = PRICES[$('model').value];
  $('model-hint').textContent = `$${i} vào / $${o} ra mỗi 1 triệu token.`;
};
modelHint();
$('model').onchange = () => { modelHint(); save({ model: $('model').value }); };

$('key').value = s.apiKey || '';
renderStatus(s.apiKey);
$('key').oninput = debounce(() => {
  const apiKey = $('key').value.trim();
  renderStatus(apiKey);
  save({ apiKey });
}, 400);
$('reveal').onclick = () => {
  const show = $('key').type === 'password';
  $('key').type = show ? 'text' : 'password';
  $('reveal').setAttribute('aria-pressed', String(show));
  $('reveal').setAttribute('aria-label', show ? 'Ẩn API key' : 'Hiện API key');
};

fillLanguage();

// ---------- Costs ----------
const history = s.history || [];
const usd = n => '$' + (n >= 1 ? n.toFixed(2) : n.toFixed(4));
const now = new Date();
const sum = pred => history.filter(h => pred(new Date(h.ts))).reduce((a, h) => a + h.cost, 0);
$('today').textContent = usd(sum(d => d.toDateString() === now.toDateString()));
$('month').textContent = usd(sum(d => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()));
$('total').textContent = usd(sum(() => true));

if (!history.length) {
  $('history').innerHTML =
    '<li class="empty"><div><strong>Chưa có lượt dịch nào</strong>Mở một video Bilibili có phụ đề rồi bấm Lồng tiếng.</div></li>';
  $('csv').disabled = true;
}
for (const h of [...history].reverse()) {
  const li = document.createElement('li');
  const what = document.createElement('div');
  what.className = 'what';
  const a = document.createElement('a');
  a.href = `https://www.bilibili.com/video/${h.bvid}`;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.title = h.title;
  a.textContent = h.title;
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = [
    new Date(h.ts).toLocaleDateString('vi-VN'),
    (MODEL_NAMES[h.model] || h.model).split(' ·')[0],
    langOf(h.lang).short,
  ].join(' · ');
  what.append(a, meta);
  const cost = document.createElement('span');
  cost.className = 'cost';
  cost.textContent = usd(h.cost);
  li.append(what, cost);
  $('history').append(li);
}

$('csv').onclick = () => {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['time', 'bvid', 'title', 'lang', 'model', 'input_tokens', 'output_tokens', 'cost_usd']].concat(
    history.map(h => [new Date(h.ts).toISOString(), h.bvid, h.title, h.lang || 'vi', h.model, h.inTok, h.outTok, h.cost])
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv' }));
  a.download = 'bilibili-dub-cost.csv';
  a.click();
};
