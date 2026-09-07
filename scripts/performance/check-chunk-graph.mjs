#!/usr/bin/env node
/**
 * Bundle gate that reads the built files instead of the build log.
 *
 * 1. Prints a size table for every JS chunk in dist/js (raw and gzip).
 * 2. Fails if any chunk exceeds MAX_CHUNK_KB.
 * 3. Fails if a route chunk statically imports a vendor chunk it must not
 *    (the "chunk graph" deny-list below). This catches the class of regression
 *    where a shared helper gets hoisted into a heavy vendor chunk and a page
 *    that never uses that vendor pays for it on the critical path.
 *
 * Usage:  node scripts/performance/check-chunk-graph.mjs [--summary <file>]
 *   MAX_CHUNK_KB   override the per-chunk cap (default 600)
 *   --summary      append the markdown table to a file (GITHUB_STEP_SUMMARY)
 */

import { readdirSync, readFileSync, statSync, appendFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, basename } from 'node:path';

const DIST_JS = join(process.cwd(), 'dist', 'js');
const MAX_CHUNK_KB = Number(process.env.MAX_CHUNK_KB || 600);

/**
 * Route chunk prefix -> vendor chunk prefixes it must not import statically.
 * Prefixes match the `[name]-[hash].js` output in vite.config.ts.
 */
const DENY_LIST = [
  // The entry chunk is preloaded on every route. Heavy optional vendors stay on demand.
  {
    chunk: 'index-',
    mustNotImport: [
      'vendor-ai-sdk',
      'vendor-recharts',
      'vendor-uplot',
      'vendor-analytics',
      'vendor-zod',
    ],
  },
  // Workspace pages have no charts on the overview, no AI features, and validate
  // forms only inside lazily-loaded modals.
  {
    chunk: 'workspace-page-',
    mustNotImport: ['vendor-ai-sdk', 'vendor-recharts', 'vendor-uplot', 'vendor-zod'],
  },
  {
    chunk: 'workspaces-page-',
    mustNotImport: ['vendor-ai-sdk', 'vendor-recharts', 'vendor-uplot', 'vendor-zod'],
  },
  {
    chunk: 'WorkspaceDashboard-',
    mustNotImport: ['vendor-ai-sdk', 'vendor-recharts', 'vendor-uplot', 'vendor-zod'],
  },
  // The repo page lazy-loads its chat panel and charts.
  { chunk: 'repo-view-', mustNotImport: ['vendor-ai-sdk', 'vendor-recharts', 'vendor-uplot'] },
];

const summaryFlag = process.argv.indexOf('--summary');
const summaryFile = summaryFlag !== -1 ? process.argv[summaryFlag + 1] : null;

if (!existsSync(DIST_JS)) {
  console.error(
    'dist/js not found. Run `npm run build` first. (Vite emits to dist/js, not dist/assets.)'
  );
  process.exit(2);
}

const files = readdirSync(DIST_JS).filter((f) => f.endsWith('.js'));
if (files.length === 0) {
  console.error('dist/js contains no JS chunks; the build output layout may have changed.');
  process.exit(2);
}

const IMPORT_RE = /import\s*(?:[^'"]*?from\s*)?["']\.\/([^"']+)["']/g;

const chunks = files
  .map((file) => {
    const path = join(DIST_JS, file);
    const source = readFileSync(path, 'utf8');
    const imports = new Set();
    for (const m of source.matchAll(IMPORT_RE)) imports.add(m[1]);
    return {
      file,
      bytes: statSync(path).size,
      gzip: gzipSync(source).length,
      imports: [...imports],
    };
  })
  .sort((a, b) => b.bytes - a.bytes);

const kb = (n) => (n / 1024).toFixed(1);
const lines = ['| Chunk | KB | gzip KB |', '|---|---:|---:|'];
for (const c of chunks.slice(0, 25)) lines.push(`| ${c.file} | ${kb(c.bytes)} | ${kb(c.gzip)} |`);
const table = lines.join('\n');
console.log(table);

const failures = [];

for (const c of chunks) {
  if (c.bytes / 1024 > MAX_CHUNK_KB) {
    failures.push(`${c.file} is ${kb(c.bytes)}KB (cap ${MAX_CHUNK_KB}KB)`);
  }
}

for (const rule of DENY_LIST) {
  const matching = chunks.filter((c) => c.file.startsWith(rule.chunk));
  for (const c of matching) {
    for (const vendor of rule.mustNotImport) {
      const hit = c.imports.find((i) => basename(i).startsWith(vendor));
      if (hit)
        failures.push(`${c.file} statically imports ${hit} (deny-listed for ${rule.chunk}*)`);
    }
  }
}

const total = chunks.reduce((s, c) => s + c.bytes, 0);
const totalGzip = chunks.reduce((s, c) => s + c.gzip, 0);
const footer = `\n**Total JS:** ${kb(total)} KB (${kb(totalGzip)} KB gzip) across ${chunks.length} chunks. Per-chunk cap ${MAX_CHUNK_KB}KB.`;
console.log(footer);

if (summaryFile) {
  appendFileSync(summaryFile, `### Bundle Size Report\n\n${table}\n${footer}\n`);
  if (failures.length)
    appendFileSync(summaryFile, `\n**Failures:**\n${failures.map((f) => `- ${f}`).join('\n')}\n`);
}

if (failures.length) {
  for (const f of failures) console.error(`::error::${f}`);
  process.exit(1);
}
console.log('\nChunk graph OK.');
