#!/bin/bash

# Fix all empty catch blocks that cause "Identifier expected" TypeScript errors
# This script replaces "catch ()" with "catch (error)" throughout the codebase

echo "Fixing empty catch blocks in TypeScript files..."

# Find all TypeScript files with empty catch blocks and fix them
find ./src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    if grep -q "catch ()" "$file"; then
        echo "Fixing: $file"
        # Use perl for more reliable in-place editing with complex patterns
        perl -i -pe 's/catch \(\)/catch (error)/g' "$file"
    fi
done

# Also fix any _error references to use the proper error variable
find ./src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    if grep -q "_error" "$file"; then
        echo "Fixing _error references in: $file"
        # Replace _error with error in console.error and similar contexts
        perl -i -pe 's/console\.error\([^,]+,\s*_error\)/console.error($1, error)/g' "$file"
        perl -i -pe 's/_error/error/g' "$file"
    fi
done

echo "Done! All empty catch blocks have been fixed."