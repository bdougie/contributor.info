# Asset Scripts

Image and icon generation for `public/`. Social cards are rendered at request time by the Fly.io service in `fly-social-cards/` and are not generated here.

| Script | Entry point | Purpose |
|--------|-------------|---------|
| `convert-images.js` | `npm run optimize-images` | Convert `public/social.png` to WebP |
| `optimize-all-images.js` | `node scripts/assets/optimize-all-images.js` | Recompress every image under `public/` with sharp |
| `generate-pwa-icons.js` | `node scripts/assets/generate-pwa-icons.js` | Regenerate the PWA icon set referenced by `public/manifest.json` |
| `generate-pwa-screenshots.js` | `node scripts/assets/generate-pwa-screenshots.js` | Regenerate the PWA screenshots referenced by `public/manifest.json` |

`convert-images.js`, `generate-pwa-icons.js`, and `generate-pwa-screenshots.js` still resolve `public/` relative to the old `scripts/` root and need their paths fixed before they do anything. See `tasks/docs-audit-2026-09-06.md`.

## Related

- [docs/performance/image-optimization-guide.md](../../docs/performance/image-optimization-guide.md)
- [docs/social-cards.md](../../docs/social-cards.md)
