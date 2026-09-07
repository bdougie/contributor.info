# Setup Scripts

Local development setup, seed data, and environment switching.

## Quick Start

```bash
npm run setup          # Prerequisites, env files, Supabase, migrations in one step
npm run setup:verify   # Check that the local environment is healthy
npm run setup:reset    # Tear down and start fresh
```

Step by step, the same flow is:

```bash
npm run env:local                       # Write .env.local for local development
npm run supabase:start                  # Start the Supabase containers
npm run supabase:migrate:consolidated   # Apply database migrations
npm run db:seed                         # Seed data (requires a GitHub token)
```

## Scripts

| Script | Entry point | Purpose |
|--------|-------------|---------|
| `first-time-setup.mjs` | `npm run setup` | Universal first-time setup; calls the other scripts in this folder |
| `verify-setup.mjs` | `npm run setup:verify` | Validate the local environment |
| `reset-setup.mjs` | `npm run setup:reset` | Stop Supabase, clean backups, reset the database |
| `start-local-supabase.js` | `npm run supabase:start` | Start Supabase without auto-migrations |
| `switch-environment.js` | `npm run env:local`, `npm run env:production` | Swap `.env.local` between local and production targets |
| `generate-seed-data.mjs` | `npm run db:seed`, `db:seed:quick`, `db:seed:dry` | Queue seed-data capture for example repositories |
| `check-seed-status.mjs` | `npm run seed:status` | Show progress of seed-data jobs |
| `clean-seed-data.mjs` | `npm run db:seed:clean` | Remove seeded rows from the local database |
| `install-husky.js` | `npm run postinstall` | Install git hooks locally; skipped in CI |
| `set-edge-function-secrets.sh` | manual | Set the Inngest secrets on the Supabase `queue-event` edge function. See [docs/edge-functions/setting-secrets.md](../../docs/edge-functions/setting-secrets.md) |

## GitHub App private key

The app reads the key from `GITHUB_APP_PRIVATE_KEY_ENCODED` (full PEM, base64). Generate the value with:

```bash
base64 -i path/to/private-key.pem | tr -d '\n'
```

See [docs/github-app/setup.md](../../docs/github-app/setup.md) for the other accepted formats.

## Related

- [docs/setup/local-development.md](../../docs/setup/local-development.md)
- [docs/setup/database-migrations.md](../../docs/setup/database-migrations.md)
- [scripts/migrations/](../migrations/) for the migration tooling used in CI
