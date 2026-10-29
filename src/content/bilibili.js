// Bilibili data access: which video is open, and its subtitles.

// Login cookies only for api.bilibili.com; the subtitle CDN rejects credentialed requests ("Failed to fetch").
const getJSON = url =>
  fetch(url, { credentials: url.includes('api.bilibili.com') ? 'include' : 'omit' }).then(r => r.json());

// [bvid, part number] of the open page (works for /video/ and /en/video/ URLs).
function currentPage() {
  return [location.pathname.match(/BV\w+/)?.[0], +new URLSearchParams(location.search).get('p') || 1];
}

// Chinese CC/AI subtitles of one video part. AI subtitles only show up when logged in.
async function loadSubtitles(bvid, pageNo) {
  const view = await getJSON(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
  const page = view.data?.pages?.[pageNo - 1] || view.data?.pages?.[0];
  if (!page) throw new Error('Không đọc được thông tin video.');
  const info = await getJSON(`https://api.bilibili.com/x/player/wbi/v2?bvid=${bvid}&cid=${page.cid}`);
  const subs = (info.data?.subtitle?.subtitles || []).filter(s => s.subtitle_url);
  const pick = subs.find(s => s.lan.includes('zh')) || subs[0];
  if (!pick) throw new Error('Video này không có phụ đề CC/AI (cần đăng nhập Bilibili; bản này chưa nhận giọng nói).');
  const lines = (await getJSON(pick.subtitle_url.replace(/^(https?:)?\/\//, 'https://'))).body || [];
  if (!lines.length) throw new Error('File phụ đề rỗng.');
  return { title: view.data.title, cid: page.cid, lan: pick.lan, lines };
}
