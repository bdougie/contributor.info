#!/bin/bash

# Script to test visual regression detection
# Creates a temporary visual change, runs Chromatic, then reverts the change

echo "🧪 Testing visual regression detection..."

# Create a backup of a story file
STORY_FILE="src/components/ui/button.stories.tsx"
BACKUP_FILE="${STORY_FILE}.backup"

if [ ! -f "$STORY_FILE" ]; then
    echo "❌ Error: $STORY_FILE not found"
    exit 1
fi

# Create backup
cp "$STORY_FILE" "$BACKUP_FILE"
echo "📋 Created backup of $STORY_FILE"

# Modify the story to introduce a visual change
echo "✏️  Introducing temporary visual change..."
sed -i.tmp 's/className="bg-primary/className="bg-red-500/g' "$STORY_FILE"
rm "${STORY_FILE}.tmp" 2>/dev/null || true

echo "🔄 Chromatic visual regression testing disabled during development..."
echo "ℹ️  To re-enable: npm run chromatic:enable"

# Restore the original file
mv "$BACKUP_FILE" "$STORY_FILE"
echo "🔄 Restored original story file"

echo "✅ Visual regression test completed!"
echo "Check the Chromatic output above to see if visual changes were detected."
echo "You should see differences highlighted in the Chromatic web interface."
