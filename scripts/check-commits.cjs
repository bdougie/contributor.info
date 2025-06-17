#!/usr/bin/env node

/**
 * Local commit message checker
 * Helps developers validate conventional commit format before pushing
 */

const { execSync } = require('child_process');

function checkCommitMessage(message) {
  // Basic conventional commit pattern
  const conventionalPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,50}/;
  
  if (!conventionalPattern.test(message)) {
    return {
      valid: false,
      issues: ['Does not match conventional commit format']
    };
  }
  
  const issues = [];
  
  // Check for common issues
  if (message.length > 72) {
    issues.push('Header too long (max 72 characters)');
  }
  
  if (message.endsWith('.')) {
    issues.push('Subject should not end with a period');
  }
  
  if (!/^[a-z]/.test(message.split(':')[1]?.trim())) {
    issues.push('Subject should start with lowercase letter');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

function main() {
  try {
    // Get the last commit message
    const lastCommit = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
    
    console.log('🔍 Checking commit message:');
    console.log(`"${lastCommit}"`);
    console.log();
    
    const result = checkCommitMessage(lastCommit);
    
    if (result.valid) {
      console.log('✅ Commit message follows conventional format!');
      console.log();
      console.log('This will help with:');
      console.log('- 📝 Automatic changelog generation');
      console.log('- 🚀 Automated semantic versioning');
      console.log('- 📊 Better project history tracking');
      process.exit(0);
    } else {
      console.log('⚠️  Commit message issues found:');
      result.issues.forEach(issue => console.log(`  - ${issue}`));
      console.log();
      console.log('Expected format: <type>[optional scope]: <description>');
      console.log();
      console.log('Examples:');
      console.log('  feat: add changelog generation support');
      console.log('  fix: resolve login redirect issue');
      console.log('  docs: update README with new instructions');
      console.log('  chore: update dependencies');
      console.log();
      console.log('Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert');
      console.log();
      console.log('💡 Note: This is a warning only - your PR can still be merged!');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking commit message:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkCommitMessage };