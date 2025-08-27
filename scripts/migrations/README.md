# Migration Scripts

This directory contains tools for managing and fixing database migrations for local development compatibility.

## Scripts Overview

### 🔍 `analyze-migrations.js`
Analyzes all migrations for environment-specific dependencies.

```bash
node scripts/migrations/analyze-migrations.js
```

**Output:**
- Identifies auth dependencies (24 files affected)
- Finds role dependencies (38 files affected)
- Detects extension requirements (12 files affected)
- Reports migration order issues
- Generates `migration-analysis-report.json`

### ✅ `validate-migrations.js`
Validates migrations for local development compatibility.

```bash
# Check for issues
node scripts/migrations/validate-migrations.js

# Generate fixed versions
node scripts/migrations/validate-migrations.js --fix
```

**Features:**
- Checks for auth dependencies
- Validates role references
- Identifies extension requirements
- Tests idempotency
- Generates fixed versions with `--fix` flag
- Creates `migration-validation-report.json`

### 📦 `consolidate-migrations.js`
Groups migrations into logical categories for better organization.

```bash
node scripts/migrations/consolidate-migrations.js
```

**Output:**
- `migrations-consolidated/core/` - Core schema
- `migrations-consolidated/auth/` - Auth-dependent features
- `migrations-consolidated/extensions/` - Extension-dependent features
- `migrations-consolidated/seed/` - Development data
- Generates consolidation report and README

### 🛡️ `generate-local-safe.js`
Creates environment-safe versions of all migrations for local development.

```bash
node scripts/migrations/generate-local-safe.js
```

**Output:**
- `migrations-local/` - All migrations made safe for local development
- `000_consolidated_local_safe.sql` - Single file with all migrations
- `setup-local.sh` - Bash script for easy setup
- Generates README with usage instructions

## Quick Start for Local Development

After running the scripts, use the generated local-safe migrations:

```bash
# Option 1: Run the setup script
bash supabase/migrations-local/setup-local.sh

# Option 2: Run consolidated migration
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/migrations-local/000_consolidated_local_safe.sql

# Option 3: Run individual migrations
for file in supabase/migrations-local/*.sql; do
  psql "postgresql://postgres:postgres@localhost:54322/postgres" -f "$file"
done
```

## Problem Summary

The original migrations have several issues for local development:

| Issue | Count | Impact |
|-------|-------|---------|
| Auth dependencies | 24 files | Fails without auth schema |
| Role dependencies | 38 files | Fails without specific roles |
| Extension requirements | 12 files | Needs superuser privileges |
| Non-idempotent operations | 7 files | Can't run multiple times |
| Fix/patch migrations | 10+ files | Indicates underlying issues |

## How Scripts Fix Issues

### Auth Dependencies
- Wraps auth code in conditional checks
- Skips auth features if schema doesn't exist
- Provides fallback behavior

### Role Issues
- Creates missing roles automatically
- Makes GRANT statements conditional
- Handles missing roles gracefully

### Extension Problems
- Uses `CREATE EXTENSION IF NOT EXISTS`
- Wraps extension code in existence checks
- Degrades gracefully without extensions

### Idempotency
- Adds `IF EXISTS` / `IF NOT EXISTS` clauses
- Makes operations repeatable
- Prevents duplicate object errors

## Development Workflow

1. **Analyze current state**
   ```bash
   node scripts/migrations/analyze-migrations.js
   ```

2. **Validate for issues**
   ```bash
   node scripts/migrations/validate-migrations.js
   ```

3. **Generate local-safe versions**
   ```bash
   node scripts/migrations/generate-local-safe.js
   ```

4. **Run migrations locally**
   ```bash
   bash supabase/migrations-local/setup-local.sh
   ```

## Adding New Migrations

When creating new migrations:

1. **Use conditional checks for auth**:
   ```sql
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
       -- Auth-dependent code here
     END IF;
   END $$;
   ```

2. **Create roles if needed**:
   ```sql
   DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
       CREATE ROLE service_role;
     END IF;
   END $$;
   ```

3. **Make extensions optional**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```

4. **Ensure idempotency**:
   ```sql
   CREATE TABLE IF NOT EXISTS ...
   DROP TABLE IF EXISTS ...
   ```

## Files Generated

After running all scripts:

```
supabase/
├── migration-analysis-report.json      # Analysis results
├── migration-validation-report.json    # Validation results
├── migrations-local/                   # Local-safe versions
│   ├── 000_consolidated_local_safe.sql # All migrations in one file
│   ├── setup-local.sh                  # Setup script
│   ├── README.md                       # Usage instructions
│   └── *.sql                          # Individual safe migrations
├── migrations-consolidated/            # Organized by category
│   ├── core/                          # Core schema
│   ├── auth/                          # Auth features
│   ├── extensions/                    # Extension features
│   └── consolidation-report.json      # Organization report
└── migrations-fixed/                   # Fixed versions (if --fix used)
```

## Troubleshooting

If migrations fail:

1. Check Supabase is running: `supabase status`
2. Use local-safe versions: `bash supabase/migrations-local/setup-local.sh`
3. Check reports for specific issues
4. Skip optional features (auth, extensions) if not needed
5. See [Database Migrations Guide](../../docs/setup/DATABASE_MIGRATIONS.md)

## Contributing

When modifying these scripts:

1. Test on fresh Supabase instance
2. Verify all platforms (Windows, Mac, Linux)
3. Update this README with changes
4. Document any new patterns or fixes