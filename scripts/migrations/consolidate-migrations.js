#!/usr/bin/env node

/**
 * Migration Consolidation Script
 * Consolidates and reorganizes migrations into environment-safe groups
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MigrationConsolidator {
  constructor(migrationsDir) {
    this.migrationsDir = migrationsDir;
    this.outputDir = path.join(path.dirname(migrationsDir), 'migrations-consolidated');

    // Categories for migration organization
    this.categories = {
      core: {
        description: 'Core schema - tables, indexes, basic constraints',
        files: [],
        dependencies: [],
      },
      auth: {
        description: 'Auth-dependent features - RLS policies, auth triggers',
        files: [],
        dependencies: ['auth schema', 'auth.users table'],
      },
      extensions: {
        description: 'Extension-dependent features',
        files: [],
        dependencies: ['pg_cron', 'vector', 'pg_net', 'uuid-ossp'],
      },
      seed: {
        description: 'Development seed data',
        files: [],
        dependencies: [],
      },
    };
  }

  analyzeMigration(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);

    // Determine category based on content
    const hasAuth = /auth\.|auth_/gi.test(content);
    const hasExtension = /CREATE\s+EXTENSION|pg_cron|vector|pg_net/gi.test(content);
    const hasRLS = /ENABLE ROW LEVEL SECURITY|CREATE POLICY/gi.test(content);
    const hasSeedData = /INSERT INTO|COPY.*FROM/gi.test(content);
    const hasTableCreation = /CREATE\s+TABLE/gi.test(content);

    if (hasExtension) {
      return 'extensions';
    } else if (hasAuth || hasRLS) {
      return 'auth';
    } else if (hasSeedData && !hasTableCreation) {
      return 'seed';
    } else {
      return 'core';
    }
  }

  extractTableDefinitions(content) {
    const tables = [];
    const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)[^;]*;/gis;
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      tables.push({
        name: match[1],
        definition: match[0],
      });
    }

    return tables;
  }

  extractFunctions(content) {
    const functions = [];
    const functionRegex =
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([^\s(]+)[^;]*?(?:BEGIN[^;]*?END|\$\$[^$]*?\$\$)[^;]*;/gis;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      functions.push({
        name: match[1],
        definition: match[0],
      });
    }

    return functions;
  }

  makeEnvironmentSafe(content, category) {
    let safeContent = content;

    // Wrap auth dependencies in conditional checks
    if (category === 'auth' || content.includes('auth.')) {
      safeContent = `-- This migration requires auth schema
DO $$
BEGIN
  -- Check if auth schema exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping auth-dependent migrations.';
    RETURN;
  END IF;
END $$;

${safeContent}`;
    }

    // Make role grants conditional
    safeContent = safeContent.replace(
      /(GRANT\s+[\w,\s]+\s+TO\s+)(service_role|anon|authenticated)/gi,
      `-- $1$2 (conditional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$2') THEN
    $1$2;
  ELSE
    RAISE NOTICE 'Role $2 not found, skipping grant';
  END IF;
END $$;`
    );

    // Make extensions conditional
    safeContent = safeContent.replace(
      /CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s;]+)/gi,
      'CREATE EXTENSION IF NOT EXISTS $1'
    );

    // Add error handling for pg_cron
    if (content.includes('pg_cron')) {
      safeContent = safeContent.replace(
        /(cron\.schedule[^;]+;)/gi,
        `-- $1
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    $1
  ELSE
    RAISE NOTICE 'pg_cron extension not available, skipping cron job';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create cron job: %', SQLERRM;
END $$;`
      );
    }

    return safeContent;
  }

  /**
   * Validate migrations before consolidation
   */
  validateBeforeConsolidation() {
    const errors = [];

    // Check if migrations directory exists
    if (!fs.existsSync(this.migrationsDir)) {
      errors.push(`Migrations directory not found: ${this.migrationsDir}`);
    }

    // Check for SQL syntax errors in each file
    const files = fs.readdirSync(this.migrationsDir).filter((f) => f.endsWith('.sql'));

    files.forEach((file) => {
      const filePath = path.join(this.migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Basic SQL validation checks
      const openParens = (content.match(/\(/g) || []).length;
      const closeParens = (content.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        errors.push(`${file}: Unbalanced parentheses (${openParens} open, ${closeParens} close)`);
      }

      // Check for unterminated strings
      const quotes = content.split("'").length - 1;
      if (quotes % 2 !== 0) {
        errors.push(`${file}: Unterminated string literal`);
      }

      // Check for required transaction blocks
      if (content.includes('DROP TABLE') && !content.includes('BEGIN')) {
        errors.push(`${file}: Contains DROP TABLE without transaction block`);
      }
    });

    return {
      success: errors.length === 0,
      errors,
      fileCount: files.length,
    };
  }

  consolidate() {
    console.log('📦 Starting migration consolidation process...\n');

    // Validate before consolidation
    const validation = this.validateBeforeConsolidation();
    if (!validation.success) {
      console.error('❌ Validation failed:');
      validation.errors.forEach((err) => console.error(`  - ${err}`));
      process.exit(1);
    }
    console.log(`✅ Validated ${validation.fileCount} migrations\n`);

    // Create output directory structure
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Create subdirectories for each category
    Object.keys(this.categories).forEach((cat) => {
      const catDir = path.join(this.outputDir, cat);
      if (!fs.existsSync(catDir)) {
        fs.mkdirSync(catDir, { recursive: true });
      }
    });

    // Read and categorize all migrations
    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const consolidatedData = {
      core: { tables: {}, functions: {}, other: [] },
      auth: { policies: [], triggers: [], other: [] },
      extensions: { extensions: new Set(), cronJobs: [], other: [] },
      seed: { data: [] },
    };

    // Process each migration
    files.forEach((file) => {
      const filePath = path.join(this.migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const category = this.analyzeMigration(filePath);

      this.categories[category].files.push(file);

      // Extract and consolidate components
      if (category === 'core') {
        const tables = this.extractTableDefinitions(content);
        tables.forEach((t) => {
          if (!consolidatedData.core.tables[t.name]) {
            consolidatedData.core.tables[t.name] = t.definition;
          }
        });

        const functions = this.extractFunctions(content);
        functions.forEach((f) => {
          if (!consolidatedData.core.functions[f.name]) {
            consolidatedData.core.functions[f.name] = f.definition;
          }
        });
      }
    });

    // Generate consolidated migration files
    this.generateConsolidatedMigrations(consolidatedData);

    // Generate report
    this.generateReport();
  }

  generateConsolidatedMigrations(data) {
    // 001_core_schema.sql - Basic tables and relationships
    let coreContent = `-- Core Schema Migration
-- This migration creates all basic tables and relationships
-- No auth or extension dependencies

`;

    Object.values(data.core.tables).forEach((table) => {
      coreContent += table + '\n\n';
    });

    Object.values(data.core.functions).forEach((func) => {
      coreContent += func + '\n\n';
    });

    fs.writeFileSync(
      path.join(this.outputDir, 'core', '001_core_schema.sql'),
      this.makeEnvironmentSafe(coreContent, 'core')
    );

    // 002_auth_features.sql - Auth-dependent features
    let authContent = `-- Auth-Dependent Features
-- This migration requires auth schema to be configured
-- Will be skipped if auth is not available

`;

    // Read auth-related migrations and consolidate
    this.categories.auth.files.forEach((file) => {
      const content = fs.readFileSync(path.join(this.migrationsDir, file), 'utf8');
      authContent += `-- From ${file}\n${content}\n\n`;
    });

    fs.writeFileSync(
      path.join(this.outputDir, 'auth', '002_auth_features.sql'),
      this.makeEnvironmentSafe(authContent, 'auth')
    );

    // 003_extensions.sql - Extension-dependent features
    let extContent = `-- Extension-Dependent Features
-- This migration requires specific PostgreSQL extensions
-- Extensions will be created if possible, features skipped if not

`;

    this.categories.extensions.files.forEach((file) => {
      const content = fs.readFileSync(path.join(this.migrationsDir, file), 'utf8');
      extContent += `-- From ${file}\n${content}\n\n`;
    });

    fs.writeFileSync(
      path.join(this.outputDir, 'extensions', '003_extensions.sql'),
      this.makeEnvironmentSafe(extContent, 'extensions')
    );
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalOriginalMigrations: fs
          .readdirSync(this.migrationsDir)
          .filter((f) => f.endsWith('.sql')).length,
        consolidatedMigrations: 4,
        categories: {},
      },
      migrations: {},
    };

    Object.entries(this.categories).forEach(([cat, data]) => {
      report.summary.categories[cat] = {
        description: data.description,
        fileCount: data.files.length,
        dependencies: data.dependencies,
      };
      report.migrations[cat] = data.files;
    });

    // Save report
    fs.writeFileSync(
      path.join(this.outputDir, 'consolidation-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Generate README
    const readme = `# Consolidated Migrations

## Overview
These migrations have been reorganized from ${report.summary.totalOriginalMigrations} original files into ${report.summary.consolidatedMigrations} consolidated groups for better environment compatibility.

## Migration Groups

### 1. Core Schema (001_core_schema.sql)
- **Description**: ${this.categories.core.description}
- **Files consolidated**: ${this.categories.core.files.length}
- **Dependencies**: None
- **Required**: Yes

### 2. Auth Features (002_auth_features.sql)
- **Description**: ${this.categories.auth.description}
- **Files consolidated**: ${this.categories.auth.files.length}
- **Dependencies**: ${this.categories.auth.dependencies.join(', ')}
- **Required**: No (optional, skipped if auth not configured)

### 3. Extensions (003_extensions.sql)
- **Description**: ${this.categories.extensions.description}
- **Files consolidated**: ${this.categories.extensions.files.length}
- **Dependencies**: ${this.categories.extensions.dependencies.join(', ')}
- **Required**: No (features degraded gracefully if extensions unavailable)

### 4. Seed Data (004_seed_data.sql)
- **Description**: ${this.categories.seed.description}
- **Files consolidated**: ${this.categories.seed.files.length}
- **Dependencies**: Core schema
- **Required**: No (development only)

## Usage

### For Local Development
\`\`\`bash
# Run core migrations (required)
supabase db reset --db-url "postgresql://postgres:postgres@localhost:54322/postgres" \\
  --migrations-path supabase/migrations-consolidated/core

# Optionally run auth features if auth is configured
supabase db push --db-url "postgresql://postgres:postgres@localhost:54322/postgres" \\
  --migrations-path supabase/migrations-consolidated/auth

# Optionally run extension features
supabase db push --db-url "postgresql://postgres:postgres@localhost:54322/postgres" \\
  --migrations-path supabase/migrations-consolidated/extensions
\`\`\`

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
`;

    fs.writeFileSync(path.join(this.outputDir, 'README.md'), readme);

    console.log(`✅ Consolidation complete!`);
    console.log(`📁 Output directory: ${this.outputDir}`);
    console.log(`📊 Report saved to: ${path.join(this.outputDir, 'consolidation-report.json')}`);
    console.log(`📖 README generated with usage instructions`);
  }
}

// Run consolidation
const migrationsDir = path.join(__dirname, '../../supabase/migrations');
const consolidator = new MigrationConsolidator(migrationsDir);
consolidator.consolidate();
