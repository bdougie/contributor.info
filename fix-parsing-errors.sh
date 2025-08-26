#!/bin/bash

# Fix all the parsing errors with double colon in destructuring
# Pattern: { error: _error: varName } should be { error: varName }

echo "Fixing parsing errors in TypeScript files..."

# Find and replace all instances
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/error: _error:/error:/g' {} \;

# Also fix similar patterns with data
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/data: _data:/data:/g' {} \;

# Fix patterns with other variables
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/loading: _loading:/loading:/g' {} \;

echo "Parsing errors fixed!"