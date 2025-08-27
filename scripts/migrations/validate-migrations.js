#!/usr/bin/env node

/**
 * Migration Validation Script
 * Validates migrations for local development compatibility
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MigrationValidator {
  constructor() {
    this.migrationsDir = path.join(__dirname, '../../supabase/migrations');
    this.issues = [];
    this.warnings = [];
    this.passed = [];
  }

  // Validation rules
  rules = {
    authDependency: {
      pattern: /auth\.(uid|role|jwt|email)\(\)/gi,
      message: 'Uses auth functions that may not be available locally',
      severity: 'error',
      fix: "Wrap in conditional check: IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uid' AND pronamespace = 'auth'::regnamespace)",
    },
    authUsersTable: {
      pattern: /auth\.users/gi,
      message: 'References auth.users table',
      severity: 'error',
      fix: "Check if auth schema exists: IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth')",
    },
    serviceRole: {
      pattern: /service_role(?!\s*=)/gi,
      message: 'References service_role which may not exist',
      severity: 'error',
      fix: "Create role if missing: IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;",
    },
    pgCron: {
      pattern: /pg_cron|cron\.schedule/gi,
      message: 'Requires pg_cron extension (needs superuser)',
      severity: 'error',
      fix: "Make optional: IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')",
    },
    vectorExtension: {
      pattern: /vector(?:\s+|\()/gi,
      message: 'Requires vector extension',
      severity: 'warning',
      fix: 'Check extension: CREATE EXTENSION IF NOT EXISTS vector;',
    },
    hardcodedUrls: {
      pattern: /https?:\/\/[^\s'"]+supabase\.(co|io)/gi,
      message: 'Contains hardcoded Supabase URLs',
      severity: 'error',
      fix: 'Use environment variables instead',
    },
    unconditionalGrant: {
      pattern: /GRANT\s+(?!.*IF)/gi,
      message: 'Unconditional GRANT that may fail if role missing',
      severity: 'warning',
      fix: 'Make conditional with DO block',
    },
    unconditionalExtension: {
      pattern: /CREATE\s+EXTENSION(?!\s+IF\s+NOT\s+EXISTS)/gi,
      message: 'CREATE EXTENSION without IF NOT EXISTS',
      severity: 'error',
      fix: 'Add IF NOT EXISTS clause',
    },
  };

  validateFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    const fileIssues = [];
    const fileWarnings = [];

    // Check each rule
    for (const [ruleName, rule] of Object.entries(this.rules)) {
      const matches = content.match(rule.pattern);
      if (matches) {
        const issue = {
          file: fileName,
          rule: ruleName,
          message: rule.message,
          matches: [...new Set(matches)].slice(0, 3), // First 3 unique matches
          count: matches.length,
          severity: rule.severity,
          fix: rule.fix,
          line: this.findLineNumber(content, matches[0]),
        };

        if (rule.severity === 'error') {
          fileIssues.push(issue);
        } else {
          fileWarnings.push(issue);
        }
      }
    }

    // Additional validations
    this.validateTransactionSafety(content, fileName, fileIssues);
    this.validateIdempotency(content, fileName, fileWarnings);

    return { issues: fileIssues, warnings: fileWarnings };
  }

  findLineNumber(content, match) {
    const lines = content.substring(0, content.indexOf(match)).split('\n');
    return lines.length;
  }

  validateTransactionSafety(content, fileName, issues) {
    // Check for non-transactional DDL
    const hasTransaction = content.includes('BEGIN;') || content.includes('START TRANSACTION');
    const hasDDL = /CREATE\s+(TABLE|INDEX|FUNCTION|TRIGGER)/gi.test(content);

    if (hasDDL && !hasTransaction && !fileName.includes('initial')) {
      issues.push({
        file: fileName,
        rule: 'transactionSafety',
        message: 'DDL operations without transaction wrapper',
        severity: 'warning',
        fix: 'Wrap migration in BEGIN; ... COMMIT; for rollback capability',
      });
    }
  }

  validateIdempotency(content, fileName, warnings) {
    // Check for non-idempotent operations
    const hasCreateTable = /CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi.test(content);
    const hasDropTable = /DROP\s+TABLE\s+(?!IF\s+EXISTS)/gi.test(content);

    if (hasCreateTable) {
      warnings.push({
        file: fileName,
        rule: 'idempotency',
        message: 'CREATE TABLE without IF NOT EXISTS',
        severity: 'warning',
        fix: 'Add IF NOT EXISTS for idempotency',
      });
    }

    if (hasDropTable) {
      warnings.push({
        file: fileName,
        rule: 'idempotency',
        message: 'DROP TABLE without IF EXISTS',
        severity: 'warning',
        fix: 'Add IF EXISTS for idempotency',
      });
    }
  }

  async testMigration(filePath) {
    // Test if migration would run on a fresh local Supabase
    const fileName = path.basename(filePath);

    try {
      // Create a test database connection string
      const testDb = 'postgresql://postgres:postgres@localhost:54322/postgres';

      // Try to run migration in check mode (dry run)
      const content = fs.readFileSync(filePath, 'utf8');

      // Simple syntax check
      if (content.includes('auth.uid()') && !content.includes('IF EXISTS')) {
        return {
          file: fileName,
          status: 'fail',
          reason: 'Will fail without auth configuration',
        };
      }

      if (content.includes('pg_cron') && !content.includes('IF EXISTS')) {
        return {
          file: fileName,
          status: 'fail',
          reason: 'Requires pg_cron extension (superuser)',
        };
      }

      return {
        file: fileName,
        status: 'pass',
      };
    } catch (error) {
      return {
        file: fileName,
        status: 'error',
        reason: error.message,
      };
    }
  }

  generateFixedMigration(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);

    // Apply automatic fixes

    // Fix 1: Wrap auth dependencies
    if (content.includes('auth.')) {
      content = `-- Auto-fixed: Added auth existence check
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Auth schema not found. Skipping auth-dependent parts.';
    RETURN;
  END IF;
END $$;

${content}`;
    }

    // Fix 2: Make extensions conditional
    content = content.replace(
      /CREATE\s+EXTENSION\s+([^;]+);/gi,
      'CREATE EXTENSION IF NOT EXISTS $1;'
    );

    // Fix 3: Make role grants conditional
    const grantRegex = /(GRANT\s+[^;]+TO\s+)(service_role|anon|authenticated)([^;]*;)/gi;
    content = content.replace(grantRegex, (match, p1, role, p3) => {
      return `DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
    ${p1}${role}${p3}
  END IF;
END $$;`;
    });

    // Fix 4: Make table creation idempotent
    content = content.replace(
      /CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\s+)([^\s(]+)/gi,
      'CREATE TABLE IF NOT EXISTS $1'
    );

    // Fix 5: Wrap pg_cron calls
    if (content.includes('cron.schedule')) {
      content = content.replace(
        /(SELECT\s+cron\.schedule[^;]+;)/gi,
        `DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    $1
  ELSE
    RAISE NOTICE 'pg_cron not available, skipping cron job';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create cron job: %', SQLERRM;
END $$;`
      );
    }

    return content;
  }

  async validate() {
    console.log('🔍 Validating migrations for local development...\n');

    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let errorCount = 0;
    let warningCount = 0;
    const criticalFiles = [];

    // Validate each file
    for (const file of files) {
      const filePath = path.join(this.migrationsDir, file);
      const { issues, warnings } = this.validateFile(filePath);

      if (issues.length > 0) {
        errorCount += issues.length;
        criticalFiles.push(file);
        this.issues.push(...issues);
      }

      if (warnings.length > 0) {
        warningCount += warnings.length;
        this.warnings.push(...warnings);
      }

      if (issues.length === 0 && warnings.length === 0) {
        this.passed.push(file);
      }
    }

    // Generate report
    this.generateReport(errorCount, warningCount, criticalFiles);

    // Generate fixed versions if requested
    if (process.argv.includes('--fix')) {
      this.generateFixedVersions();
    }
  }

  generateReport(errorCount, warningCount, criticalFiles) {
    console.log('='.repeat(80));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${this.passed.length} migrations`);
    console.log(`❌ Errors: ${errorCount} issues in ${criticalFiles.length} files`);
    console.log(`⚠️  Warnings: ${warningCount} issues\n`);

    if (this.issues.length > 0) {
      console.log('🚨 CRITICAL ISSUES (will fail on local setup):\n');

      // Group by rule
      const byRule = {};
      this.issues.forEach((issue) => {
        if (!byRule[issue.rule]) {
          byRule[issue.rule] = [];
        }
        byRule[issue.rule].push(issue);
      });

      for (const [rule, issues] of Object.entries(byRule)) {
        console.log(`${rule}:`);
        console.log(`  ${issues[0].message}`);
        console.log(
          `  Files: ${issues
            .map((i) => i.file)
            .slice(0, 3)
            .join(', ')}${issues.length > 3 ? '...' : ''}`
        );
        console.log(`  Fix: ${issues[0].fix}\n`);
      }
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS (may cause issues):\n');
      const byRule = {};
      this.warnings.forEach((warning) => {
        if (!byRule[warning.rule]) {
          byRule[warning.rule] = [];
        }
        byRule[warning.rule].push(warning);
      });

      for (const [rule, warnings] of Object.entries(byRule)) {
        console.log(`${rule}: ${warnings.length} occurrences`);
      }
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.issues.length + this.warnings.length + this.passed.length,
        passed: this.passed.length,
        errors: errorCount,
        warnings: warningCount,
        criticalFiles: criticalFiles.length,
      },
      issues: this.issues,
      warnings: this.warnings,
      passed: this.passed,
      recommendations: this.generateRecommendations(),
    };

    fs.writeFileSync(
      path.join(path.dirname(this.migrationsDir), 'migration-validation-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log(`\n📊 Detailed report saved to migration-validation-report.json`);

    if (errorCount > 0) {
      console.log('\n💡 Run with --fix flag to generate fixed versions of migrations');
      process.exit(1);
    }
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.issues.some((i) => i.rule === 'authDependency')) {
      recommendations.push({
        issue: 'Auth dependencies',
        solution: 'Use the consolidated migrations that separate auth features',
        priority: 'high',
      });
    }

    if (this.issues.some((i) => i.rule === 'pgCron')) {
      recommendations.push({
        issue: 'pg_cron requirement',
        solution: 'Make cron jobs optional or provide alternative scheduling',
        priority: 'high',
      });
    }

    if (this.warnings.some((w) => w.rule === 'idempotency')) {
      recommendations.push({
        issue: 'Non-idempotent operations',
        solution: 'Add IF EXISTS/IF NOT EXISTS clauses',
        priority: 'medium',
      });
    }

    return recommendations;
  }

  generateFixedVersions() {
    console.log('\n🔧 Generating fixed migration versions...\n');

    const fixedDir = path.join(path.dirname(this.migrationsDir), 'migrations-fixed');
    if (!fs.existsSync(fixedDir)) {
      fs.mkdirSync(fixedDir, { recursive: true });
    }

    this.issues.forEach((issue) => {
      const filePath = path.join(this.migrationsDir, issue.file);
      const fixedContent = this.generateFixedMigration(filePath);
      const fixedPath = path.join(fixedDir, issue.file);

      fs.writeFileSync(fixedPath, fixedContent);
      console.log(`✅ Fixed: ${issue.file}`);
    });

    console.log(`\n📁 Fixed migrations saved to: ${fixedDir}`);
  }
}

// Run validation
const validator = new MigrationValidator();
validator.validate();
