// Entry point: wires the buttons, loads subtitles, runs translation in the background and starts/stops dubbing.

let title = '', key = '', bvid = '', pageNo = 1, lang = 'vi';

const idleLabel = () => `${langOf(lang).flag} Lồng tiếng`;

chrome.storage.local.get('lang').then(s => {
  lang = s.lang || 'vi';
  if (!on) btn.textContent = idleLabel();
});

chrome.storage.onChanged.addListener(c => {
  if (c[lexiconKey(lang)]) lex = parseLexicon(c[lexiconKey(lang)].newValue);
  if (c.lang && !on) {
    lang = c.lang.newValue || 'vi'; // takes effect on the next start
    btn.textContent = idleLabel();
  }
});

setInterval(() => {
  const v = document.querySelector('video, bwp-video');
  if (!v) return;
  if (!on) video = v;
  mountUI(v);
}, 1000);

const run = fresh => start(fresh).catch(e => { stop(); sub.textContent = '⚠️ ' + e.message; });
btn.onclick = () => (on ? stop() : run(false));
redo.onclick = () => { stop(); run(true); };

async function send(msg) {
  const res = await chrome.runtime.sendMessage(msg);
  if (res?.error) throw new Error(res.error);
  return res;
}

// fresh: ignore the cached translation; the cache is only overwritten once new chunks arrive.
async function start(fresh = false) {
  [bvid, pageNo] = currentPage();
  if (!bvid || !video) throw new Error('Không tìm thấy video.');
  btn.disabled = redo.disabled = true;
  sub.textContent = 'Đang lấy phụ đề...';
  try {
    const prefs = await chrome.storage.local.get('lang');
    lang = prefs.lang || 'vi';
    const L = langOf(lang);
    const s = await loadSubtitles(bvid, pageNo);
    lines = s.lines;
    title = s.title;
    pace = medianPace(lines);
    key = cacheKey(bvid, s.cid, s.lan, lang);
    const saved = await chrome.storage.local.get([key, key + ':say', key + ':tone', lexiconKey(lang), voiceKey(lang)]);
    tr = (!fresh && saved[key]) || [];
    // say/tone are absent for videos translated before those features existed
    say = (!fresh && saved[key + ':say']) || [];
    tone = (!fresh && saved[key + ':tone']) || [];
    lex = parseLexicon(saved[lexiconKey(lang)] ?? L.defaultLexicon);

    const todo = lines.filter((_, i) => tr[i] === undefined);
    if (todo.length) {
      sub.textContent = 'Đang ước tính chi phí...';
      const est = await send({ type: 'estimate', title, lines: todo, lang });
      if (!confirm(`Dịch ${todo.length} câu sang ${L.name} bằng ${est.model}\nƯớc tính ~$${est.cost.toFixed(4)}. Tiếp tục?`)) {
        throw new Error('Đã huỷ.');
      }
    }
    voice = await pickVoice(lang, saved[voiceKey(lang)]);
    if (!voice) throw new Error(`Máy chưa có giọng đọc ${L.name} (macOS: System Settings › Accessibility › Spoken Content).`);
    sps = L.voiceGuess;
  } finally {
    btn.disabled = redo.disabled = false;
  }

  on = true;
  cur = -1;
  baseRate = ourRate = video.playbackRate;
  baseVol = video.volume;
  video.volume = baseVol * DUCK;
  video.addEventListener('pause', hush);
  video.addEventListener('seeking', hush);
  video.addEventListener('ratechange', onRate);
  startMeter();
  btn.textContent = '⏹ Tắt lồng tiếng';
  sub.textContent = '';
  timer = setInterval(tick, 100);
  translateLoop();
}

function stop() {
  if (on) {
    on = false;
    clearInterval(timer);
    hush();
    stopMeter();
    video.volume = baseVol;
    video.removeEventListener('pause', hush);
    video.removeEventListener('seeking', hush);
    video.removeEventListener('ratechange', onRate);
  }
  btn.textContent = idleLabel();
  sub.textContent = '';
}

const chunkDone = c => {
  for (let i = c * CHUNK; i < Math.min(lines.length, (c + 1) * CHUNK); i++) if (tr[i] === undefined) return false;
  return true;
};

// Translate the chunk under the playhead first, then forward, then wrap to earlier ones.
async function translateLoop() {
  const n = Math.ceil(lines.length / CHUNK);
  const myLines = lines;
  while (on && lines === myLines) {
    const done = lines.filter((_, i) => tr[i] !== undefined).length;
    btn.textContent = `⏹ Tắt lồng tiếng · ${done < lines.length ? `⏳ đã dịch ${done}/${lines.length}` : '✓ dịch xong'}`;
    const from = Math.floor(Math.max(cur, 0) / CHUNK);
    let c = -1;
    for (let k = 0; k < n && c < 0; k++) if (!chunkDone((from + k) % n)) c = (from + k) % n;
    if (c < 0) return;
    const start = c * CHUNK, end = Math.min(lines.length, start + CHUNK), ctxStart = Math.max(0, start - 8);
    const ctx = lines.slice(ctxStart, start).map((l, k) => ({ zh: l.content, tr: tr[ctxStart + k] || '' }));
    try {
      const res = await send({ type: 'translate', title, lines, start, end, ctx, video: key, bvid, lang });
      if (lines !== myLines) return; // user switched video meanwhile
      res.tr.forEach((t, k) => (tr[start + k] = t));
      res.say.forEach((s, k) => (say[start + k] = s));
      res.tone.forEach((t, k) => (tone[start + k] = t));
      await chrome.storage.local.set({ [key]: tr, [key + ':say']: say, [key + ':tone']: tone });
    } catch (e) {
      if (on) sub.textContent = '⚠️ ' + e.message; // progress is cached; toggling again resumes
      return;
    }
  }
}
