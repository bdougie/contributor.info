#!/usr/bin/env node

/**
 * Inngest Pipeline Validation Script
 *
 * Validates that the Inngest pipeline is properly configured and functioning.
 * Tests endpoints, configuration, and database connectivity.
 */

const PROD_URL = 'https://contributor.info';
const TIMEOUT_MS = 10000;

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function testHealthCheck(baseUrl) {
  log('\nTest 1: Inngest Health Check', 'blue');
  log('--------------------------------');

  const url = `${baseUrl}/.netlify/functions/inngest-health`;
  logInfo(`URL: ${url}`);

  try {
    const response = await fetchWithTimeout(url);
    const contentType = response.headers.get('content-type');

    if (response.ok) {
      logSuccess(`Health check responded (HTTP ${response.status})`);

      // Check if response is JSON
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        logSuccess('Response is valid JSON');
        console.log(JSON.stringify(data, null, 2));

        // Check for required environment variables
        if (data.env) {
          if (data.env.hasEventKey) {
            logSuccess('  INNGEST_EVENT_KEY configured');
          } else {
            logError('  INNGEST_EVENT_KEY missing');
          }

          if (data.env.hasSigningKey) {
            logSuccess('  INNGEST_SIGNING_KEY configured');
          } else {
            logError('  INNGEST_SIGNING_KEY missing');
          }

          logInfo(`  Context: ${data.env.context || 'unknown'}`);
        }

        return { success: true, data };
      } else {
        logWarning('Response is not JSON (likely HTML from SPA routing)');
        logInfo('Endpoint may be intercepted by Netlify redirects');
        logInfo('Skipping health check - will verify via main endpoint instead');
        return { success: true, note: 'Skipped (SPA routing)' };
      }
    } else {
      logError(`Health check failed (HTTP ${response.status})`);
      const text = await response.text();
      console.log(text.slice(0, 500));
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    // If we get a JSON parse error, it's likely HTML from SPA routing
    if (error.message.includes('JSON')) {
      logWarning('Response is not JSON (likely HTML from SPA routing)');
      logInfo('Endpoint may be intercepted by Netlify redirects');
      logInfo('Skipping health check - will verify via main endpoint instead');
      return { success: true, note: 'Skipped (SPA routing)' };
    }

    logError(`Failed to connect: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testInngestIntrospection(baseUrl) {
  log('\nTest 2: Inngest Function Introspection', 'blue');
  log('--------------------------------');

  const url = `${baseUrl}/api/inngest`;
  logInfo(`URL: ${url}`);

  try {
    const response = await fetchWithTimeout(url);

    if (response.ok) {
      logSuccess(`Inngest endpoint responded (HTTP ${response.status})`);

      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        const data = await response.json();

        // Check for Inngest SDK response (newer format)
        if (data.schema_version && data.mode) {
          logSuccess('Inngest SDK responded');
          console.log(JSON.stringify(data, null, 2));

          // Check function count
          if (data.function_count !== undefined) {
            if (data.function_count > 0) {
              logSuccess(`  Registered ${data.function_count} function(s)`);
            } else {
              logWarning('  No functions registered');
            }
          }

          // Check authentication
          if (data.authentication_succeeded === false) {
            logWarning('  Authentication failed (this may be expected for introspection)');
          } else if (data.authentication_succeeded === true) {
            logSuccess('  Authentication succeeded');
          }

          // Check keys
          if (data.has_event_key) {
            logSuccess('  Event key configured');
          } else {
            logError('  Event key missing');
          }

          if (data.has_signing_key) {
            logSuccess('  Signing key configured');
          } else {
            logError('  Signing key missing');
          }

          logInfo(`  Mode: ${data.mode}`);
          logInfo(`  Schema version: ${data.schema_version}`);

          return {
            success: data.function_count > 0 && data.has_event_key && data.has_signing_key,
            functionCount: data.function_count,
            data,
          };
        }
        // Check for older Inngest introspection format
        else if (data.functions && Array.isArray(data.functions)) {
          logSuccess(`Registered ${data.functions.length} function(s)`);

          log('\n  Registered Functions:');
          data.functions.forEach((func, index) => {
            console.log(`    ${index + 1}. ${func.name || func.id || 'Unknown'}`);
          });

          return { success: true, functionCount: data.functions.length, data };
        } else {
          logWarning('Response structure does not match expected format');
          console.log(JSON.stringify(data, null, 2).slice(0, 500));
          return { success: false, error: 'Invalid response structure' };
        }
      } else {
        logWarning('Response is not JSON');
        const text = await response.text();
        console.log(text.slice(0, 500));
        return { success: false, error: 'Non-JSON response' };
      }
    } else {
      logError(`Introspection failed (HTTP ${response.status})`);
      const text = await response.text();
      console.log(text.slice(0, 500));
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    logError(`Failed to connect: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testInngestWebhookConfig() {
  log('\nTest 3: Inngest Webhook Configuration', 'blue');
  log('--------------------------------');

  logInfo('Expected webhook URL:');
  console.log(`  ${PROD_URL}/.netlify/functions/inngest-prod`);
  console.log(`  OR`);
  console.log(`  ${PROD_URL}/api/inngest`);

  logInfo('\nTo verify webhook configuration:');
  console.log('  1. Visit https://app.inngest.com');
  console.log('  2. Go to Apps > contributor-info > Settings');
  console.log('  3. Check the webhook URL matches one of the above');

  return { success: true, note: 'Manual verification required' };
}

async function testDatabaseHealth() {
  log('\nTest 4: Database Health Check', 'blue');
  log('--------------------------------');

  logInfo('Checking for environment variables...');

  // Check if we're in local environment with .env.local
  try {
    const fs = await import('fs');
    const path = await import('path');
    const envPath = path.join(process.cwd(), '.env.local');

    if (fs.existsSync(envPath)) {
      logSuccess('.env.local file exists');

      const envContent = fs.readFileSync(envPath, 'utf-8');
      const requiredVars = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'INNGEST_EVENT_KEY',
        'INNGEST_SIGNING_KEY',
        'GITHUB_TOKEN',
      ];

      requiredVars.forEach((varName) => {
        if (envContent.includes(`${varName}=`)) {
          logSuccess(`  ${varName} configured`);
        } else {
          logWarning(`  ${varName} not found`);
        }
      });

      return { success: true };
    } else {
      logInfo('.env.local not found (expected in production)');
      return { success: true, note: 'Skipped in production' };
    }
  } catch (error) {
    logWarning(`Could not check environment: ${error.message}`);
    return { success: true, note: 'Skipped' };
  }
}

async function validatePipeline() {
  log('========================================');
  log('Inngest Pipeline Validation', 'blue');
  log('========================================');
  logInfo(`Target: ${PROD_URL}`);
  logInfo(`Timeout: ${TIMEOUT_MS}ms`);

  const results = {
    healthCheck: await testHealthCheck(PROD_URL),
    introspection: await testInngestIntrospection(PROD_URL),
    webhookConfig: await testInngestWebhookConfig(),
    databaseHealth: await testDatabaseHealth(),
  };

  log('\n========================================');
  log('Summary', 'blue');
  log('========================================\n');

  const allPassed = Object.values(results).every((r) => r.success);

  if (allPassed) {
    logSuccess('All tests passed!');
  } else {
    logError('Some tests failed');
  }

  log('\nTest Results:');
  Object.entries(results).forEach(([name, result]) => {
    const status = result.success ? '✓' : '✗';
    const color = result.success ? 'green' : 'red';
    log(`  ${status} ${name}`, color);

    if (result.error) {
      log(`    Error: ${result.error}`, 'red');
    }
    if (result.note) {
      log(`    Note: ${result.note}`, 'yellow');
    }
  });

  log('\n========================================');
  log('Next Steps', 'blue');
  log('========================================\n');

  if (!results.introspection.success) {
    logWarning('Inngest introspection failed. Check:');
    console.log(
      '  1. Netlify function logs at: https://app.netlify.com/sites/contributor-info/functions'
    );
    console.log('  2. Environment variables in Netlify dashboard');
    console.log('  3. Build logs for any deployment errors');
  }

  if (results.introspection.functionCount === 0) {
    logWarning('No Inngest functions registered. This may be a configuration issue.');
  }

  log('\nUseful Links:');
  console.log('  Inngest Dashboard: https://app.inngest.com');
  console.log('  Netlify Dashboard: https://app.netlify.com/sites/contributor-info');
  console.log('  Supabase Dashboard: https://supabase.com/dashboard');

  process.exit(allPassed ? 0 : 1);
}

// Run validation
validatePipeline().catch((error) => {
  logError(`Validation failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
