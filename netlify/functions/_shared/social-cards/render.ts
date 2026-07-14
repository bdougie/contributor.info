/**
 * SVG → PNG rendering via native @resvg/resvg-js (N-API prebuilt binary).
 *
 * Runtime choice mirrors console.papercompute.com#157: the native binding
 * loads at import time in milliseconds, while wasm-based renderers pay a
 * fetch + compile that dominates cold starts. Lambda has no system fonts,
 * so Inter is vendored (font-data.generated.ts) and materialized to /tmp —
 * sharp/librsvg would silently render tofu here.
 *
 * Fonts are passed as file paths, not `fontBuffers`: resvg-js JSON.stringifys
 * its options, so buffers balloon into ~1.5MB of JSON per render and proved
 * unreliable in the Lambda runtime (glyphs silently missing). `fontFiles` is
 * the documented, typed API and skips the serialization entirely.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { INTER_FONTS } from './font-data.generated.ts';

// Written once per container; reused across invocations.
let fontFiles: string[] | null = null;

function getFontFiles(): string[] {
  if (!fontFiles) {
    const dir = mkdtempSync(join(tmpdir(), 'social-card-fonts-'));
    fontFiles = INTER_FONTS.map((f) => {
      const path = join(dir, `inter-${f.weight}.ttf`);
      writeFileSync(path, Buffer.from(f.base64, 'base64'));
      return path;
    });
  }
  return fontFiles;
}

export interface RenderResult {
  png: Buffer;
  resvgMs: number;
}

export function renderSvgToPng(svg: string): RenderResult {
  const t0 = performance.now();
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      loadSystemFonts: false,
      fontFiles: getFontFiles(),
      defaultFontFamily: 'Inter',
    },
  });
  const png = resvg.render().asPng();
  return { png: Buffer.from(png), resvgMs: performance.now() - t0 };
}
