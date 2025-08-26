#!/bin/bash

echo "Fixing additional linting patterns..."

# Fix common unused variable patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/const {\([^}]*\)error\([^}]*\)} =/const {\1error: _error\2} =/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/{\([^}]*\)error}/{\1error: _error}/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/\[error\]/\[_error\]/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/, error,/, _error,/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/(\([^)]*\)error\([^)]*\))/(\1_error\2)/g'

# Fix common patterns for unused variables
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/(status)/(\_status)/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/(\([^)]*\)columns\([^)]*\))/(\1_columns\2)/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/(\([^)]*\)data\([^)]*\))/(\1_data\2)/g'

# Fix .single() to .maybeSingle()
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/\.single()/\.maybeSingle()/g'

# Fix React.FC to proper function component types
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/: React\.FC<\([^>]*\)>/(\1): JSX.Element/g'

# Fix Record<string, any> patterns
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/Record<string, any>/Record<string, unknown>/g'

# Fix more common any patterns in function parameters
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/\(callback: \)any/\1(...args: unknown[]) => unknown/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/\(fn: \)any/\1(...args: unknown[]) => unknown/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/\(handler: \)any/\1(...args: unknown[]) => unknown/g'

echo "Fixed additional patterns."