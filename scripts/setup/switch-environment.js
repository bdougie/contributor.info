#!/usr/bin/env node

/**
 * Environment Switcher Script
 * 
 * Helps developers switch between local and production Supabase environments
 * Usage: npm run env:local | npm run env:production
 * 
 * Security measures:
 * - Input validation with whitelist approach
 * - Path traversal prevention
 * - Safe file operations with proper error handling
 * - Atomic file writes to prevent corruption
 * - Secure command execution
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(path.join(__dirname, '..', '..'));

// Security: Validate root directory is within expected bounds
const validateRootDir = (dir) => {
  const resolved = path.resolve(dir);
  const expected = path.resolve(process.cwd());
  
  // Ensure we're operating within the project directory
  if (!resolved.startsWith(expected) && !expected.startsWith(resolved)) {
    throw new Error('Security Error: Invalid root directory detected');
  }
  
  // Check for path traversal attempts
  if (resolved.includes('..') || resolved !== path.normalize(resolved)) {
    throw new Error('Security Error: Path traversal attempt detected');
  }
  
  return resolved;
};

// Validate and sanitize the root directory
const SAFE_ROOT_DIR = validateRootDir(rootDir);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

// Environment configurations (hardcoded for security)
const environments = {
  local: {
    VITE_SUPABASE_URL: 'http://localhost:54321',
    VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    VITE_ENV: 'local',
    description: 'Local Supabase Development',
    instructions: [
      'Make sure Docker is running',
      'Run: npm run supabase:start',
      'Supabase Studio will be available at: http://localhost:54323',
      'Your app will connect to local Supabase at: http://localhost:54321'
    ]
  },
  production: {
    // Don't set VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY here - preserve existing values
    VITE_ENV: 'production',
    description: 'Production Supabase',
    instructions: [
      'Using production Supabase instance',
      'Make sure you have the correct production URL and keys in your .env.local',
      'Be careful with database operations!'
    ]
  }
};

// Security: Whitelist of allowed environment names
const ALLOWED_ENVIRONMENTS = Object.keys(environments);

// Security: Maximum file size for .env files (1MB)
const MAX_ENV_FILE_SIZE = 1024 * 1024;

// Security: Maximum number of backup files to keep
const MAX_BACKUP_FILES = 5;

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log(`${'='.repeat(60)}`, colors.cyan);
  log(title, colors.bright + colors.cyan);
  log(`${'='.repeat(60)}`, colors.cyan);
}

// Security: Safe command execution with timeout
async function safeExec(command, options = {}) {
  const timeout = options.timeout || 5000;
  const sanitizedCommand = command.replace(/[;&|`$]/g, ''); // Remove shell metacharacters
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
    
    execAsync(sanitizedCommand, options)
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function checkDockerRunning() {
  try {
    await safeExec('docker info', { timeout: 3000 });
    return true;
  } catch (error) {
    return false;
  }
}

async function checkSupabaseStatus() {
  try {
    const { stdout } = await safeExec('npx supabase status 2>/dev/null', { timeout: 10000 });
    return stdout.includes('API URL');
  } catch (error) {
    return false;
  }
}

// Security: Safe file path validation
function validateFilePath(filePath, expectedDir) {
  const resolved = path.resolve(filePath);
  const expectedResolved = path.resolve(expectedDir);
  
  if (!resolved.startsWith(expectedResolved)) {
    throw new Error(`Security Error: File path outside expected directory: ${filePath}`);
  }
  
  // Check for null bytes
  if (resolved.includes('\0')) {
    throw new Error('Security Error: Null byte detected in file path');
  }
  
  return resolved;
}

// Security: Safe file reading with size limit
function readEnvFile(filePath) {
  try {
    const safePath = validateFilePath(filePath, SAFE_ROOT_DIR);
    
    if (!fs.existsSync(safePath)) {
      return {};
    }
    
    const stats = fs.statSync(safePath);
    
    // Security: Check file size
    if (stats.size > MAX_ENV_FILE_SIZE) {
      throw new Error(`Security Error: File too large (${stats.size} bytes). Maximum allowed: ${MAX_ENV_FILE_SIZE} bytes`);
    }
    
    // Security: Check if it's actually a file
    if (!stats.isFile()) {
      throw new Error('Security Error: Path is not a regular file');
    }
    
    const content = fs.readFileSync(safePath, 'utf8');
    const env = {};
    
    // Parse environment variables with validation
    content.split('\n').forEach((line, index) => {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || line.trim() === '') {
        return;
      }
      
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)[=:](.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Security: Validate key format
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
          console.warn(`Warning: Skipping invalid environment variable key at line ${index + 1}: ${key}`);
          return;
        }
        
        // Security: Limit key and value length
        if (key.length > 256 || value.length > 8192) {
          console.warn(`Warning: Skipping oversized environment variable at line ${index + 1}`);
          return;
        }
        
        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        env[key] = value;
      }
    });
    
    return env;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

// Security: Atomic file write to prevent corruption
function writeEnvFile(filePath, env) {
  const safePath = validateFilePath(filePath, SAFE_ROOT_DIR);
  
  // Security: Validate all keys and values
  for (const [key, value] of Object.entries(env)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid environment variable key: ${key}`);
    }
    if (typeof value !== 'string') {
      throw new Error(`Environment variable value must be a string: ${key}`);
    }
    if (key.length > 256 || value.length > 8192) {
      throw new Error(`Environment variable too large: ${key}`);
    }
  }
  
  const content = Object.entries(env)
    .map(([key, value]) => {
      // Escape special characters in value if needed
      const escapedValue = value.includes('\n') || value.includes('"') 
        ? `"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"` 
        : value;
      return `${key}=${escapedValue}`;
    })
    .join('\n');
  
  // Security: Write atomically using a temporary file
  const tempPath = `${safePath}.tmp.${crypto.randomBytes(6).toString('hex')}`;
  
  try {
    fs.writeFileSync(tempPath, content + '\n', { mode: 0o600 }); // Restrictive permissions
    fs.renameSync(tempPath, safePath); // Atomic rename
  } catch (error) {
    // Clean up temp file if it exists
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

// Security: Validate environment name against whitelist
function validateEnvironmentName(envName) {
  if (!envName || typeof envName !== 'string') {
    throw new Error('Environment name must be a non-empty string');
  }
  
  // Security: Strict whitelist validation
  if (!ALLOWED_ENVIRONMENTS.includes(envName)) {
    throw new Error(
      `Invalid environment '${envName}'. Allowed environments: ${ALLOWED_ENVIRONMENTS.join(', ')}`
    );
  }
  
  return envName;
}

// Security: Safe backup file creation
function createBackup(sourcePath) {
  const safePath = validateFilePath(sourcePath, SAFE_ROOT_DIR);
  
  if (!fs.existsSync(safePath)) {
    return null;
  }
  
  const timestamp = Date.now();
  const backupPath = validateFilePath(
    path.join(SAFE_ROOT_DIR, `.env.local.backup.${timestamp}`),
    SAFE_ROOT_DIR
  );
  
  try {
    fs.copyFileSync(safePath, backupPath);
    fs.chmodSync(backupPath, 0o600); // Restrictive permissions
    return backupPath;
  } catch (error) {
    throw new Error(`Failed to create backup: ${error.message}`);
  }
}

// Security: Clean up old backups with validation
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(SAFE_ROOT_DIR);
    
    const backupFiles = files
      .filter(file => /^\.env\.local\.backup\.\d+$/.test(file))
      .map(file => ({
        name: file,
        path: validateFilePath(path.join(SAFE_ROOT_DIR, file), SAFE_ROOT_DIR),
        timestamp: parseInt(file.match(/\.(\d+)$/)[1], 10)
      }))
      .filter(backup => !isNaN(backup.timestamp))
      .sort((a, b) => b.timestamp - a.timestamp);
    
    // Keep only the most recent backups
    if (backupFiles.length > MAX_BACKUP_FILES) {
      const toDelete = backupFiles.slice(MAX_BACKUP_FILES);
      
      for (const backup of toDelete) {
        try {
          fs.unlinkSync(backup.path);
        } catch (error) {
          console.warn(`Warning: Could not delete old backup ${backup.name}: ${error.message}`);
        }
      }
      
      return toDelete.length;
    }
    
    return 0;
  } catch (error) {
    console.warn(`Warning: Could not clean up backups: ${error.message}`);
    return 0;
  }
}

async function switchEnvironment(envName) {
  // Security: Validate input
  const validatedEnvName = validateEnvironmentName(envName);
  const envConfig = environments[validatedEnvName];
  
  if (!envConfig) {
    // This shouldn't happen due to validation, but double-check
    throw new Error(`Environment configuration not found: ${validatedEnvName}`);
  }
  
  logSection(`Switching to ${envConfig.description}`);
  
  try {
    // Paths with validation
    const envLocalPath = validateFilePath(path.join(SAFE_ROOT_DIR, '.env.local'), SAFE_ROOT_DIR);
    const envExamplePath = validateFilePath(path.join(SAFE_ROOT_DIR, '.env.example'), SAFE_ROOT_DIR);
    
    // Read current environment
    const currentEnv = readEnvFile(envLocalPath);
    
    // Create backup if .env.local exists
    if (fs.existsSync(envLocalPath)) {
      const backupPath = createBackup(envLocalPath);
      if (backupPath) {
        log(`✅ Backed up current .env.local to: ${path.basename(backupPath)}`, colors.green);
      }
    }
    
    // Merge with example if it exists
    let baseEnv = {};
    if (fs.existsSync(envExamplePath)) {
      baseEnv = readEnvFile(envExamplePath);
    }
    
    // Apply environment-specific changes
    // For production, preserve existing VITE_SUPABASE_ANON_KEY if present
    const envChanges = Object.entries(envConfig)
      .filter(([key]) => key !== 'description' && key !== 'instructions')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    
    const newEnv = {
      ...baseEnv,
      ...currentEnv,
      ...envChanges
    };
    
    // Special handling for production environment
    if (validatedEnvName === 'production') {
      let hasErrors = false;
      
      // Check if production URL exists
      if (!newEnv.VITE_SUPABASE_URL || 
          newEnv.VITE_SUPABASE_URL === 'https://your-project.supabase.co' ||
          !newEnv.VITE_SUPABASE_URL.includes('supabase.co')) {
        log('⚠️  Warning: No valid production URL found in .env.local', colors.yellow);
        log('   Please add your production VITE_SUPABASE_URL to .env.local', colors.yellow);
        hasErrors = true;
      }
      
      // Check if production key exists
      if (!newEnv.VITE_SUPABASE_ANON_KEY || 
          newEnv.VITE_SUPABASE_ANON_KEY === 'YOUR_PRODUCTION_ANON_KEY_HERE' ||
          newEnv.VITE_SUPABASE_ANON_KEY === 'your-supabase-anon-key' ||
          newEnv.VITE_SUPABASE_ANON_KEY === 'your-production-anon-key' ||
          !newEnv.VITE_SUPABASE_ANON_KEY.startsWith('eyJ')) {
        log('⚠️  Warning: No valid production anon key found in .env.local', colors.yellow);
        log('   Please add your production VITE_SUPABASE_ANON_KEY to .env.local', colors.yellow);
        hasErrors = true;
      }
      
      if (hasErrors) {
        console.log('');
        log('   You can find these in your Supabase dashboard under Settings > API', colors.yellow);
        console.log('');
        log('   Example:', colors.cyan);
        log('   VITE_SUPABASE_URL=https://your-project.supabase.co', colors.cyan);
        log('   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...', colors.cyan);
        console.log('');
        
        log('❓ Cannot switch to production without valid credentials.', colors.red);
        log('   Please add them to .env.local and try again.', colors.yellow);
        process.exit(1);
      }
    }
    
    // Write new environment file
    writeEnvFile(envLocalPath, newEnv);
    log(`✅ Updated .env.local for ${envConfig.description}`, colors.green);
    
    // Show instructions
    console.log('');
    log('Next Steps:', colors.bright + colors.yellow);
    envConfig.instructions.forEach((instruction, index) => {
      log(`  ${index + 1}. ${instruction}`, colors.yellow);
    });
    
    // Additional checks for local environment
    if (validatedEnvName === 'local') {
      console.log('');
      log('Checking local environment...', colors.blue);
      
      const dockerRunning = await checkDockerRunning();
      if (dockerRunning) {
        log('  ✅ Docker is running', colors.green);
        
        const supabaseRunning = await checkSupabaseStatus();
        if (supabaseRunning) {
          log('  ✅ Supabase is already running', colors.green);
        } else {
          log('  ⚠️  Supabase is not running. Run: npm run supabase:start', colors.yellow);
        }
      } else {
        log('  ❌ Docker is not running. Please start Docker Desktop first.', colors.red);
      }
    }
    
    // Show current configuration (sanitized)
    console.log('');
    log('Current Configuration:', colors.bright + colors.blue);
    log(`  VITE_SUPABASE_URL: ${newEnv.VITE_SUPABASE_URL || 'not set'}`, colors.blue);
    log(`  VITE_ENV: ${newEnv.VITE_ENV || 'not set'}`, colors.blue);
    
    // Clean up old backups
    const deletedCount = cleanupOldBackups();
    if (deletedCount > 0) {
      log(`\nCleaned up ${deletedCount} old backup file(s) (kept last ${MAX_BACKUP_FILES})`, colors.cyan);
    }
    
    logSection('Environment Switch Complete! 🎉');
  } catch (error) {
    log(`Error: ${error.message}`, colors.red);
    
    // Security: Don't expose sensitive error details
    if (error.message.includes('Security Error')) {
      log('This appears to be a security-related issue. Please check your setup.', colors.red);
    }
    
    process.exit(1);
  }
}

// Main execution with input validation
async function main() {
  try {
    // Security: Validate command line arguments
    const args = process.argv.slice(2);
    
    if (args.length !== 1) {
      log('Usage: node switch-environment.js [local|production]', colors.yellow);
      log('  or: npm run env:local', colors.yellow);
      log('  or: npm run env:production', colors.yellow);
      process.exit(1);
    }
    
    const environment = args[0];
    
    // Security: Validate environment name
    validateEnvironmentName(environment);
    
    // Switch environment with all security checks
    await switchEnvironment(environment);
  } catch (error) {
    log(`Error: ${error.message}`, colors.red);
    
    // Security: Don't expose stack traces in production
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run the script
main();