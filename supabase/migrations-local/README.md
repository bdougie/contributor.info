# Local Migration Automation

This directory contains an automated solution for local Supabase development that resolves migration ordering issues by using a production-based consolidated migration.

## Quick Start

```bash
# Recommended: Use the automated consolidated migration
npm run supabase:migrate:consolidated

# Or run the automation script directly
node supabase/migrations-local/setup-local.mjs --consolidated
```

## How It Works

The automation provides a clean solution to GitHub issue #503 (migration ordering problems) by:

1. **Temporary File Management**: Moves all existing migrations to `.temp` directory
2. **Consolidated Migration**: Applies a single, production-based migration that creates the complete schema
3. **Automatic Restoration**: Restores all original migration files after completion
4. **Clean State**: No temporary files left behind

## Files

- **`setup-local.mjs`**: Cross-platform automation script with file management
- **`001_production_based_consolidated.sql`**: Production-based consolidated migration (700+ lines)
- **`archive/`**: Historical migration files recovered from commit `8b2b64681e554b392c21673cbf1bb928ec105c20`
  - Contains 62 migration files that were previously deleted
  - Includes `archive-info.json` with restoration metadata
  - Serves as historical reference for migration evolution
- **`README.md`**: This documentation

## Archive Directory

The `archive/` directory contains migration files that were deleted in commit `8b2b64681e554b392c21673cbf1bb928ec105c20` but have been restored for historical preservation. These files include:

- **Trending capture migrations** (20250824_enhance_trending_capture.sql)
- **Subscription system** (20250824_subscription_system.sql) 
- **PR corruption detection** (20250826_add_pr_corruption_detection_index.sql)
- **Workspace owner/member fixes** (20250826_fix_workspace_owner_member.sql)
- **And 58 other historical migrations** covering the full evolution of the schema

### Archive Metadata

The `archive-info.json` file contains:
- Original commit hash and restoration details
- Complete list of 62 restored files
- Timestamp and restoration reason
- Migration count and metadata

## Migration Flow

```
supabase/migrations/     →    supabase/migrations.temp/    (temporary move)
         ↓
supabase/migrations/     ←    001_production_based_consolidated.sql (copy)
         ↓
   supabase db reset     (apply consolidated migration)
         ↓
supabase/migrations/     ←    supabase/migrations.temp/    (restore all files)
```

## What Gets Created

The consolidated migration creates:
- **8 Core Tables**: repositories, contributors, pull_requests, issues, reviews, comments, commits, rate_limit_tracking
- **27 Indexes**: Optimized for performance
- **Vector Extensions**: Embeddings support (if available)
- **Auth Integration**: Compatible with Supabase auth
- **RLS Policies**: Row Level Security enabled

## Production vs Local

- **Local Development**: Uses this consolidated approach to avoid dependency issues
- **Production**: Uses the standard sequential migrations in `supabase/migrations/`
- **Source of Truth**: The consolidated migration is based on bdougie's production schema export

## Error Handling

The automation includes robust error handling:
- **Signal Interruption**: Proper cleanup on Ctrl+C
- **Process Termination**: Automatic restoration on errors  
- **File Lock Protection**: Prevents concurrent runs
- **Rollback Safety**: Original migrations always restored

## Troubleshooting

### Common Issues

**Seeding Errors**: Expected behavior - the consolidated schema doesn't include all tables that `seed.sql` references
```
failed to send batch: ERROR: relation "monthly_rankings" does not exist
```
*Solution*: This is normal - the core schema migration succeeded, only seeding failed

**Migration Count Changes**: The script adapts automatically to new migrations being added
```
📦 Temporarily moving 68 existing migrations...
```

**Docker/CLI Issues**: Ensure prerequisites are met
```bash
# Check Docker
docker info

# Check Supabase CLI
npx supabase --version

# Check Supabase status
npx supabase status
```

### Manual Recovery

If the automation is interrupted and files aren't restored:

```bash
# Check for temp directory
ls supabase/migrations.temp/

# Manual restore if needed
rm -rf supabase/migrations/
mv supabase/migrations.temp/ supabase/migrations/
```

## Development Notes

- **Cross-Platform**: Works on Windows (PowerShell), macOS, and Linux
- **CLI Detection**: Automatically detects Supabase CLI installation method
- **Process Tracking**: Uses PID-based ownership for safe concurrent operations
- **Exit Codes**: Proper exit codes for CI/CD integration
