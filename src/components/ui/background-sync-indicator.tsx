import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackgroundSyncIndicatorProps {
  isLoading: boolean;
  lastSyncTime?: Date;
  dataCount?: number;
  className?: string;
}

export function BackgroundSyncIndicator({
  isLoading,
  lastSyncTime,
  dataCount = 0,
  className,
}: BackgroundSyncIndicatorProps) {
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    // Show indicator for 5 seconds when loading starts or data updates
    if (isLoading || dataCount > 0) {
      setShowIndicator(true);
      const timer = setTimeout(() => setShowIndicator(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, dataCount]);

  if (!showIndicator && dataCount > 0) {
    return null; // Don't show indicator if we have data and timeout passed
  }

  const getStatusMessage = () => {
    if (isLoading) {
      return "Syncing latest data...";
    }
    if (dataCount === 0) {
      return "Checking for repository data...";
    }
    if (lastSyncTime) {
      const minutesAgo = Math.floor((Date.now() - lastSyncTime.getTime()) / 60000);
      if (minutesAgo < 1) return "Data is up to date";
      if (minutesAgo < 60) return `Updated ${minutesAgo} minutes ago`;
      return `Updated ${Math.floor(minutesAgo / 60)} hours ago`;
    }
    return "Data loaded";
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 text-xs rounded-full",
        "bg-muted/50 text-muted-foreground transition-all duration-300",
        isLoading && "bg-primary/10 text-primary",
        className
      )}
    >
      {isLoading ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : dataCount > 0 ? (
        <Cloud className="h-3 w-3" />
      ) : (
        <CloudOff className="h-3 w-3" />
      )}
      <span>{getStatusMessage()}</span>
    </div>
  );
}