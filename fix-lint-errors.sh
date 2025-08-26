#!/bin/bash

# Script to fix common linting errors systematically

echo "Fixing common linting patterns..."

# Fix common 'any' patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/: any\[\]/: unknown\[\]/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/: any =/: unknown =/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/: any)/: unknown)/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/: any,/: unknown,/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/: any;/: unknown;/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/: any |/: unknown |/g'

# Fix unused variable patterns (prefix with underscore)
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/({ error }/({ error: _error }/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/(\[error\]/(\[_error\]/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/(error,/(\_error,/g'

# Fix specific mock patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/(props: any)/(props: Record<string, unknown>)/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/(event: any)/(event: unknown)/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/(data: any)/(data: unknown)/g'

echo "Fixed common patterns. Please run linting to check remaining errors."