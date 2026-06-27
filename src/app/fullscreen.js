// fullscreen.js — OpaDeck コンポーネント共通の「全画面 / 復帰」インターフェイス。
// Fullscreen API を使い、未対応・拒否時は固定オーバーレイ(position:fixed inset:0)へ
// フォールバックする。地図やチャートなど rect 内に描くレンダラが opt-in できる。
//
//   const fs = makeFullscreenable(panelEl, { onChange: (on) => renderer.resize() });
//   fs.button   // ツールバーに置けるトグルボタン(要素は内部で element 末尾に追加済み)
//   fs.toggle() / fs.enter() / fs.exit() / fs.isFullscreen()
//
// onChange(isFullscreen) は状態が変わるたびに呼ばれる。canvas/WebGL レンダラは
// ここでサイズ再計算すればよい(rect が変わるため)。

export function makeFullscreenable(element, options = {}) {
  const doc = options.document || element.ownerDocument || globalThis.document;
  const onChange = typeof options.onChange === 'function' ? options.onChange : null;
  let overlayActive = false;
  const savedStyle = {};

  const button = doc.createElement('button');
  button.className = 'opa-fs-btn';
  button.type = 'button';
  button.title = options.label || 'Fullscreen';
  button.textContent = '⤢';
  button.addEventListener('click', () => toggle());
  if (options.mountButton !== false) element.appendChild(button);

  function nativeSupported() {
    return typeof element.requestFullscreen === 'function'
      && (doc.fullscreenEnabled === undefined || doc.fullscreenEnabled);
  }
  function isFullscreen() {
    return doc.fullscreenElement === element || overlayActive;
  }

  function enterOverlay() {
    if (overlayActive) return;
    overlayActive = true;
    const s = element.style;
    for (const key of ['position', 'inset', 'zIndex', 'width', 'height', 'margin']) savedStyle[key] = s[key];
    s.position = 'fixed';
    s.inset = '0';
    s.zIndex = '99999';
    s.width = '100%';
    s.height = '100%';
    s.margin = '0';
    element.classList.add('opa-fs-overlay');
  }
  function exitOverlay() {
    if (!overlayActive) return;
    overlayActive = false;
    const s = element.style;
    for (const key of Object.keys(savedStyle)) s[key] = savedStyle[key] || '';
    element.classList.remove('opa-fs-overlay');
  }

  function enter() {
    if (isFullscreen()) return;
    if (nativeSupported()) {
      const result = element.requestFullscreen();
      if (result && typeof result.catch === 'function') result.catch(() => { enterOverlay(); notify(); });
    } else {
      enterOverlay();
    }
    notify();
  }
  function exit() {
    if (doc.fullscreenElement === element && typeof doc.exitFullscreen === 'function') {
      const result = doc.exitFullscreen();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    }
    exitOverlay();
    notify();
  }
  function toggle() { if (isFullscreen()) exit(); else enter(); }

  function notify() {
    button.textContent = isFullscreen() ? '⤡' : '⤢';
    button.title = isFullscreen() ? 'Exit fullscreen' : (options.label || 'Fullscreen');
    if (onChange) onChange(isFullscreen());
  }

  const onFsChange = () => {
    // ネイティブ全画面が外部(ESC/ブラウザUI)で解除されたら状態を合わせる
    if (!doc.fullscreenElement && !overlayActive) notify();
    else notify();
  };
  const onKey = (e) => { if (e.key === 'Escape' && overlayActive) exit(); };
  if (typeof doc.addEventListener === 'function') {
    doc.addEventListener('fullscreenchange', onFsChange);
    doc.addEventListener('keydown', onKey);
  }

  return {
    button,
    enter,
    exit,
    toggle,
    isFullscreen,
    destroy() {
      if (typeof doc.removeEventListener === 'function') {
        doc.removeEventListener('fullscreenchange', onFsChange);
        doc.removeEventListener('keydown', onKey);
      }
      exitOverlay();
      if (button.parentNode) button.parentNode.removeChild(button);
    },
  };
}
