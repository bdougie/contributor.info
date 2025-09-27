import { lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load the heavy org-view component
const OrgViewInner = lazy(() =>
  import('./org-view').then((module) => ({
    default: module.default,
  }))
);

function OrgViewSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Breadcrumbs skeleton */}
      <div className="flex items-center gap-2 text-sm">
        <Skeleton className="h-4 w-12" />
        <span>/</span>
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Org header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-md" />
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Table skeleton */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LazyOrgView() {
  return (
    <Suspense fallback={<OrgViewSkeleton />}>
      <OrgViewInner />
    </Suspense>
  );
}
