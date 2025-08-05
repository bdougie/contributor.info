import { cn } from "@/lib/utils";
import { useTimeFormatter } from "@/hooks/use-time-formatter";
import { Clock } from "lucide-react";

interface LastUpdatedProps {
  /**
   * ISO 8601 timestamp string indicating when the content was last updated
   */
  timestamp: string | Date;
  /**
   * Optional label to display before the timestamp (defaults to "Last updated")
   */
  label?: string;
  /**
   * Additional CSS classes to apply to the container
   */
  className?: string;
  /**
   * Whether to show the clock icon (defaults to true)
   */
  showIcon?: boolean;
  /**
   * Size variant for the component
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Whether to include structured data for SEO (defaults to true)
   */
  includeStructuredData?: boolean;
}

/**
 * LastUpdated component displays when content was last updated with both
 * human-readable relative time and machine-readable ISO 8601 timestamps.
 * Includes structured data for SEO and accessibility features.
 */
export function LastUpdated({ 
  timestamp, 
  label = "Last updated",
  className,
  showIcon = true,
  size = 'sm',
  includeStructuredData = true
}: LastUpdatedProps) {
  const { formatRelativeTime, formatDate } = useTimeFormatter();
  
  // Convert timestamp to Date object if it's a string
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  // Validate the date
  if (isNaN(date.getTime())) {
    console.warn('LastUpdated: Invalid timestamp provided:', timestamp);
    return null;
  }
  
  const isoString = date.toISOString();
  const relativeTime = formatRelativeTime(date);
  const absoluteTime = formatDate(date, { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  
  // Size-based styles
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm', 
    lg: 'text-base'
  };
  
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <>
      <div 
        className={cn(
          "flex items-center gap-1.5 text-muted-foreground",
          sizeClasses[size],
          className
        )}
        role="status"
        aria-label={`${label} ${relativeTime}`}
      >
        {showIcon && (
          <Clock 
            className={cn("flex-shrink-0", iconSizes[size])} 
            aria-hidden="true" 
          />
        )}
        <span className="whitespace-nowrap">
          {label}:{" "}
          <time 
            dateTime={isoString}
            title={absoluteTime}
            className="font-medium"
          >
            {relativeTime}
          </time>
        </span>
      </div>
      
      {includeStructuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              "dateModified": isoString
            })
          }}
        />
      )}
    </>
  );
}

/**
 * Lightweight version of LastUpdated that only shows the time without label or icon
 */
export function LastUpdatedTime({ 
  timestamp, 
  className,
  size = 'sm'
}: Pick<LastUpdatedProps, 'timestamp' | 'className' | 'size'>) {
  return (
    <LastUpdated
      timestamp={timestamp}
      label=""
      showIcon={false}
      includeStructuredData={false}
      className={className}
      size={size}
    />
  );
}