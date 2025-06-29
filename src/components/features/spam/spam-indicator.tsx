import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Shield, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpamIndicatorProps {
  spamScore: number | null;
  isSpam?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
  className?: string;
}

export function SpamIndicator({
  spamScore,
  isSpam = false,
  size = 'sm',
  showScore = false,
  className,
}: SpamIndicatorProps) {
  // If no spam score, don't show anything
  if (spamScore === null || spamScore === undefined) {
    return null;
  }

  // Determine severity level
  const getLevel = () => {
    if (spamScore <= 25) return 'legitimate';
    if (spamScore <= 50) return 'warning';
    if (spamScore <= 75) return 'likely';
    return 'definite';
  };

  const level = getLevel();

  // Get styling based on level
  const getStyles = () => {
    switch (level) {
      case 'legitimate':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          label: 'Legitimate',
        };
      case 'warning':
        return {
          icon: Shield,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          label: 'Low Quality',
        };
      case 'likely':
        return {
          icon: AlertTriangle,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          label: 'Likely Spam',
        };
      case 'definite':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          label: 'Spam',
        };
      default:
        return {
          icon: Shield,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          label: 'Unknown',
        };
    }
  };

  const styles = getStyles();
  const Icon = styles.icon;

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const badgeSizes = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-2.5 py-1',
  };

  // Don't show indicator for legitimate PRs unless explicitly marked as spam
  if (level === 'legitimate' && !isSpam && !showScore) {
    return null;
  }

  const content = (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-normal',
        styles.bgColor,
        styles.borderColor,
        styles.color,
        badgeSizes[size],
        className
      )}
    >
      <Icon className={cn(sizeClasses[size])} />
      {showScore ? (
        <span>Score: {spamScore}</span>
      ) : (
        <span>{styles.label}</span>
      )}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Spam Detection Score: {spamScore}/100</p>
            <p className="text-xs text-muted-foreground">
              {level === 'legitimate' && 'This PR appears to be legitimate'}
              {level === 'warning' && 'This PR may be low quality'}
              {level === 'likely' && 'This PR is likely spam'}
              {level === 'definite' && 'This PR has been identified as spam'}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact version for use in lists
export function SpamBadge({ 
  spamScore, 
  showScore = false,
  className 
}: { 
  spamScore: number | null; 
  showScore?: boolean;
  className?: string;
}) {
  if (spamScore === null || spamScore <= 25) return null;

  const getVariant = () => {
    if (spamScore <= 50) return 'secondary';
    if (spamScore <= 75) return 'destructive';
    return 'destructive';
  };

  const getContent = () => {
    if (showScore) {
      return `${spamScore}%`;
    }
    
    if (spamScore <= 50) return '⚠️';
    if (spamScore <= 75) return '⚠️ Spam';
    return '🚫 Spam';
  };

  return (
    <Badge variant={getVariant()} className={cn('text-xs', className)}>
      {getContent()}
    </Badge>
  );
}

// Version that always shows the probability score
export function SpamProbabilityBadge({ 
  spamScore, 
  className 
}: { 
  spamScore: number | null; 
  className?: string;
}) {
  if (spamScore === null) return null;

  const getVariant = () => {
    if (spamScore <= 25) return 'outline';
    if (spamScore <= 50) return 'secondary';
    if (spamScore <= 75) return 'destructive';
    return 'destructive';
  };

  const getIcon = () => {
    if (spamScore <= 25) return '✅';
    if (spamScore <= 50) return '⚠️';
    if (spamScore <= 75) return '🟠';
    return '🚫';
  };

  return (
    <Badge variant={getVariant()} className={cn('text-xs gap-1', className)}>
      <span>{getIcon()}</span>
      <span>{spamScore}%</span>
    </Badge>
  );
}