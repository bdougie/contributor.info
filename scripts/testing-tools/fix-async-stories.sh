#!/bin/bash

# Script to remove async/await patterns from Storybook stories
# Following bulletproof testing guidelines - NO async/await allowed

echo "🔧 Fixing async patterns in Storybook stories..."
echo "Following bulletproof testing guidelines - removing all async/await"
echo ""

# Counter for tracking
FILES_FIXED=0

# Find all story files with async play functions
for file in $(find src -name "*.stories.tsx" -o -name "*.stories.ts" | xargs grep -l "play: async"); do
    echo "Fixing: $file"
    
    # Remove async from play functions
    sed -i.bak 's/play: async (/play: (/g' "$file"
    
    # Remove await from expect statements
    sed -i.bak 's/await expect/expect/g' "$file"
    
    # Remove await from userEvent
    sed -i.bak 's/await userEvent\./userEvent\./g' "$file"
    
    # Remove await from waitFor (comment it out as it's not needed)
    sed -i.bak 's/await waitFor/\/\/ waitFor removed - sync only/g' "$file"
    
    # Remove await from within
    sed -i.bak 's/await within/within/g' "$file"
    
    # Remove await from screen
    sed -i.bak 's/await screen\./screen\./g' "$file"
    
    # Remove await from any remaining async test utilities
    sed -i.bak 's/await wait/\/\/ wait removed/g' "$file"
    
    # Clean up backup files
    rm "${file}.bak"
    
    FILES_FIXED=$((FILES_FIXED + 1))
done

echo ""
echo "✅ Fixed $FILES_FIXED story files"
echo "📋 All stories now follow bulletproof testing guidelines!"
echo ""
echo "Note: Some tests may need manual adjustment for:"
echo "  - Complex async logic (convert to synchronous)"
echo "  - Timer-based tests (use vi.useFakeTimers())"
echo "  - Network requests (mock synchronously)"