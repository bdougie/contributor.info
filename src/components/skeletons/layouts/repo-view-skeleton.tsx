import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RepoViewSkeletonProps {
  className?: string;
}

export function RepoViewSkeleton({ className }: RepoViewSkeletonProps) {
  return (
    <div className={cn("container mx-auto py-8", className)}>
      {/* Search Bar Section */}
      <Card className="mb-8 animate-pulse">
        <CardContent className="pt-6">
          <div className="flex gap-4 mb-4">
            <Skeleton className="flex-1 h-10" />
            <Skeleton className="w-24 h-10" />
          </div>
          {/* Example repos skeleton */}
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-24" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Section */}
      <div className="grid gap-8">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                {/* Repository name */}
                <Skeleton className="h-8 w-64" />
                {/* Description */}
                <Skeleton className="h-4 w-80" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Tabs skeleton */}
            <div className="space-y-4">
              <div className="flex space-x-1 bg-muted p-1 rounded-md w-fit">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>

            {/* Content area placeholder */}
            <div className="mt-6">
              <ContentAreaSkeleton />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Default content area skeleton - can be overridden by specific page skeletons
function ContentAreaSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Main content card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>

      {/* Secondary content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}