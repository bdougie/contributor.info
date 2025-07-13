import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Database, CheckCircle, Zap, GitBranch, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataProcessingIndicatorProps {
  repository: string;
  className?: string;
}

export function DataProcessingIndicator({ repository, className }: DataProcessingIndicatorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [recentlyCompleted, setRecentlyCompleted] = useState(false);
  const [processor, setProcessor] = useState<'inngest' | 'github_actions' | 'hybrid' | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let completionTimeout: NodeJS.Timeout;
    
    // Listen for progressive data updates
    const handleProgressiveUpdate = (event: CustomEvent) => {
      const { repository: eventRepo, dataType, processor: eventProcessor } = event.detail;
      
      if (eventRepo === repository) {
        setIsProcessing(false);
        setRecentlyCompleted(true);
        setProcessor(eventProcessor);
        setProcessingStage(`Updated ${dataType} data`);
        setEstimatedTime(null);
        setProgress(100);
        setCurrentStep('Completed');
        setHasError(false);
        setErrorMessage('');
        
        // Clear any existing timeout
        if (completionTimeout) {
          clearTimeout(completionTimeout);
        }
        
        // Hide the completed state after 5 seconds
        completionTimeout = setTimeout(() => {
          setRecentlyCompleted(false);
          setProcessingStage('');
          setProcessor(null);
          setProgress(0);
          setCurrentStep('');
        }, 5000);
      }
    };

    // Listen for processing start events
    const handleProcessingStart = (event: CustomEvent) => {
      const { repository: eventRepo, processor: eventProcessor, estimatedTime: eventEstimatedTime } = event.detail;
      
      if (eventRepo === repository) {
        setIsProcessing(true);
        setProcessor(eventProcessor);
        setEstimatedTime(eventEstimatedTime);
        setProcessingStage(
          eventProcessor === 'inngest' ? 'Real-time processing...' :
          eventProcessor === 'github_actions' ? 'Bulk processing...' :
          'Hybrid processing...'
        );
        setRecentlyCompleted(false);
        setProgress(10); // Start with small progress
        setCurrentStep('Initializing...');
        setHasError(false);
        setErrorMessage('');
      }
    };

    // Listen for progress updates
    const handleProgressUpdate = (event: CustomEvent) => {
      const { repository: eventRepo, progress: eventProgress, step, error } = event.detail;
      
      if (eventRepo === repository) {
        if (error) {
          setHasError(true);
          setErrorMessage(error);
          setProgress(0);
          setCurrentStep('Error occurred');
        } else {
          setProgress(eventProgress || 0);
          setCurrentStep(step || '');
          setHasError(false);
          setErrorMessage('');
        }
      }
    };

    window.addEventListener('progressive-data-updated', handleProgressiveUpdate as EventListener);
    window.addEventListener('progressive-processing-started', handleProcessingStart as EventListener);
    window.addEventListener('progressive-processing-progress', handleProgressUpdate as EventListener);

    return () => {
      window.removeEventListener('progressive-data-updated', handleProgressiveUpdate as EventListener);
      window.removeEventListener('progressive-processing-started', handleProcessingStart as EventListener);
      window.removeEventListener('progressive-processing-progress', handleProgressUpdate as EventListener);
      
      // Clean up timeout on unmount
      if (completionTimeout) {
        clearTimeout(completionTimeout);
      }
    };
  }, [repository]);

  // Don't show anything if no processing activity
  if (!isProcessing && !recentlyCompleted) {
    return null;
  }

  // Get processor-specific colors and icons
  const getProcessorInfo = () => {
    switch (processor) {
      case 'inngest':
        return {
          color: 'blue',
          icon: Zap,
          label: 'Real-time',
          bgClass: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
          iconClass: 'text-blue-600 dark:text-blue-400'
        };
      case 'github_actions':
        return {
          color: 'purple',
          icon: GitBranch,
          label: 'Bulk',
          bgClass: 'border-l-purple-500 bg-purple-50 dark:bg-purple-950/20',
          iconClass: 'text-purple-600 dark:text-purple-400'
        };
      case 'hybrid':
        return {
          color: 'indigo',
          icon: Database,
          label: 'Hybrid',
          bgClass: 'border-l-indigo-500 bg-indigo-50 dark:bg-indigo-950/20',
          iconClass: 'text-indigo-600 dark:text-indigo-400'
        };
      default:
        return {
          color: 'gray',
          icon: Database,
          label: 'Processing',
          bgClass: 'border-l-gray-500 bg-gray-50 dark:bg-gray-950/20',
          iconClass: 'text-gray-600 dark:text-gray-400'
        };
    }
  };

  const processorInfo = getProcessorInfo();
  const ProcessorIcon = processorInfo.icon;

  return (
    <Card className={cn(
      "transition-all duration-300 ease-in-out border-l-4",
      isProcessing && processorInfo.bgClass,
      recentlyCompleted && "border-l-green-500 bg-green-50 dark:bg-green-950/20",
      className
    )}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          {isProcessing && (
            <div className="flex items-center gap-2">
              {hasError ? (
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              )}
              <ProcessorIcon className={cn("h-3 w-3", processorInfo.iconClass)} />
            </div>
          )}
          {recentlyCompleted && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              {processor && <ProcessorIcon className={cn("h-3 w-3", processorInfo.iconClass)} />}
            </div>
          )}
          {!isProcessing && !recentlyCompleted && (
            <Database className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">
                {isProcessing && (hasError ? 'Processing Error' : 'Updating Data')}
                {recentlyCompleted && 'Data Updated'}
              </div>
              {processor && (
                <Badge variant="secondary" className="text-xs">
                  {processorInfo.label}
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              {(processingStage || currentStep) && (
                <div className="text-xs text-muted-foreground">
                  {hasError ? errorMessage : (currentStep || processingStage)}
                </div>
              )}
              {isProcessing && progress > 0 && !hasError && (
                <div className="w-full">
                  <Progress value={progress} className="h-1.5" />
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-muted-foreground">
                      {progress}%
                    </span>
                    {estimatedTime && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>~{estimatedTime}s</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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