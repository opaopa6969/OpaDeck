import { renderGeoScene } from './geo-scene-renderer.js';

// geoScene is usable as both a result renderer and a panel renderer; both just
// adapt their context onto the same generic renderer.

export function createGeoSceneResultRenderer() {
  return {
    id: 'geoScene',
    canRender(ctx) {
      return Boolean(ctx && ctx.resultView && ctx.resultView.renderer === 'geoScene');
    },
    render(ctx) {
      return renderGeoScene(adaptResultContext(ctx));
    },
  };
}

export function createGeoScenePanelRenderer() {
  return {
    id: 'geoScene',
    render(ctx) {
      return renderGeoScene(ctx);
    },
  };
}

function adaptResultContext(ctx) {
  return {
    document: ctx.document,
    scene: ctx.scene || (ctx.resultView && ctx.resultView.options) || {},
    // A geoScene response may carry its layer data either as an explicit data
    // map (ctx.data) or inline on the parsed body.
    data: ctx.data || (ctx.bodyJson && ctx.bodyJson.sources) || {},
    baseMap: ctx.baseMap,
    onSelect: ctx.onSelect,
    view: ctx.view,
    interactive: ctx.interactive,
  };
}
