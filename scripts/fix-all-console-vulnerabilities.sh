#!/bin/bash

# Fix console.log template literal security vulnerabilities
# This script applies safe string formatting to prevent log injection attacks

echo "🔒 Fixing console.log security vulnerabilities..."
echo ""

# Function to fix files
fix_files() {
  local pattern="$1"
  local replacement="$2"
  local file_pattern="$3"
  
  find . -type f -name "$file_pattern" \
    -not -path "./node_modules/*" \
    -not -path "./.next/*" \
    -not -path "./dist/*" \
    -not -path "./build/*" \
    -not -path "./storybook-static/*" \
    -not -path "./.storybook-cleanup/*" \
    -exec sed -i '' "$pattern" {} \;
}

# Fix patterns with 1 variable: console.log(`text ${var}`) -> console.log('text %s', var)
echo "Fixing single variable patterns..."
fix_files 's/console\.log(`\([^`]*\)\${\([^}]*\)}`)/console.log('\''\\1%s'\'', \\2)/g' "*.ts"
fix_files 's/console\.log(`\([^`]*\)\${\([^}]*\)}`)/console.log('\''\\1%s'\'', \\2)/g' "*.tsx"
fix_files 's/console\.log(`\([^`]*\)\${\([^}]*\)}`)/console.log('\''\\1%s'\'', \\2)/g' "*.js"
fix_files 's/console\.log(`\([^`]*\)\${\([^}]*\)}`)/console.log('\''\\1%s'\'', \\2)/g' "*.mjs"
fix_files 's/console\.log(`\([^`]*\)\${\([^}]*\)}`)/console.log('\''\\1%s'\'', \\2)/g' "*.mts"

# Fix console.error patterns
echo "Fixing console.error patterns..."
fix_files 's/console\.error(`\([^`]*\)\${\([^}]*\)}`)/console.error('\''\\1%s'\'', \\2)/g' "*.ts"
fix_files 's/console\.error(`\([^`]*\)\${\([^}]*\)}`)/console.error('\''\\1%s'\'', \\2)/g' "*.tsx"
fix_files 's/console\.error(`\([^`]*\)\${\([^}]*\)}`)/console.error('\''\\1%s'\'', \\2)/g' "*.js"

# Fix console.warn patterns
echo "Fixing console.warn patterns..."
fix_files 's/console\.warn(`\([^`]*\)\${\([^}]*\)}`)/console.warn('\''\\1%s'\'', \\2)/g' "*.ts"
fix_files 's/console\.warn(`\([^`]*\)\${\([^}]*\)}`)/console.warn('\''\\1%s'\'', \\2)/g' "*.tsx"
fix_files 's/console\.warn(`\([^`]*\)\${\([^}]*\)}`)/console.warn('\''\\1%s'\'', \\2)/g' "*.js"

echo ""
echo "✅ Security vulnerability fixes applied!"
echo ""
echo "⚠️  Note: Complex patterns with multiple variables may need manual review."
echo "    Run: grep -r 'console\\.log(\`.*\${' --include='*.ts' --include='*.tsx' --include='*.js' | grep -v node_modules"
echo "    to find any remaining instances that need manual fixing."