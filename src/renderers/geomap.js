import { h } from './dom.js';
import { makeFullscreenable } from '../app/fullscreen.js';

// geoMap — 地図エンジンを任意 rect(パネル/結果サーフェス) に載せるレンダラ。
//
// OpaDeck コアは three.js や地図アセットに依存しない。実エンジン(tetsugo の
// mapcore 等)は host が `mapFactory(canvas, { data, onPick })` として注入する。
// factory は { refresh?, resize?, destroy?, setLayers? } を持つハンドルを返す想定。
//
//   const geoMap = createGeoMapPanelRenderer({
//     mapFactory: (canvas, { data, onPick }) => createRenderer2D(canvas, { model: createMapModel(data), onPick }),
//   });
//   panelRenderers.register(geoMap);
//
// render(ctx) が期待するもの:
//   { document, panel?, data, onPick?, mapFactory?, fullscreen? }
// ctx.mapFactory は登録時の既定を上書きできる。fullscreen!==false なら全画面ボタン付き。
export function createGeoMapPanelRenderer(defaults = {}) {
  return {
    id: 'geoMap',
    render(ctx) {
      const doc = ctx.document;
      const mapFactory = ctx.mapFactory || defaults.mapFactory;
      const panelId = (ctx.panel && ctx.panel.id) || ctx.panelId;

      const surface = h(doc, 'div', {
        class: 'opa-geomap',
        dataset: panelId ? { panelId } : undefined,
      });
      // レンダラがサイズを取れるよう、明示的に埋める箱にする
      surface.style.position = surface.style.position || 'relative';
      surface.style.width = '100%';
      surface.style.height = surface.style.height || '100%';
      surface.style.minHeight = surface.style.minHeight || '320px';

      const canvas = h(doc, 'canvas', { class: 'opa-geomap-canvas' });
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      surface.appendChild(canvas);

      if (typeof mapFactory !== 'function') {
        surface.appendChild(h(doc, 'div', {
          class: 'opa-geomap-empty',
          text: 'geoMap: mapFactory が未注入です（host が地図エンジンを供給してください）。',
        }));
        return surface;
      }

      let handle = null;
      try {
        const result = mapFactory(canvas, { data: ctx.data, onPick: ctx.onPick, document: doc });
        // mapFactory は同期ハンドルか Promise<ハンドル> のどちらでも可
        if (result && typeof result.then === 'function') {
          result.then((h2) => { handle = h2; }).catch(() => {});
        } else {
          handle = result;
        }
      } catch (error) {
        surface.appendChild(h(doc, 'div', { class: 'opa-geomap-error', text: `geoMap init 失敗: ${error && error.message ? error.message : error}` }));
        return surface;
      }

      if (ctx.fullscreen !== false) {
        const fs = makeFullscreenable(surface, {
          document: doc,
          label: '地図を全画面',
          onChange: () => {
            // rect が変わるのでレンダラへサイズ再計算を促す
            const live = handle;
            if (live && typeof live.resize === 'function') live.resize();
            else if (live && typeof live.refresh === 'function') live.refresh();
          },
        });
        fs.button.classList.add('opa-geomap-fs');
        surface.__fullscreen = fs;
      }

      surface.__mapHandle = () => handle;
      return surface;
    },
  };
}
