import { AlertCircle, CheckCircle2, Clock, Database, RefreshCw, Loader2 } from '@/components/ui/icon';
import { cn } from "@/lib/utils";
import { Button } from "./button";
import type { DataResult } from "@/lib/errors/repository-errors";

interface DataStateIndicatorProps {
  status: DataResult<any>['status'];
  message?: string;
  metadata?: {
    isStale?: boolean;
    lastUpdate?: string;
    dataCompleteness?: number;
  };
  onRefresh?: () => void;
  className?: string;
  compact?: boolean;
}

export function DataStateIndicator({
  status,
  message,
  metadata,
  onRefresh,
  className,
  compact = false
}: DataStateIndicatorProps) {
  // Format last update time
  const formatLastUpdate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Updated just now";
    if (diffHours < 24) return `Updated ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `Updated ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const renderIndicator = () => {
    switch (status) {
      case 'success':
        if (metadata?.isStale) {
          return {
            icon: <Clock className="h-4 w-4" />,
            color: 'text-yellow-600 dark:text-yellow-500',
            bgColor: 'bg-yellow-50 dark:bg-yellow-950',
            borderColor: 'border-yellow-200 dark:border-yellow-800',
            title: 'Data Available',
            description: message || formatLastUpdate(metadata?.lastUpdate) || 'Data from cache • Fresh data loading...'
          };
        }
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          color: 'text-green-600 dark:text-green-500',
          bgColor: 'bg-green-50 dark:bg-green-950',
          borderColor: 'border-green-200 dark:border-green-800',
          title: 'Data Current',
          description: formatLastUpdate(metadata?.lastUpdate) || 'All data up to date'
        };

      case 'pending':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          color: 'text-blue-600 dark:text-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-950',
          borderColor: 'border-blue-200 dark:border-blue-800',
          title: 'Getting familiar with repository...',
          description: message || 'We\'re fetching the latest data. Check back in a minute!'
        };

      case 'no_data':
        return {
          icon: <Database className="h-4 w-4" />,
          color: 'text-gray-600 dark:text-gray-500',
          bgColor: 'bg-gray-50 dark:bg-gray-950',
          borderColor: 'border-gray-200 dark:border-gray-800',
          title: 'No Data Available',
          description: message || 'No pull requests found for the selected time range'
        };

      case 'large_repository_protected':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          color: 'text-purple-600 dark:text-purple-500',
          bgColor: 'bg-purple-50 dark:bg-purple-950',
          borderColor: 'border-purple-200 dark:border-purple-800',
          title: 'Large Repository',
          description: message || 'Using optimized loading for this large repository'
        };

      case 'partial_data':
        return {
          icon: <RefreshCw className="h-4 w-4" />,
          color: 'text-orange-600 dark:text-orange-500',
          bgColor: 'bg-orange-50 dark:bg-orange-950',
          borderColor: 'border-orange-200 dark:border-orange-800',
          title: 'Partial Data',
          description: message || 'Some data is still being processed'
        };

      default:
        return null;
    }
  };

  const indicator = renderIndicator();
  if (!indicator) return null;

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 text-sm",
          indicator.color,
          className
        )}
      >
        {indicator.icon}
        <span>{indicator.title}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        indicator.bgColor,
        indicator.borderColor,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className={cn("mt-0.5", indicator.color)}>
            {indicator.icon}
          </div>
          <div className="flex-1">
            <h4 className={cn("text-sm font-medium", indicator.color)}>
              {indicator.title}
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {indicator.description}
            </p>
            {metadata?.dataCompleteness !== undefined && metadata.dataCompleteness < 100 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Data completeness</span>
                  <span>{metadata.dataCompleteness}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5">
                  <div 
                    className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${metadata.dataCompleteness}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        {onRefresh && status !== 'pending' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="ml-4"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        )}
      </div>
      {status === 'partial_data' && metadata?.dataCompleteness !== undefined && metadata.dataCompleteness < 75 && (
        <div className="mt-3 pt-3 border-t border-current/10">
          <p className="text-xs text-muted-foreground">
            Want more complete data? The system is gathering additional information in the background.
          </p>
        </div>
      )}
    </div>
  );
}