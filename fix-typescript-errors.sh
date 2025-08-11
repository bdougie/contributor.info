#!/bin/bash

echo "Fixing TypeScript errors from .maybeSingle() migration..."

# Fix src/lib/inngest/functions/capture-pr-comments.ts
sed -i '' '152s/commenterId = newContributor.id;/if (!newContributor) { console.warn("Failed to create commenter"); continue; } commenterId = newContributor.id;/' src/lib/inngest/functions/capture-pr-comments.ts
sed -i '' '202s/commenterId = newContributor.id;/if (!newContributor) { console.warn("Failed to create commenter"); continue; } commenterId = newContributor.id;/' src/lib/inngest/functions/capture-pr-comments.ts

# Fix src/lib/inngest/functions/capture-pr-details-graphql.ts
sed -i '' '149s/return data.id;/if (!data) { throw new Error("Failed to ensure contributor exists"); } return data.id;/' src/lib/inngest/functions/capture-pr-details-graphql.ts

# Fix src/lib/inngest/functions/capture-pr-reviews.ts
sed -i '' '122s/reviewerId = newContributor.id;/if (!newContributor) { console.warn("Failed to create reviewer"); continue; } reviewerId = newContributor.id;/' src/lib/inngest/functions/capture-pr-reviews.ts

# Fix src/lib/inngest/functions/capture-repository-sync-enhanced.ts
sed -i '' '36s/return data.id;/if (!data) { throw new Error("Failed to ensure contributor exists"); } return data.id;/' src/lib/inngest/functions/capture-repository-sync-enhanced.ts

# Fix src/lib/inngest/functions/capture-repository-sync-graphql.ts
sed -i '' '61s/return data.id;/if (!data) { return null; } return data.id;/' src/lib/inngest/functions/capture-repository-sync-graphql.ts

# Fix src/lib/inngest/functions/capture-repository-sync.ts
sed -i '' '51s/return data.id;/if (!data) { return null; } return data.id;/' src/lib/inngest/functions/capture-repository-sync.ts

# Fix src/lib/inngest/sync-logger.ts
sed -i '' '30,32s/console.log.*$/if (!data) { throw new Error("Failed to create sync log"); } console.log(`[SyncLogger] Created sync log with ID: ${data.id}`); this.syncLogId = data.id; return data.id;/' src/lib/inngest/sync-logger.ts

echo "Fixes applied. Running build to verify..."
npm run build