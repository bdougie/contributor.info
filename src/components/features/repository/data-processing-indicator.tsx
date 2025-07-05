import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Database, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataProcessingIndicatorProps {
  repository: string;
  className?: string;
}

export function DataProcessingIndicator({ repository, className }: DataProcessingIndicatorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [recentlyCompleted, setRecentlyCompleted] = useState(false);

  useEffect(() => {
    // Listen for progressive data updates
    const handleProgressiveUpdate = (event: CustomEvent) => {
      const { repository: eventRepo, dataType } = event.detail;
      
      if (eventRepo === repository) {
        setIsProcessing(false);
        setRecentlyCompleted(true);
        setProcessingStage(`Updated ${dataType} data`);
        
        // Hide the completed state after 5 seconds
        setTimeout(() => {
          setRecentlyCompleted(false);
          setProcessingStage('');
        }, 5000);
      }
    };

    // Listen for processing start events
    const handleProcessingStart = (event: CustomEvent) => {
      const { repository: eventRepo } = event.detail;
      
      if (eventRepo === repository) {
        setIsProcessing(true);
        setProcessingStage('Updating repository data...');
        setRecentlyCompleted(false);
      }
    };

    window.addEventListener('progressive-data-updated', handleProgressiveUpdate as EventListener);
    window.addEventListener('progressive-processing-started', handleProcessingStart as EventListener);

    return () => {
      window.removeEventListener('progressive-data-updated', handleProgressiveUpdate as EventListener);
      window.removeEventListener('progressive-processing-started', handleProcessingStart as EventListener);
    };
  }, [repository]);

  // Don't show anything if no processing activity
  if (!isProcessing && !recentlyCompleted) {
    return null;
  }

  return (
    <Card className={cn(
      "transition-all duration-300 ease-in-out border-l-4",
      isProcessing && "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20",
      recentlyCompleted && "border-l-green-500 bg-green-50 dark:bg-green-950/20",
      className
    )}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          {isProcessing && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
          )}
          {recentlyCompleted && (
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          )}
          {!isProcessing && !recentlyCompleted && (
            <Database className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          )}
          
          <div className="flex-1">
            <div className="text-sm font-medium">
              {isProcessing && 'Updating Data'}
              {recentlyCompleted && 'Data Updated'}
            </div>
            {processingStage && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {processingStage}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Hook to manage data processing state
 */
export function useDataProcessingState(repository: string) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const handleProgressiveUpdate = (event: CustomEvent) => {
      const { repository: eventRepo } = event.detail;
      
      if (eventRepo === repository) {
        setIsProcessing(false);
        setLastUpdated(new Date());
      }
    };

    const handleProcessingStart = (event: CustomEvent) => {
      const { repository: eventRepo } = event.detail;
      
      if (eventRepo === repository) {
        setIsProcessing(true);
      }
    };

    window.addEventListener('progressive-data-updated', handleProgressiveUpdate as EventListener);
    window.addEventListener('progressive-processing-started', handleProcessingStart as EventListener);

    return () => {
      window.removeEventListener('progressive-data-updated', handleProgressiveUpdate as EventListener);
      window.removeEventListener('progressive-processing-started', handleProcessingStart as EventListener);
    };
  }, [repository]);

  return { isProcessing, lastUpdated };
}