# Consolidated Migrations

## Overview
These migrations have been reorganized from 62 original files into 4 consolidated groups for better environment compatibility.

## Migration Groups

### 1. Core Schema (001_core_schema.sql)
- **Description**: Core schema - tables, indexes, basic constraints
- **Files consolidated**: 14
- **Dependencies**: None
- **Required**: Yes

### 2. Auth Features (002_auth_features.sql)
- **Description**: Auth-dependent features - RLS policies, auth triggers
- **Files consolidated**: 34
- **Dependencies**: auth schema, auth.users table
- **Required**: No (optional, skipped if auth not configured)

### 3. Extensions (003_extensions.sql)
- **Description**: Extension-dependent features
- **Files consolidated**: 12
- **Dependencies**: pg_cron, vector, pg_net, uuid-ossp
- **Required**: No (features degraded gracefully if extensions unavailable)

### 4. Seed Data (004_seed_data.sql)
- **Description**: Development seed data
- **Files consolidated**: 2
- **Dependencies**: Core schema
- **Required**: No (development only)

## Usage

### For Local Development
```bash
# Run core migrations (required)
supabase db reset --db-url "postgresql://postgres:postgres@localhost:54322/postgres" \
  --migrations-path supabase/migrations-consolidated/core

# Optionally run auth features if auth is configured
supabase db push --db-url "postgresql://postgres:postgres@localhost:54322/postgres" \
  --migrations-path supabase/migrations-consolidated/auth

# Optionally run extension features
supabase db push --db-url "postgresql://postgres:postgres@localhost:54322/postgres" \
  --migrations-path supabase/migrations-consolidated/extensions
```

### For Production
All migrations should be run in order as production has full auth and extension support.

## Migration Safety Features

1. **Conditional Auth Checks**: Auth-dependent code wrapped in existence checks
2. **Role Fallbacks**: Missing roles are created or skipped
3. **Extension Guards**: Features check for extension availability
4. **Transaction Safety**: Each group runs in a transaction for rollback capability

## Troubleshooting

If a migration fails:
1. Check the specific error message
2. Verify dependencies are met (auth configured, extensions available)
3. Skip optional migrations if dependencies cannot be met
4. See consolidation-report.json for detailed migration mapping
