import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimeFormatter } from "@/hooks/use-time-formatter";

interface DataFreshnessIndicatorProps {
  freshness: 'fresh' | 'stale' | 'old';
  lastUpdate?: string;
  className?: string;
  showLabel?: boolean;
}

const freshnessConfig = {
  fresh: {
    color: "text-green-500",
    bgColor: "bg-green-500",
    label: "Fresh",
    tooltip: "Data updated within the last 24 hours"
  },
  stale: {
    color: "text-yellow-500", 
    bgColor: "bg-yellow-500",
    label: "Stale",
    tooltip: "Data is 1-7 days old"
  },
  old: {
    color: "text-red-500",
    bgColor: "bg-red-500", 
    label: "Old",
    tooltip: "Data is more than 7 days old"
  }
} as const;

export function DataFreshnessIndicator({ 
  freshness, 
  lastUpdate, 
  className,
  showLabel = false 
}: DataFreshnessIndicatorProps) {
  const { formatRelativeTime } = useTimeFormatter();
  const config = freshnessConfig[freshness];
  
  const tooltipText = lastUpdate 
    ? `${config.tooltip} - Last updated ${formatRelativeTime(lastUpdate)}`
    : config.tooltip;

  return (
    <div 
      className={cn("flex items-center justify-center gap-1.5", className)}
      title={tooltipText}
    >
      <Circle 
        className={cn("w-2.5 h-2.5 fill-current", config.color)} 
      />
      {showLabel && (
        <span className={cn("text-xs font-medium", config.color)}>
          {config.label}
        </span>
      )}
    </div>
  );
}