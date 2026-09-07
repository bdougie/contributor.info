# Changelog Feeds

`generate-rss.js` parses `CHANGELOG.md` at the repo root and writes `public/changelog-rss.xml` and `public/changelog-atom.xml`. The feeds give crawlers and LLMs a machine-readable freshness signal for releases.

## How it runs

- **On release**: `.github/workflows/release.yml` runs it after semantic-release updates `CHANGELOG.md`, then commits the feeds together with `mintlify-docs/changelog.mdx`.
- **Manually**: `node scripts/changelog/generate-rss.js` from the repo root. The script takes no arguments; paths are fixed.

## Related

- `src/scripts/changelog/generate-rss.test.ts` - unit tests for the parser
- [docs/features/](../../docs/features/) - changelog and release notes features
