#!/bin/bash

# Script to fix console.log security vulnerabilities
# Replaces template literals with safe string formatting

echo "🔍 Fixing console.log security vulnerabilities..."
echo ""

# Counter for fixed files
FIXED_COUNT=0

# Function to fix TypeScript/JavaScript files
fix_js_files() {
  # Find all files with console.log template literals
  FILES=$(grep -rl "console\.log(\`.*\${" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.mjs" --include="*.mts" . 2>/dev/null | grep -v node_modules | grep -v ".storybook-cleanup" | grep -v "storybook-static" | grep -v ".next" | grep -v "dist" | grep -v "build")
  
  for file in $FILES; do
    if [ -f "$file" ]; then
      echo "Fixing: $file"
      
      # Create a backup
      cp "$file" "$file.bak"
      
      # Fix simple single variable template literals
      # console.log(`text ${var}`) -> console.log('text %s', var)
      sed -i '' -E "s/console\.log\(\`([^\`]*)\\\$\{([^}]+)\}([^\`]*)\`\)/console.log('\1%s\3', \2)/g" "$file"
      
      # Fix template literals with multiple variables (requires more complex handling)
      # This is a simplified approach - for complex cases manual review may be needed
      perl -i -pe 's/console\.log\(`([^`]+)\`\)/
        my $content = $1;
        my @vars = ();
        $content =~ s|\$\{([^}]+)\}|push @vars, $1; "%s"|ge;
        if (@vars) {
          "console.log('\''$content'\'', " . join(", ", @vars) . ")";
        } else {
          "console.log('\''$content'\'')";
        }
      /ge' "$file"
      
      # Check if file was actually modified
      if ! diff -q "$file" "$file.bak" > /dev/null; then
        ((FIXED_COUNT++))
        rm "$file.bak"
      else
        # No changes, restore from backup
        mv "$file.bak" "$file"
      fi
    fi
  done
}

# Function to fix YAML workflow files
fix_yaml_files() {
  FILES=$(grep -l "console\.log(\`.*\${" .github/workflows/*.yml 2>/dev/null)
  
  for file in $FILES; do
    if [ -f "$file" ]; then
      echo "Fixing: $file"
      
      # Create a backup
      cp "$file" "$file.bak"
      
      # In YAML files, we need to be more careful with quotes
      # Replace template literals with string formatting
      sed -i '' -E "s/console\.log\(\`([^\`]*)\\\$\{([^}]+)\}([^\`]*)\`\)/console.log('\1%s\3', \2)/g" "$file"
      
      # Check if file was actually modified
      if ! diff -q "$file" "$file.bak" > /dev/null; then
        ((FIXED_COUNT++))
        rm "$file.bak"
      else
        mv "$file.bak" "$file"
      fi
    fi
  done
}

# Run the fixes
fix_js_files
fix_yaml_files

echo ""
echo "📊 Summary:"
echo "  Files fixed: $FIXED_COUNT"
echo ""

if [ $FIXED_COUNT -gt 0 ]; then
  echo "✅ Security vulnerabilities fixed!"
  echo "⚠️  Please review the changes and test your application."
  echo ""
  echo "The following pattern was applied:"
  echo "  console.log(\`text \${variable}\`) → console.log('text %s', variable)"
else
  echo "✅ No vulnerabilities found or all already fixed!"
fi