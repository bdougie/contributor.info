#!/bin/bash

# Fix missing closing braces in test files
echo "Fixing missing closing braces in test files..."

# List of files that need fixing based on the lint errors
test_files=(
    "./src/hooks/__tests__/use-github-api.test.ts"
    "./src/hooks/__tests__/use-repo-data.test.ts"
    "./src/hooks/__tests__/use-repository-discovery.test.ts"
    "./src/hooks/__tests__/use-repository-summary.test.ts"
    "./src/lib/__tests__/link-capturing.test.ts"
    "./src/lib/__tests__/yolo-behavior.test.ts"
    "./src/lib/inngest/functions/__tests__/event-flow.integration.test.ts"
    "./src/lib/insights/health-metrics.test.ts"
)

for file in "${test_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "Checking: $file"
        
        # Check if file ends properly with closing braces
        last_lines=$(tail -10 "$file")
        
        # Count opening and closing braces to detect imbalance
        opening=$(grep -o '{' "$file" | wc -l)
        closing=$(grep -o '}' "$file" | wc -l)
        
        if [[ $opening -gt $closing ]]; then
            echo "  Found missing closing braces in $file (opening: $opening, closing: $closing)"
            
            # Add missing closing braces - typically describe blocks need });
            missing=$((opening - closing))
            for ((i=1; i<=missing; i++)); do
                echo "});" >> "$file"
            done
            
            echo "  Added $missing closing braces"
        fi
    else
        echo "  File not found: $file"
    fi
done

echo "Missing braces fix completed."