import { lazy, Suspense } from 'react';
import { Loader2 } from '@/components/ui/icon';

const ApiKeysSection = lazy(() =>
  import('./api-keys-section').then((module) => ({ default: module.ApiKeysSection }))
);

function ApiKeysSectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-5 w-24 bg-muted rounded animate-pulse" />
          <div className="h-4 w-48 bg-muted rounded animate-pulse mt-1" />
        </div>
        <div className="h-8 w-24 bg-muted rounded animate-pulse" />
      </div>
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

export function LazyApiKeysSection() {
  return (
    <Suspense fallback={<ApiKeysSectionSkeleton />}>
      <ApiKeysSection />
    </Suspense>
  );
}
