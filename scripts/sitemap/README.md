# Sitemap

`generate-sitemap.js` builds `public/sitemap.xml` and `public/sitemap-news.xml` from the tracked repositories in Supabase plus the static routes.

## How it runs

- **Daily**: `.github/workflows/daily-sitemap-generation.yml` runs the script and commits the result when the files change.
- **Manually**: `npm run generate-sitemap`.

The sitemap is not generated during `npm run build`; the committed files in `public/` are what ships.

## Priorities

| Page type | Priority |
|-----------|----------|
| Homepage | 1.0 |
| Well-known repositories | 0.9 |
| Repositories with more than 10k stars | 0.85 |
| Docs, changelog | 0.8 |
| Repositories with more than 1k stars | 0.8 |
| Repositories with more than 100 stars | 0.75 |
| Other repositories, individual doc pages | 0.7 |
| Privacy, terms | 0.5 |

The news sitemap includes repositories updated in the last two days.

## Environment

The script reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The daily workflow supplies them from repository secrets. It currently carries hardcoded fallbacks for both, which CLAUDE.md forbids; removing them is tracked in `tasks/docs-audit-2026-09-06.md`.
