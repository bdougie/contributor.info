import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function HomeSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-5/6 mx-auto mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search input skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Example repos skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
