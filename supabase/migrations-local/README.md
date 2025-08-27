# Local-Safe Migrations

These migrations have been automatically modified to work in local development environments without auth, roles, or extension dependencies.

## Quick Start

```bash
# Option 1: Run the setup script (recommended)
bash supabase/migrations-local/setup-local.sh

# Option 2: Run consolidated migration manually
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/migrations-local/000_consolidated_local_safe.sql

# Option 3: Run migrations individually
for file in supabase/migrations-local/*.sql; do
  psql "postgresql://postgres:postgres@localhost:54322/postgres" -f "$file"
done
```

## Modifications Made

- **Auth Dependencies**: Wrapped in conditional checks
- **Roles**: Created if missing
- **Extensions**: Made optional with fallbacks
- **Idempotency**: Added IF EXISTS/IF NOT EXISTS
- **Error Handling**: Added transaction wrapping

## Files

- **Modified**: 62 migrations had environment-specific code removed
- **Skipped**: 0 migrations needed no changes

## Production vs Local

These migrations are for **local development only**. Production environments should use the original migrations in `supabase/migrations/`.

## Troubleshooting

If a migration fails:

1. Check if Supabase is running: `supabase status`
2. Check database logs: `supabase db logs`
3. Run migrations one by one to identify the problematic one
4. Check generation-report.json for details on modifications
