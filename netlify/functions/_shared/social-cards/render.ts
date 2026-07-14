/**
 * SVG → PNG rendering via native @resvg/resvg-js (N-API prebuilt binary).
 *
 * Runtime choice mirrors console.papercompute.com#157: the native binding
 * loads at import time in milliseconds, while wasm-based renderers pay a
 * fetch + compile that dominates cold starts. Lambda has no system fonts,
 * so Inter is vendored (font-data.ts) and passed as explicit buffers —
 * sharp/librsvg would silently render tofu here.
 */
import { Resvg, type ResvgRenderOptions } from '@resvg/resvg-js';
import { INTER_FONTS } from './font-data.generated.ts';

// @resvg/resvg-js 2.6.2 honors `font.fontBuffers` at runtime (verified:
// glyphs only render when the buffers are passed) but the published typings
// don't declare it yet.
type FontOptions = NonNullable<ResvgRenderOptions['font']> & { fontBuffers: Buffer[] };

// Decoded once per container; reused across invocations.
let fontBuffers: Buffer[] | null = null;

function getFontBuffers(): Buffer[] {
  if (!fontBuffers) {
    fontBuffers = INTER_FONTS.map((f) => Buffer.from(f.base64, 'base64'));
  }
  return fontBuffers;
}

export interface RenderResult {
  png: Buffer;
  resvgMs: number;
}

export function renderSvgToPng(svg: string): RenderResult {
  const t0 = performance.now();
  const font: FontOptions = {
    loadSystemFonts: false,
    fontBuffers: getFontBuffers(),
    defaultFontFamily: 'Inter',
  };
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font,
  });
  const png = resvg.render().asPng();
  return { png: Buffer.from(png), resvgMs: performance.now() - t0 };
}
