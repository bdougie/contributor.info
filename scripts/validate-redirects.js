#!/usr/bin/env node

/**
 * Validate Netlify redirect configuration
 *
 * This script ensures:
 * 1. No _redirects file exists (to avoid precedence issues)
 * 2. All API routes in netlify.toml have force = true
 * 3. All Netlify functions have corresponding redirects
 * 4. No duplicate redirect rules
 * 5. SPA catch-all comes after all API routes
 */

import fs from 'fs';
import path from 'path';
import toml from '@iarna/toml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const NETLIFY_TOML_PATH = path.join(ROOT_DIR, 'netlify.toml');
const REDIRECTS_PATH = path.join(ROOT_DIR, 'public', '_redirects');
const FUNCTIONS_DIR = path.join(ROOT_DIR, 'netlify', 'functions');

let hasErrors = false;

function logError(message) {
  console.error(`❌ ${message}`);
  hasErrors = true;
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

// Check 1: Ensure no _redirects file exists
function checkNoRedirectsFile() {
  if (fs.existsSync(REDIRECTS_PATH)) {
    logError(
      `_redirects file exists at ${REDIRECTS_PATH}. This file should be deleted to avoid redirect precedence issues.`
    );
    logInfo(
      'The _redirects file takes precedence over netlify.toml and can cause API routes to return HTML.'
    );
  } else {
    logSuccess('No _redirects file found (correct)');
  }
}

// Check 2: Parse and validate netlify.toml
function validateNetlifyToml() {
  if (!fs.existsSync(NETLIFY_TOML_PATH)) {
    logError(`netlify.toml not found at ${NETLIFY_TOML_PATH}`);
    return null;
  }

  try {
    const content = fs.readFileSync(NETLIFY_TOML_PATH, 'utf-8');
    const config = toml.parse(content);
    logSuccess('Successfully parsed netlify.toml');
    return config;
  } catch (error) {
    logError(`Failed to parse netlify.toml: ${error.message}`);
    return null;
  }
}

// Check 3: Validate API redirects
function validateApiRedirects(config) {
  if (!config || !config.redirects) {
    logError('No redirects found in netlify.toml');
    return;
  }

  const apiRedirects = config.redirects.filter((r) => r.from && r.from.startsWith('/api/'));
  const spaRedirect = config.redirects.find((r) => r.from === '/*');
  const spaRedirectIndex = config.redirects.findIndex((r) => r.from === '/*');

  logInfo(`Found ${apiRedirects.length} API redirects`);

  // Check that API redirects come before SPA catch-all
  apiRedirects.forEach((redirect, index) => {
    const redirectIndex = config.redirects.findIndex((r) => r === redirect);

    // Validate force = true for API routes
    if (redirect.force !== true) {
      logError(`API redirect ${redirect.from} should have force = true`);
    }

    // Validate status code
    if (redirect.status !== 200 && redirect.status !== 307) {
      logError(`API redirect ${redirect.from} has unusual status code: ${redirect.status}`);
    }

    // Check if redirect comes before SPA catch-all
    if (spaRedirect && redirectIndex > spaRedirectIndex) {
      logError(`API redirect ${redirect.from} comes after SPA catch-all. It should come before.`);
    }
  });

  if (apiRedirects.every((r) => r.force === true)) {
    logSuccess('All API redirects have force = true');
  }

  // Check for SPA catch-all
  if (!spaRedirect) {
    logError('No SPA catch-all redirect (/*) found');
  } else {
    logSuccess('SPA catch-all redirect found');

    // Ensure SPA redirect doesn't have problematic conditions
    if (spaRedirect.conditions) {
      logInfo(`SPA redirect has conditions: ${JSON.stringify(spaRedirect.conditions)}`);
      logInfo('Consider removing conditions since API routes have force = true');
    }
  }
}

// Check 4: Validate all functions have redirects
function validateFunctionRedirects(config) {
  if (!fs.existsSync(FUNCTIONS_DIR)) {
    logInfo('No functions directory found');
    return;
  }

  const functionFiles = fs
    .readdirSync(FUNCTIONS_DIR)
    .filter((file) => file.endsWith('.js') || file.endsWith('.ts'))
    .map((file) => file.replace(/\.(js|ts)$/, ''));

  const apiPrefixedFunctions = functionFiles.filter((name) => name.startsWith('api-'));

  logInfo(`Found ${apiPrefixedFunctions.length} API functions`);

  apiPrefixedFunctions.forEach((funcName) => {
    // Convert function name to expected API path
    const expectedPath = `/api/${funcName.replace('api-', '')}`;

    const hasRedirect = config.redirects.some((r) => {
      const fromPath = r.from.replace(/\/\*$/, ''); // Remove trailing /* for wildcard paths
      return fromPath === expectedPath || r.to === `/.netlify/functions/${funcName}`;
    });

    if (!hasRedirect) {
      logError(`Function ${funcName} doesn't have a corresponding redirect`);
      logInfo(`Expected redirect from ${expectedPath} to /.netlify/functions/${funcName}`);
    }
  });
}

// Check 5: Check for duplicate redirects
function checkDuplicateRedirects(config) {
  if (!config || !config.redirects) return;

  const fromPaths = config.redirects.map((r) => r.from).filter(Boolean);
  const duplicates = fromPaths.filter((path, index) => fromPaths.indexOf(path) !== index);

  if (duplicates.length > 0) {
    duplicates.forEach((dup) => {
      logError(`Duplicate redirect found for path: ${dup}`);
    });
  } else {
    logSuccess('No duplicate redirects found');
  }
}

// Main validation
function main() {
  console.log('🔍 Validating Netlify redirect configuration...\n');

  checkNoRedirectsFile();
  const config = validateNetlifyToml();

  if (config) {
    validateApiRedirects(config);
    validateFunctionRedirects(config);
    checkDuplicateRedirects(config);
  }

  console.log('\n' + '='.repeat(50));

  if (hasErrors) {
    console.error('\n❌ Redirect validation failed. Please fix the issues above.');
    process.exit(1);
  } else {
    console.log('\n✅ All redirect validations passed!');
    process.exit(0);
  }
}

// Run validation
main();
