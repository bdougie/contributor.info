# Social card scripts

## generate-font-data.mjs

Regenerates `netlify/functions/_shared/social-cards/font-data.generated.ts` — the
vendored Inter font subsets the social-card renderer passes to
`@resvg/resvg-js`. Lambda has no system fonts, so the card function ships its
own; the subsets cover printable ASCII + Latin-1, which is everything a card
renders (repo/user names and fixed labels).

Only needed when adding a font weight or expanding the glyph coverage.

```bash
# 1. Download Inter static TTFs (SIL OFL 1.1)
curl -sLO https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
unzip Inter-4.1.zip 'extras/ttf/Inter-Regular.ttf' 'extras/ttf/Inter-SemiBold.ttf' 'extras/ttf/Inter-Bold.ttf'

# 2. Install the subsetter (not a project dependency; used only by this script)
npm install --no-save subset-font

# 3. Regenerate
node scripts/social-cards/generate-font-data.mjs extras/ttf
```
