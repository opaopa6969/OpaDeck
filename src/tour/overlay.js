// Default DOM overlay for the tour runtime. It renders a scrim, a spotlight over
// the resolved target element, and a narration card whose buttons drive the
// player controls. It deliberately knows nothing about operations or fields: it
// only paints the (element, step) pair the runtime hands it.
//
// The markup mirrors the showcase tour styles (tour-scrim / tour-spotlight /
// tour-card), so existing CSS applies unchanged.

export function createDefaultTourOverlay(options = {}) {
  const doc = options.document || (typeof globalThis.document !== 'undefined' ? globalThis.document : null);
  const root = options.root || (doc ? doc.getElementById('tour-root') : null);
  const viewport = options.viewport || (typeof globalThis.window !== 'undefined' ? globalThis.window : null);

  if (!doc || !root) {
    // No DOM available (e.g. headless): degrade to a no-op overlay so the
    // runtime can still sequence steps and emit events.
    return { start() {}, renderStep() {}, finish() {} };
  }

  return {
    start() {
      root.hidden = false;
    },

    renderStep(view) {
      const { step, index, total, element, controls } = view;
      const rect = element && typeof element.getBoundingClientRect === 'function'
        ? element.getBoundingClientRect()
        : null;
      const padding = 10;
      const vw = viewport ? viewport.innerWidth : 1024;
      const vh = viewport ? viewport.innerHeight : 768;

      const spotlight = rect
        ? `<div class="tour-spotlight" style="top:${rect.top - padding}px;left:${rect.left - padding}px;width:${rect.width + padding * 2}px;height:${rect.height + padding * 2}px"></div>`
        : '';
      const cardTop = rect ? Math.min(vh - 220, rect.bottom + 18) : Math.max(24, vh / 2 - 110);
      const cardLeft = rect ? Math.min(vw - 390, Math.max(18, rect.left)) : Math.max(18, vw / 2 - 190);

      root.hidden = false;
      root.innerHTML = `
        <div class="tour-scrim"></div>
        ${spotlight}
        <div class="tour-card" style="top:${cardTop}px;left:${cardLeft}px">
          <p class="tour-meta">Step ${index + 1} / ${total}</p>
          <h3>${escapeHtml(step.title || '')}</h3>
          <p>${escapeHtml(step.narration || '')}</p>
          <div class="tour-actions">
            <button class="button ghost" data-tour-action="close">Close</button>
            <div>
              ${index > 0 ? '<button class="button ghost" data-tour-action="prev">Back</button>' : ''}
              <button class="button primary" data-tour-action="next">${index === total - 1 ? 'Finish' : 'Next'}</button>
            </div>
          </div>
        </div>
      `;

      wire(root, 'close', () => controls.finish());
      wire(root, 'prev', () => controls.prev());
      wire(root, 'next', () => controls.next());
    },

    finish() {
      root.hidden = true;
      root.innerHTML = '';
    },
  };

  function wire(container, action, handler) {
    const button = container.querySelector(`[data-tour-action="${action}"]`);
    if (button) {
      button.addEventListener('click', handler);
    }
  }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[char]));
}
