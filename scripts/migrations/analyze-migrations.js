#!/usr/bin/env node

/**
 * Migration Analysis Script
 * Analyzes Supabase migrations for environment-specific dependencies
 * and identifies potential issues for local development setup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MigrationAnalyzer {
  constructor(migrationsDir) {
    this.migrationsDir = migrationsDir;
    this.issues = [];
    this.dependencies = {
      auth: [],
      roles: [],
      extensions: [],
      triggers: [],
      functions: [],
    };
  }

  // Patterns that indicate environment-specific dependencies
  patterns = {
    auth: {
      patterns: [
        /auth\.uid\(\)/gi,
        /auth\.role\(\)/gi,
        /auth\.jwt\(\)/gi,
        /auth\.users/gi,
        /auth\.email\(\)/gi,
        /auth\./gi,
      ],
      description: 'Auth schema dependency',
    },
    roles: {
      patterns: [
        /service_role/gi,
        /supabase_auth_admin/gi,
        /anon\s/gi,
        /authenticated/gi,
        /GRANT\s+\w+\s+TO\s+/gi,
        /REVOKE\s+\w+\s+FROM\s+/gi,
      ],
      description: 'Role dependency',
    },
    extensions: {
      patterns: [
        /CREATE\s+EXTENSION/gi,
        /pg_cron/gi,
        /vector/gi,
        /pg_net/gi,
        /uuid-ossp/gi,
        /pgcrypto/gi,
      ],
      description: 'Extension dependency',
    },
    triggers: {
      patterns: [/CREATE\s+TRIGGER/gi, /CREATE\s+OR\s+REPLACE\s+TRIGGER/gi, /DROP\s+TRIGGER/gi],
      description: 'Trigger dependency',
    },
    functions: {
      patterns: [/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/gi, /DROP\s+FUNCTION/gi],
      description: 'Function dependency',
    },
  };

  analyzeMigration(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    const issues = [];

    // Check for each dependency type
    for (const [category, config] of Object.entries(this.patterns)) {
      for (const pattern of config.patterns) {
        const matches = content.match(pattern);
        if (matches) {
          const unique = [...new Set(matches)];
          issues.push({
            file: fileName,
            category,
            description: config.description,
            matches: unique,
            count: matches.length,
            canFail: this.checkIfCanFailLocally(category, content),
          });
        }
      }
    }

    // Check for specific problematic patterns
    this.checkProblematicPatterns(fileName, content, issues);

    return issues;
  }

  checkIfCanFailLocally(category, content) {
    // Check if the dependency is wrapped in conditional logic
    const hasConditional =
      content.includes('IF EXISTS') ||
      content.includes('IF NOT EXISTS') ||
      content.includes('DO $$') ||
      content.includes('EXCEPTION WHEN');

    // Auth and certain roles will definitely fail without proper setup
    if (category === 'auth' && !hasConditional) return true;
    if (category === 'roles' && content.includes('service_role') && !hasConditional) return true;
    if (category === 'extensions' && content.includes('pg_cron')) return true;

    return false;
  }

  checkProblematicPatterns(fileName, content, issues) {
    // Check for hardcoded IDs or environment-specific values
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const uuids = content.match(uuidPattern);
    if (uuids && uuids.length > 2) {
      // Allow some UUIDs for type casting
      issues.push({
        file: fileName,
        category: 'hardcoded',
        description: 'Hardcoded UUIDs detected',
        matches: uuids.slice(0, 3), // Show first 3
        count: uuids.length,
        canFail: false,
      });
    }

    // Check for production-specific configurations
    const prodPatterns = [/production/gi, /supabase\.co/gi, /supabase\.io/gi];

    for (const pattern of prodPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        issues.push({
          file: fileName,
          category: 'environment',
          description: 'Production-specific configuration',
          matches: [...new Set(matches)],
          count: matches.length,
          canFail: true,
        });
      }
    }
  }

  analyzeMigrationOrder() {
    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const orderIssues = [];

    // Check for "fix" migrations
    const fixMigrations = files.filter(
      (f) =>
        f.toLowerCase().includes('fix') ||
        f.toLowerCase().includes('patch') ||
        f.toLowerCase().includes('hotfix')
    );

    if (fixMigrations.length > 0) {
      orderIssues.push({
        type: 'fix_migrations',
        description: 'Multiple fix/patch migrations indicate underlying issues',
        files: fixMigrations,
        recommendation: 'Consolidate fixes into original migrations',
      });
    }

    // Check for duplicate table creations
    const tableCreations = {};
    files.forEach((file) => {
      const content = fs.readFileSync(path.join(this.migrationsDir, file), 'utf8');
      const createTableMatches = content.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi);
      if (createTableMatches) {
        createTableMatches.forEach((match) => {
          const tableName = match.replace(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi, '');
          if (!tableCreations[tableName]) {
            tableCreations[tableName] = [];
          }
          tableCreations[tableName].push(file);
        });
      }
    });

    for (const [table, migrations] of Object.entries(tableCreations)) {
      if (migrations.length > 1) {
        orderIssues.push({
          type: 'duplicate_table',
          description: `Table "${table}" created in multiple migrations`,
          files: migrations,
          recommendation: 'Consolidate table creation into single migration',
        });
      }
    }

    return orderIssues;
  }

  generateReport() {
    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log('🔍 Migration Analysis Report\n');
    console.log('='.repeat(80));
    console.log(`Total migrations: ${files.length}`);
    console.log('='.repeat(80) + '\n');

    // Analyze each migration
    const allIssues = [];
    const criticalFiles = [];

    for (const file of files) {
      const filePath = path.join(this.migrationsDir, file);
      const issues = this.analyzeMigration(filePath);

      if (issues.length > 0) {
        allIssues.push(...issues);

        const hasCritical = issues.some((i) => i.canFail);
        if (hasCritical) {
          criticalFiles.push(file);
        }
      }
    }

    // Group issues by category
    const issuesByCategory = {};
    allIssues.forEach((issue) => {
      if (!issuesByCategory[issue.category]) {
        issuesByCategory[issue.category] = [];
      }
      issuesByCategory[issue.category].push(issue);
    });

    // Report by category
    console.log('📊 Issues by Category:\n');
    for (const [category, issues] of Object.entries(issuesByCategory)) {
      const uniqueFiles = [...new Set(issues.map((i) => i.file))];
      const criticalCount = issues.filter((i) => i.canFail).length;

      console.log(`${category.toUpperCase()}: ${uniqueFiles.length} files affected`);
      if (criticalCount > 0) {
        console.log(`  ⚠️  ${criticalCount} critical issues that will fail locally`);
      }
      console.log(
        `  Files: ${uniqueFiles.slice(0, 5).join(', ')}${uniqueFiles.length > 5 ? '...' : ''}`
      );
      console.log();
    }

    // Report migration order issues
    const orderIssues = this.analyzeMigrationOrder();
    if (orderIssues.length > 0) {
      console.log('📁 Migration Order Issues:\n');
      orderIssues.forEach((issue) => {
        console.log(`❌ ${issue.description}`);
        console.log(
          `   Files: ${issue.files.slice(0, 3).join(', ')}${issue.files.length > 3 ? '...' : ''}`
        );
        console.log(`   💡 ${issue.recommendation}\n`);
      });
    }

    // Critical files that will fail
    if (criticalFiles.length > 0) {
      console.log('🚨 Critical Migrations (will fail on fresh local setup):\n');
      criticalFiles.forEach((file) => {
        const fileIssues = allIssues.filter((i) => i.file === file && i.canFail);
        console.log(`  ${file}`);
        fileIssues.forEach((issue) => {
          console.log(`    - ${issue.description}: ${issue.matches[0]}`);
        });
      });
      console.log();
    }

    // Generate recommendations
    console.log('💡 Recommendations:\n');
    const recommendations = this.generateRecommendations(issuesByCategory, orderIssues);
    recommendations.forEach((rec, idx) => {
      console.log(`${idx + 1}. ${rec}`);
    });

    // Save detailed report
    const reportPath = path.join(
      path.dirname(this.migrationsDir),
      'migration-analysis-report.json'
    );
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          summary: {
            totalMigrations: files.length,
            criticalMigrations: criticalFiles.length,
            categorizedIssues: Object.keys(issuesByCategory).map((cat) => ({
              category: cat,
              fileCount: [...new Set(issuesByCategory[cat].map((i) => i.file))].length,
              issueCount: issuesByCategory[cat].length,
            })),
          },
          issues: allIssues,
          orderIssues,
          criticalFiles,
        },
        null,
        2
      )
    );

    console.log(`\n✅ Detailed report saved to: ${reportPath}`);
  }

  generateRecommendations(issuesByCategory, orderIssues) {
    const recommendations = [];

    if (issuesByCategory.auth) {
      recommendations.push(
        'Create conditional auth checks: Wrap auth dependencies in DO blocks with EXISTS checks'
      );
    }

    if (issuesByCategory.roles) {
      recommendations.push("Add role creation fallbacks: Create missing roles if they don't exist");
    }

    if (issuesByCategory.extensions) {
      recommendations.push(
        'Make extensions optional: Use CREATE EXTENSION IF NOT EXISTS and check before use'
      );
    }

    if (orderIssues.some((i) => i.type === 'fix_migrations')) {
      recommendations.push(
        'Consolidate migrations: Merge fix migrations with their parent migrations'
      );
    }

    if (orderIssues.some((i) => i.type === 'duplicate_table')) {
      recommendations.push(
        'Remove duplicate table creations: Ensure each table is created only once'
      );
    }

    recommendations.push(
      'Split into environment-specific groups: Separate core schema from auth/extension dependencies'
    );
    recommendations.push(
      'Add migration validation: Create pre-flight checks for required dependencies'
    );
    recommendations.push(
      'Document dependencies: Add clear comments about what each migration requires'
    );

    return recommendations;
  }
}

// Run the analyzer
const migrationsDir = path.join(__dirname, '../../supabase/migrations');
const analyzer = new MigrationAnalyzer(migrationsDir);
analyzer.generateReport();
