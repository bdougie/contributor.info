# Database Migrations Guide

## Overview

This guide explains how to work with database migrations in the Contributor Info project, particularly for local development setup.

## Migration Organization

The project now has multiple migration directories for different purposes:

### Directory Structure

```
supabase/
├── migrations/              # Original production migrations
├── migrations-local/        # Auto-generated local-safe versions
├── migrations-consolidated/ # Reorganized into logical groups
└── migrations-fixed/        # Fixed versions with issues resolved
```

### Migration Categories

1. **Core Schema** - Basic tables, indexes, and relationships
2. **Auth Features** - RLS policies, auth triggers (requires Supabase Auth)
3. **Extensions** - pg_cron, vector search (requires extensions)
4. **Seed Data** - Development test data

## Known Issues

The original migrations contain several environment-specific dependencies that prevent them from running on fresh local Supabase instances:

### Critical Issues
- **24 migrations** depend on auth schema/functions
- **38 migrations** reference roles that may not exist
- **12 migrations** require extensions like pg_cron
- **52 migrations** will fail on fresh local setup

### Common Problems

#### 1. Auth Dependencies
```sql
-- Problem: References auth.uid() which doesn't exist locally
CREATE POLICY user_policy ON table_name
  USING (auth.uid() = user_id);

-- Solution: Wrapped in conditional check
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    -- Auth-dependent code here
  END IF;
END $$;
```

#### 2. Missing Roles
```sql
-- Problem: Role doesn't exist
GRANT SELECT ON table_name TO service_role;

-- Solution: Create role if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
END $$;
```

#### 3. Extension Requirements
```sql
-- Problem: Requires pg_cron (needs superuser)
SELECT cron.schedule('job', '0 * * * *', 'SELECT 1');

-- Solution: Make optional
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Extension-dependent code
  END IF;
END $$;
```

## Local Development Setup

### Quick Start (Recommended)

Use the auto-generated local-safe migrations:

```bash
# 1. Start Supabase
supabase start

# 2. Run the setup script
bash supabase/migrations-local/setup-local.sh

# Or run the consolidated migration directly
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/migrations-local/000_consolidated_local_safe.sql
```

### Alternative: Run Individual Migrations

```bash
# Run migrations one by one for debugging
for file in supabase/migrations-local/*.sql; do
  echo "Running: $file"
  psql "postgresql://postgres:postgres@localhost:54322/postgres" -f "$file"
done
```

### Using Consolidated Migrations

For better organization, use the consolidated migrations:

```bash
# 1. Core schema (required)
psql $DATABASE_URL -f supabase/migrations-consolidated/core/001_core_schema.sql

# 2. Auth features (optional, if auth configured)
psql $DATABASE_URL -f supabase/migrations-consolidated/auth/002_auth_features.sql

# 3. Extensions (optional, if available)
psql $DATABASE_URL -f supabase/migrations-consolidated/extensions/003_extensions.sql
```

## Migration Tools

### Analysis Tool
Identifies environment-specific dependencies:

```bash
node scripts/migrations/analyze-migrations.js
```

### Validation Tool
Checks migrations for local compatibility:

```bash
node scripts/migrations/validate-migrations.js

# Generate fixed versions
node scripts/migrations/validate-migrations.js --fix
```

### Consolidation Tool
Groups migrations into logical categories:

```bash
node scripts/migrations/consolidate-migrations.js
```

### Local-Safe Generator
Creates environment-safe versions:

```bash
node scripts/migrations/generate-local-safe.js
```

## Troubleshooting

### Migration Fails on Fresh Setup

1. **Check Supabase status**
   ```bash
   supabase status
   ```

2. **Use local-safe migrations**
   ```bash
   bash supabase/migrations-local/setup-local.sh
   ```

3. **Skip problematic migrations**
   - Auth features can be skipped if not using authentication
   - Extension features degrade gracefully

### Auth Schema Not Found

If you see errors about missing auth schema:

```bash
# Option 1: Skip auth-dependent migrations
# Use only core schema migrations

# Option 2: Enable auth in Supabase config
# Edit supabase/config.toml to enable auth
```

### Role Doesn't Exist

Create missing roles manually:

```sql
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
```

### Extension Not Available

Extensions like pg_cron require superuser privileges:

```sql
-- Check available extensions
SELECT * FROM pg_available_extensions;

-- Skip extension-dependent features or
-- Run Supabase with different permissions
```

## Production vs Local

### Production Environment
- Full auth support
- All extensions available
- All roles configured
- Use original migrations in `supabase/migrations/`

### Local Development
- Auth optional
- Limited extensions
- Basic roles only
- Use local-safe migrations in `supabase/migrations-local/`

## Testing Strategy

### Unit Testing Migrations

Test individual migrations in isolation:

```bash
# 1. Start fresh database
supabase db reset --db-url postgresql://postgres:postgres@localhost:54322/postgres

# 2. Test single migration
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/migrations/your_migration.sql

# 3. Verify expected schema
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "\dt"
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "\df"
```

### Integration Testing

Test complete migration sequence:

```bash
# 1. Run all migrations
bash supabase/migrations-local/setup-local.sh

# 2. Run test queries
node scripts/test-database-queries.js

# 3. Verify data integrity
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f scripts/test-data-integrity.sql
```

### Regression Testing

Before merging changes:

```bash
# 1. Backup current schema
pg_dump --schema-only postgresql://postgres:postgres@localhost:54322/postgres > before.sql

# 2. Apply new migrations
bash supabase/migrations-local/setup-local.sh

# 3. Compare schemas
pg_dump --schema-only postgresql://postgres:postgres@localhost:54322/postgres > after.sql
diff before.sql after.sql
```

### Performance Testing

Check migration performance:

```bash
# Time migration execution
time psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/migrations-local/000_consolidated_local_safe.sql

# Check index usage
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -c "SELECT schemaname, tablename, indexname FROM pg_indexes;"

# Analyze query plans
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -c "EXPLAIN ANALYZE SELECT * FROM contributors;"
```

### CI Testing

Automated testing in GitHub Actions:

1. **Validation on PR** - `.github/workflows/validate-migrations.yml`
2. **Fresh database test** - Runs on Postgres container
3. **Local-safe generation** - Ensures compatibility
4. **Analysis reports** - Uploaded as artifacts

### Test Coverage Checklist

- [ ] Migration runs on fresh database
- [ ] Migration is idempotent (can run twice)
- [ ] Auth dependencies are conditional
- [ ] Roles are created if missing
- [ ] Extensions are optional
- [ ] No data loss on rollback
- [ ] Performance acceptable (<5s per migration)
- [ ] Works on Windows/Mac/Linux
- [ ] CI validation passes

## Best Practices

1. **Always test migrations locally first**
2. **Use conditional checks for environment-specific code**
3. **Make migrations idempotent (can run multiple times)**
4. **Document dependencies in migration comments**
5. **Group related changes in single migration**
6. **Test on fresh database before merging**
7. **Verify rollback procedures work**
8. **Check cross-platform compatibility**

## Migration Development Workflow

### Creating New Migrations

1. **Create migration file**
   ```bash
   supabase migration new your_migration_name
   ```

2. **Write environment-safe SQL**
   ```sql
   -- Check dependencies exist
   DO $$
   BEGIN
     -- Your migration code
   END $$;
   ```

3. **Test locally**
   ```bash
   supabase db push
   ```

4. **Validate for issues**
   ```bash
   node scripts/migrations/validate-migrations.js
   ```

### Modifying Existing Migrations

1. **Never modify deployed migrations**
2. **Create fix migrations for production issues**
3. **For local dev, regenerate local-safe versions**

## CI/CD Considerations

### GitHub Actions

Migrations should run differently in CI:

```yaml
- name: Setup Supabase
  run: |
    # Use local-safe migrations for CI
    psql ${{ secrets.DATABASE_URL }} \
      -f supabase/migrations-local/000_consolidated_local_safe.sql
```

### Deployment

Production deployments should use original migrations:

```bash
# Production deployment
supabase db push --db-url $PRODUCTION_DATABASE_URL
```

## Rollback Strategy

### Migration Rollback Procedures

Each migration should have a corresponding rollback plan to safely revert changes if issues occur.

### Creating Rollback Scripts

For each migration, create a corresponding rollback:

```bash
# Migration file: 20240101_add_feature.sql
# Rollback file: rollback_20240101_add_feature.sql
```

Example rollback script structure:

```sql
-- Rollback for: 20240101_add_feature.sql
-- Description: Safely removes feature X additions

BEGIN;

-- 1. Save any data that needs preserving
CREATE TEMP TABLE backup_data AS 
SELECT * FROM table_to_modify 
WHERE created_at > '2024-01-01';

-- 2. Reverse schema changes (in reverse order)
DROP TRIGGER IF EXISTS new_trigger ON table_name;
DROP FUNCTION IF EXISTS new_function();
ALTER TABLE table_name DROP COLUMN IF EXISTS new_column;
DROP TABLE IF EXISTS new_table CASCADE;

-- 3. Restore previous state if needed
-- UPDATE table_name SET column = old_value WHERE condition;

-- 4. Verify rollback success
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'table_name' AND column_name = 'new_column') THEN
    RAISE EXCEPTION 'Rollback failed: new_column still exists';
  END IF;
END $$;

COMMIT;
```

### Rollback Procedures by Type

#### Table Changes
```sql
-- Rolling back new table
DROP TABLE IF EXISTS table_name CASCADE;

-- Rolling back new column
ALTER TABLE table_name DROP COLUMN IF EXISTS column_name;

-- Rolling back column type change (requires data backup)
ALTER TABLE table_name 
ALTER COLUMN column_name TYPE original_type 
USING column_name::original_type;
```

#### Index Changes
```sql
-- Rolling back new index
DROP INDEX IF EXISTS index_name;

-- Rolling back index changes
DROP INDEX IF EXISTS new_index_name;
CREATE INDEX old_index_name ON table_name(column);
```

#### Function/Trigger Changes
```sql
-- Rolling back function changes
DROP FUNCTION IF EXISTS function_name() CASCADE;
-- Recreate original function if needed
CREATE OR REPLACE FUNCTION function_name() ...

-- Rolling back triggers
DROP TRIGGER IF EXISTS trigger_name ON table_name;
```

#### RLS Policy Changes
```sql
-- Rolling back RLS policies
DROP POLICY IF EXISTS policy_name ON table_name;
-- Recreate original policy if needed
CREATE POLICY old_policy_name ON table_name ...
```

### Emergency Rollback Process

For production emergencies:

```bash
# 1. Stop application to prevent data corruption
kubectl scale deployment app --replicas=0

# 2. Create backup of current state
pg_dump $DATABASE_URL > emergency_backup_$(date +%s).sql

# 3. Run rollback scripts in reverse chronological order
psql $DATABASE_URL -f rollback_20240103.sql
psql $DATABASE_URL -f rollback_20240102.sql
psql $DATABASE_URL -f rollback_20240101.sql

# 4. Verify database state
psql $DATABASE_URL -f scripts/verify-schema.sql

# 5. Restart application
kubectl scale deployment app --replicas=3
```

### Rollback Testing

Always test rollbacks before production deployment:

```bash
# 1. Apply migration to test database
psql $TEST_DB -f migration.sql

# 2. Insert test data
psql $TEST_DB -f test_data.sql

# 3. Execute rollback
psql $TEST_DB -f rollback_migration.sql

# 4. Verify data integrity
psql $TEST_DB -c "SELECT COUNT(*) FROM critical_table;"

# 5. Verify schema restored
psql $TEST_DB -c "\d+ table_name"
```

### Rollback Best Practices

1. **Always use transactions** - Wrap rollbacks in BEGIN/COMMIT
2. **Backup before rollback** - Create point-in-time backup
3. **Test in staging first** - Never rollback production without testing
4. **Document data loss** - Clearly note what data will be lost
5. **Preserve critical data** - Use TEMP tables to save important data
6. **Verify success** - Include checks to confirm rollback worked
7. **Consider cascade effects** - Check foreign key dependencies
8. **Plan for downtime** - Some rollbacks require app shutdown

### Point-in-Time Recovery

For catastrophic failures, use Supabase's point-in-time recovery:

```bash
# Restore to specific timestamp
supabase db restore --timestamp "2024-01-01 10:00:00"

# Or restore to specific backup
supabase db restore --backup-id abc123
```

## Summary

The migration system has been redesigned to handle environment differences:

- **Original migrations**: Production-ready but require full Supabase environment
- **Local-safe migrations**: Modified for local development without dependencies
- **Consolidated migrations**: Organized into logical groups
- **Migration tools**: Analyze, validate, and fix migration issues

For local development, always use the local-safe migrations to avoid environment-specific failures.