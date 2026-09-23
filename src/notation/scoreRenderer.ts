import {CanvasContext, Renderer, type RenderContext} from 'vexflow';

export interface ScoreViewport {sourceY: number; sourceHeight: number; pixelRatio: number}

/** The screen and PDF use the same engraving; only the rendering surface differs. */
export function scoreContext(container: HTMLDivElement | HTMLCanvasElement, width: number, height: number, viewport?: ScoreViewport): RenderContext {
  if (!viewport) {
    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(width, height);
    return renderer.getContext();
  }
  const renderer = new Renderer(container, Renderer.Backends.CANVAS);
  const context = renderer.getContext() as CanvasContext;
  context.resize(Math.ceil(width), Math.ceil(viewport.sourceHeight), viewport.pixelRatio);
  context.setFillStyle('#ffffff').fillRect(0, 0, width + 1, viewport.sourceHeight + 1);
  context.setFillStyle('#000000').setStrokeStyle('#000000');
  context.context2D.translate(0, -viewport.sourceY);
  return context;
}
