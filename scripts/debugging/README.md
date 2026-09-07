# Debugging Scripts

Diagnostics for the build, commits, Inngest, and Supabase secrets. None of these change production data except `fix-stuck-jobs.js`, which asks before it writes.

| Script | Entry point | Purpose |
|--------|-------------|---------|
| `check-build-clean.js` | `npm run build:lighthouse` | Fail if the production build contains test-only dependencies |
| `check-commits.cjs` | `npm run check-commits` | Validate conventional-commit format for local commits |
| `validate-inngest.mjs` | `node scripts/debugging/validate-inngest.mjs` | End-to-end check of the Inngest pipeline: env vars, endpoint, function registration |
| `check-supabase-secrets.sh` | `./scripts/debugging/check-supabase-secrets.sh` | Verify the Inngest secrets exist on the Supabase edge functions without printing them |
| `verify-inngest-keys.sh` | `./scripts/debugging/verify-inngest-keys.sh` | Check that local Inngest keys match the expected patterns |
| `test-inngest-auth.sh` | `./scripts/debugging/test-inngest-auth.sh` | Trigger an Inngest function and capture the raw error body for auth failures |
| `fix-stuck-jobs.js` | `node scripts/debugging/fix-stuck-jobs.js` | List `progressive_capture_jobs` stuck in `processing` and optionally mark them failed |

## Related

- [docs/data-fetching/inngest-troubleshooting.md](../../docs/data-fetching/inngest-troubleshooting.md)
- [docs/troubleshooting/inngest-auth-errors.md](../../docs/troubleshooting/inngest-auth-errors.md)
- [docs/data-fetching/monitoring-capture-health.md](../../docs/data-fetching/monitoring-capture-health.md)
