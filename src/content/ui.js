// On-video controls (dub / re-translate buttons) and the translated subtitle line.

const BTN_CSS = 'padding:6px 10px;border:0;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;font-size:14px;cursor:pointer;';

const bar = document.createElement('div');
bar.style.cssText = 'position:absolute;top:12px;left:12px;z-index:100;display:flex;gap:6px;';

const btn = document.createElement('button');
btn.textContent = 'Lồng tiếng';
btn.style.cssText = BTN_CSS;

const redo = document.createElement('button');
redo.textContent = '↻ Dịch lại';
redo.title = 'Bỏ bản dịch đã lưu của video này và dịch lại (kèm cách đọc)';
redo.style.cssText = BTN_CSS;

bar.append(btn, redo);

const sub = document.createElement('div');
sub.style.cssText =
  'position:absolute;left:5%;right:5%;bottom:14%;z-index:100;text-align:center;pointer-events:none;' +
  'color:#ffeb3b;font-size:22px;text-shadow:0 0 3px #000,0 0 3px #000;';

// shortcut: anchors inside Bilibili's video area so it survives fullscreen; update if the player DOM changes.
function mountUI(v) {
  const host = v.closest('.bpx-player-video-area') || v.parentElement;
  if (bar.parentElement !== host) host.append(bar, sub);
}
