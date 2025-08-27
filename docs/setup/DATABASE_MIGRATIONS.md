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

## Best Practices

1. **Always test migrations locally first**
2. **Use conditional checks for environment-specific code**
3. **Make migrations idempotent (can run multiple times)**
4. **Document dependencies in migration comments**
5. **Group related changes in single migration**

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

## Summary

The migration system has been redesigned to handle environment differences:

- **Original migrations**: Production-ready but require full Supabase environment
- **Local-safe migrations**: Modified for local development without dependencies
- **Consolidated migrations**: Organized into logical groups
- **Migration tools**: Analyze, validate, and fix migration issues

For local development, always use the local-safe migrations to avoid environment-specific failures.