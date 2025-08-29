#!/bin/bash

# Fix console.log security vulnerabilities by replacing template literals with format strings

echo "🔧 Fixing console.log security vulnerabilities..."

# Files to fix based on grep results
declare -a files=(
  "src/lib/progressive-capture/manual-trigger.ts"
  "src/lib/progressive-capture/smart-notifications.ts"
)

for file in "${files[@]}"; do
  echo "Processing $file..."
  
  # Fix patterns like console.log(`text ${var} text`)
  # Convert to console.log('text %s text', var)
  
  # For simple single variable substitutions
  sed -i '' -E "s/console\.log\(\`([^$]*)\\\$\{([^}]+)\}([^$]*)\`\)/console.log('\1%s\3', \2)/g" "$file"
  
  # For numeric values (detected by common patterns)
  sed -i '' -E "s/console\.log\('([^']*) %s ([^']*)', ([^.]+)\.length\)/console.log('\1 %d \2', \3.length)/g" "$file"
  
done

echo "✅ Console.log security fixes applied!"
echo "📝 Please review the changes and run tests to ensure everything works correctly."