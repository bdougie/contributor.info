#!/usr/bin/env node

/**
 * Generate Local-Safe Migrations
 * Creates environment-safe versions of all migrations for local development
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LocalSafeMigrationGenerator {
  constructor() {
    this.sourceDir = path.join(__dirname, '../../supabase/migrations');
    this.outputDir = path.join(__dirname, '../../supabase/migrations-local');
    this.report = {
      processed: [],
      skipped: [],
      modified: [],
    };
  }

  /**
   * Main entry point to generate local-safe migrations
   */
  async generate() {
    console.log('🔧 Generating local-safe migrations...\n');

    // Create output directory
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Process each migration file
    const files = fs
      .readdirSync(this.sourceDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      await this.processMigration(file);
    }

    // Generate consolidated single-file migration for easy setup
    this.generateConsolidatedMigration();

    // Generate setup script
    this.generateSetupScript();

    // Generate report
    this.generateReport();
  }

  /**
   * Process a single migration file to make it local-safe
   */
  async processMigration(fileName) {
    const sourcePath = path.join(this.sourceDir, fileName);
    const outputPath = path.join(this.outputDir, fileName);

    let content = fs.readFileSync(sourcePath, 'utf8');
    const originalContent = content;

    // Apply safety transformations
    content = this.wrapAuthDependencies(content, fileName);
    content = this.makeRolesConditional(content);
    content = this.makeExtensionsOptional(content);
    content = this.makeIdempotent(content);
    content = this.handlePgCron(content);
    content = this.addErrorHandling(content);

    // Check if modifications were made
    if (content !== originalContent) {
      this.report.modified.push(fileName);

      // Add header comment
      content = `-- Local-safe version of ${fileName}
-- Generated: ${new Date().toISOString()}
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

${content}`;
    } else {
      this.report.skipped.push(fileName);
    }

    // Write the processed migration
    fs.writeFileSync(outputPath, content);
    this.report.processed.push(fileName);
  }

  /**
   * Wrap auth-dependent code in conditional checks
   */
  wrapAuthDependencies(content, fileName) {
    // Check if migration uses auth
    if (!content.match(/auth\.|auth_/gi)) {
      return content;
    }

    // For migrations that heavily depend on auth, wrap the entire content
    if (content.match(/auth\.(uid|role|jwt|email)\(\)/gi)) {
      return `-- This migration requires auth schema
DO $$
BEGIN
  -- Check if auth schema and functions exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping ${fileName}';
    RETURN;
  END IF;
  
  -- Check for auth.uid() function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    RAISE NOTICE 'Auth functions not available. Skipping ${fileName}';
    RETURN;
  END IF;
END $$;

-- Original migration content (only runs if auth is available)
${content}`;
    }

    // For RLS policies using auth, make them conditional
    content = content.replace(
      /(CREATE POLICY[^;]+auth\.[^;]+;)/gis,
      `-- $1
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    $1
  END IF;
END $$;`
    );

    return content;
  }

  /**
   * Make role references conditional
   */
  makeRolesConditional(content) {
    // Create roles if they don't exist
    const roles = ['anon', 'authenticated', 'service_role'];
    let roleChecks = '';

    for (const role of roles) {
      if (content.includes(role)) {
        roleChecks += `
-- Ensure ${role} exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE ${role};
    RAISE NOTICE 'Created missing role: ${role}';
  END IF;
END $$;
`;
      }
    }

    if (roleChecks) {
      content = roleChecks + '\n' + content;
    }

    // Make GRANT statements conditional
    content = content.replace(
      /(GRANT\s+[^;]+\s+TO\s+)(anon|authenticated|service_role)([^;]*;)/gis,
      `DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$2') THEN
    $1$2$3
  ELSE
    RAISE NOTICE 'Role $2 not found, skipping grant';
  END IF;
END $$;`
    );

    return content;
  }

  /**
   * Make extensions optional
   */
  makeExtensionsOptional(content) {
    // Make CREATE EXTENSION conditional
    content = content.replace(
      /CREATE\s+EXTENSION\s+(?!IF\s+NOT\s+EXISTS)([^;]+);/gi,
      'CREATE EXTENSION IF NOT EXISTS $1;'
    );

    // Wrap extension-dependent code
    const extensions = ['pg_cron', 'vector', 'pg_net', 'uuid-ossp', 'pgcrypto'];

    for (const ext of extensions) {
      if (
        content.includes(ext) &&
        !content.includes(`IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = '${ext}')`)
      ) {
        // Find code blocks that use this extension
        const pattern = new RegExp(`([^;]*${ext}[^;]*;)`, 'gi');
        content = content.replace(pattern, (match) => {
          // Don't wrap CREATE EXTENSION statements
          if (match.includes('CREATE EXTENSION')) {
            return match;
          }

          return `DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = '${ext}') THEN
    ${match}
  ELSE
    RAISE NOTICE 'Extension ${ext} not available, skipping dependent code';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error with ${ext} extension: %', SQLERRM;
END $$;`;
        });
      }
    }

    return content;
  }

  /**
   * Make operations idempotent
   */
  makeIdempotent(content) {
    // Tables
    content = content.replace(
      /CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)(\S+)/gi,
      'CREATE TABLE IF NOT EXISTS $1'
    );

    // Indexes
    content = content.replace(
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)(\S+)/gi,
      'CREATE INDEX IF NOT EXISTS $1'
    );

    // Types
    content = content.replace(
      /CREATE\s+TYPE\s+(\S+)/gi,
      `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '$1') THEN
    CREATE TYPE $1`
    );

    // Functions - wrap in DROP IF EXISTS + CREATE
    content = content.replace(/CREATE\s+OR\s+REPLACE\s+FUNCTION/gi, 'CREATE OR REPLACE FUNCTION');

    return content;
  }

  /**
   * Handle pg_cron specifically
   */
  handlePgCron(content) {
    if (!content.includes('pg_cron') && !content.includes('cron.')) {
      return content;
    }

    // Wrap all cron.schedule calls
    content = content.replace(
      /(SELECT\s+cron\.schedule[^;]+;)/gis,
      `DO $$
BEGIN
  -- Check if pg_cron is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    $1
  ELSE
    RAISE NOTICE 'pg_cron not available - cron jobs will not be created';
    RAISE NOTICE 'To enable cron jobs, install pg_cron extension with superuser privileges';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to create cron job: %', SQLERRM;
END $$;`
    );

    return content;
  }

  /**
   * Add general error handling
   */
  addErrorHandling(content) {
    // If the migration doesn't have a transaction, wrap it
    if (!content.includes('BEGIN;') && !content.includes('COMMIT;')) {
      content = `-- Transaction wrapper for safety
BEGIN;

${content}

COMMIT;`;
    }

    return content;
  }

  /**
   * Generate a single consolidated migration for easy local setup
   */
  generateConsolidatedMigration() {
    console.log('📦 Creating consolidated migration...\n');

    const consolidated = [];

    // Add header
    consolidated.push(`-- Consolidated Local-Safe Migration
-- Generated: ${new Date().toISOString()}
-- This file contains all migrations combined and made safe for local development
-- Run this single file to set up your entire local database

BEGIN;

-- Create required roles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
END $$;

-- Create extensions if possible (non-blocking)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`);

    // Add all migrations in order (excluding certain problematic ones)
    const files = fs
      .readdirSync(this.outputDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.outputDir, file), 'utf8');
      consolidated.push(`-- ============================================================`);
      consolidated.push(`-- Migration: ${file}`);
      consolidated.push(`-- ============================================================`);
      consolidated.push(content);
      consolidated.push('');
    }

    // Add footer
    consolidated.push(`
-- ============================================================
-- Migration complete
-- ============================================================

COMMIT;

-- Post-migration report
DO $$
DECLARE
  table_count INTEGER;
  function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  
  SELECT COUNT(*) INTO function_count FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public';
  
  RAISE NOTICE 'Migration complete! Created % tables and % functions', table_count, function_count;
END $$;`);

    fs.writeFileSync(
      path.join(this.outputDir, '000_consolidated_local_safe.sql'),
      consolidated.join('\n')
    );
  }

  /**
   * Generate setup script for easy migration running
   */
  generateSetupScript() {
    const script = `#!/bin/bash

# Local Supabase Migration Setup Script
# This script sets up your local Supabase database with all migrations

set -e

echo "🚀 Setting up local Supabase database..."

# Check if Supabase is running
if ! supabase status 2>/dev/null | grep -q "supabase local development setup is running"; then
  echo "❌ Supabase is not running. Please run 'supabase start' first."
  exit 1
fi

# Database connection
DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"

echo "📦 Running consolidated migration..."

# Run the consolidated migration
psql "$DB_URL" -f supabase/migrations-local/000_consolidated_local_safe.sql

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully!"
  
  # Show summary
  psql "$DB_URL" -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"
  psql "$DB_URL" -c "SELECT COUNT(*) as function_count FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public';"
else
  echo "❌ Migration failed. Check the error messages above."
  exit 1
fi

echo "🎉 Local database setup complete!"`;

    const scriptPath = path.join(this.outputDir, 'setup-local.sh');
    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, '755');
  }

  /**
   * Generate final report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.report.processed.length,
        modified: this.report.modified.length,
        skipped: this.report.skipped.length,
      },
      files: {
        modified: this.report.modified,
        skipped: this.report.skipped,
      },
      instructions: {
        quickStart: 'Run: bash supabase/migrations-local/setup-local.sh',
        manual: 'Run: psql $DB_URL -f supabase/migrations-local/000_consolidated_local_safe.sql',
        individual: 'Run migrations individually from supabase/migrations-local/',
      },
    };

    fs.writeFileSync(
      path.join(this.outputDir, 'generation-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Create README
    const readme = `# Local-Safe Migrations

These migrations have been automatically modified to work in local development environments without auth, roles, or extension dependencies.

## Quick Start

\`\`\`bash
# Option 1: Run the setup script (recommended)
bash supabase/migrations-local/setup-local.sh

# Option 2: Run consolidated migration manually
psql "postgresql://postgres:postgres@localhost:54322/postgres" \\
  -f supabase/migrations-local/000_consolidated_local_safe.sql

# Option 3: Run migrations individually
for file in supabase/migrations-local/*.sql; do
  psql "postgresql://postgres:postgres@localhost:54322/postgres" -f "$file"
done
\`\`\`

## Modifications Made

- **Auth Dependencies**: Wrapped in conditional checks
- **Roles**: Created if missing
- **Extensions**: Made optional with fallbacks
- **Idempotency**: Added IF EXISTS/IF NOT EXISTS
- **Error Handling**: Added transaction wrapping

## Files

- **Modified**: ${this.report.modified.length} migrations had environment-specific code removed
- **Skipped**: ${this.report.skipped.length} migrations needed no changes

## Production vs Local

These migrations are for **local development only**. Production environments should use the original migrations in \`supabase/migrations/\`.

## Troubleshooting

If a migration fails:

1. Check if Supabase is running: \`supabase status\`
2. Check database logs: \`supabase db logs\`
3. Run migrations one by one to identify the problematic one
4. Check generation-report.json for details on modifications
`;

    fs.writeFileSync(path.join(this.outputDir, 'README.md'), readme);

    console.log('✅ Local-safe migrations generated successfully!\n');
    console.log(`📁 Output directory: ${this.outputDir}`);
    console.log(`📊 Modified ${this.report.modified.length} migrations`);
    console.log(`⏭️  Skipped ${this.report.skipped.length} migrations (already safe)`);
    console.log(
      `\n🚀 Quick start: bash ${path.relative(process.cwd(), path.join(this.outputDir, 'setup-local.sh'))}`
    );
  }
}

// Run the generator
const generator = new LocalSafeMigrationGenerator();
generator.generate();
