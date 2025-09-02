import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function WorkspaceActivitySkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity Table Skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Table Header */}
          <div className="border-b pb-2 mb-4">
            <div className="grid grid-cols-12 gap-4">
              <Skeleton className="h-4 w-16 col-span-1" />
              <Skeleton className="h-4 w-20 col-span-2" />
              <Skeleton className="h-4 w-32 col-span-4" />
              <Skeleton className="h-4 w-24 col-span-2" />
              <Skeleton className="h-4 w-20 col-span-2" />
              <Skeleton className="h-4 w-16 col-span-1" />
            </div>
          </div>

          {/* Table Rows */}
          {[...Array(10)].map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-4 py-3 border-b last:border-0">
              <Skeleton className="h-4 w-12 col-span-1" />
              <div className="col-span-2 flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-full col-span-4" />
              <Skeleton className="h-4 w-20 col-span-2" />
              <Skeleton className="h-5 w-16 col-span-2 rounded-full" />
              <Skeleton className="h-4 w-12 col-span-1" />
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-8" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function WorkspaceActivityTableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 py-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
