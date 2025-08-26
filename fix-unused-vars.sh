#!/bin/bash

echo "🔧 Fixing unused variables..."

# Fix unused underscore variables by removing them from catch blocks
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Remove unused _ parameters in catch blocks
  sed -i '' 's/catch (_)/catch ()/g' "$file"
  
  # Remove unused _error parameters
  sed -i '' 's/catch (_error)/catch ()/g' "$file"
  
  # Fix array destructuring with unused first element
  sed -i '' 's/const \[_, /const [, /g' "$file"
  sed -i '' 's/const \[ _, /const [ , /g' "$file"
done

# Fix specific patterns where variables are defined but not used
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Comment out unused variable assignments (preserve for future use)
  sed -i '' 's/const _data = /\/\/ const _data = /g' "$file"
  sed -i '' 's/const _errors = /\/\/ const _errors = /g' "$file"
  sed -i '' 's/const _role = /\/\/ const _role = /g' "$file"
done

echo "✅ Fixed unused variables"