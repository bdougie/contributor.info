#!/bin/bash

echo "Fixing remaining unused variables..."

# Fix specific unused variables
sed -i '' 's/_error_unused/_/g' src/components/PostHogHealthMonitor.tsx
sed -i '' 's/_status_unused/_/g' src/components/__tests__/ManualBackfill.test.tsx  
sed -i '' 's/_meta_unused/_/g' src/components/common/layout/meta-tags-provider.tsx

# Fix citation generator
sed -i '' 's/} catch (_error) {/} catch (_) {/g' src/components/embeddable-widgets/citation-generator.tsx

# Fix error boundaries
sed -i '' 's/} catch (_error) {/} catch (_) {/g' src/components/error-boundaries/data-loading-error-boundary.tsx
sed -i '' 's/} catch (_error) {/} catch (_) {/g' src/components/error-boundary.tsx

# Fix widget gallery
sed -i '' 's/} catch (_error) {/} catch (_) {/g' src/components/embeddable-widgets/widget-gallery.tsx

echo "Fixed remaining unused variables"