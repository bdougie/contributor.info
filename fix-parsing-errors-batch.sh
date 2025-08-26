#!/bin/bash

# Fix common parsing errors across the codebase
echo "Fixing parsing errors..."

# Fix error: _variable syntax errors
find src -name "*.tsx" -o -name "*.ts" | grep -v __tests__ | xargs sed -i '' -E 's/\$\{error:\s*_([a-zA-Z_][a-zA-Z0-9_]*)\}/\${\1 instanceof Error ? \1.message : String(\1)}/g'

# Fix other common patterns
find src -name "*.tsx" -o -name "*.ts" | grep -v __tests__ | xargs sed -i '' -E 's/\$\{error:\s*([a-zA-Z_][a-zA-Z0-9_]*)\}/\${\1 instanceof Error ? \1.message : String(\1)}/g'

echo "Fixed parsing errors"