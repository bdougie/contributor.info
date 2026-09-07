# Utilities

General-purpose developer tools that do not belong to a single subsystem.

| Script | Entry point | Purpose |
|--------|-------------|---------|
| `verify-csp-hash.js` | `npm run verify:csp` | CI check that the CSP hash in `public/_headers` matches the inline theme script in `index.html` |
| `calculate-csp-hash.js` | `node scripts/utilities/calculate-csp-hash.js` | Print the SHA-256 hash to paste into `public/_headers` after changing the inline script |
| `validate-redirects.js` | `npm run validate:redirects` | Validate the redirect rules in `netlify.toml` |
| `lint-docs.sh` | `npm run lint:docs` | Doc quality linter for `mintlify-docs/` |
| `format-deno.sh` | lint-staged | Format Supabase edge function files with Deno (Docker or local) |
| `run-maintainer-eval.ts` | `npm run eval:maintainer`, `eval:benchmark`, `eval:conservative`, `eval:aggressive` | Run the maintainer classification evals with a chosen config |
| `optimize-icon-imports.js` | `node scripts/utilities/optimize-icon-imports.js` | Report lucide-react barrel imports that hurt bundle size |
| `replace-console-logs.sh` | `./scripts/utilities/replace-console-logs.sh` | Rewrite `console.log` calls to the project logger. See [docs/development/logging.md](../../docs/development/logging.md) |
| `tier.sh` | `./scripts/utilities/tier.sh --help` | Bulk-apply tier labels to closed PRs with the GitHub CLI; dry-run by default |

## Related

- [docs/security/csp-hash-implementation.md](../../docs/security/csp-hash-implementation.md)
- [docs/setup/maintainer-evals-dev-guide.md](../../docs/setup/maintainer-evals-dev-guide.md)
