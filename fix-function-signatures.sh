#!/bin/bash

# Fix invalid TypeScript function signatures across the codebase
# Pattern: export const FunctionName(TypeName): ReturnType = ({ ... }) => 
# Should be: export const FunctionName = ({ ... }: TypeName) =>

echo "Fixing invalid function signatures in TypeScript files..."

# Find and fix invalid function signatures with specific patterns
find ./src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    # Check if the file contains the problematic pattern
    if grep -q "): JSX\.Element = ({" "$file" || \
       grep -q "): React\.ReactElement = ({" "$file" || \
       grep -q "): ReactElement = ({" "$file"; then
        echo "Fixing function signatures in: $file"
        
        # Use sed to fix the patterns
        sed -i '' -E 's/^export const ([A-Za-z0-9_]+)\(([A-Za-z0-9_]+)\): (JSX\.Element|React\.ReactElement|ReactElement) = \(\{/export const \1 = ({/g' "$file"
        
        # Check if we need to add type annotation at the end of parameters
        if grep -q "export const [A-Za-z0-9_]* = ({.*}) => {" "$file"; then
            # This is a more complex pattern that would need manual fixing
            echo "  Note: May need manual type annotation for $file"
        fi
    fi
done

echo "Function signature fixes completed."