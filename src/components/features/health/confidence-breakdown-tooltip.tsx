import { Star, MessageSquare, RotateCcw, CheckCircle } from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';

interface ConfidenceBreakdownTooltipProps {
  children: React.ReactNode;
  breakdown?: {
    starForkConfidence: number;
    engagementConfidence: number;
    retentionConfidence: number;
    qualityConfidence: number;
    totalStargazers?: number;
    totalForkers?: number;
    contributorCount?: number;
    conversionRate?: number;
  };
}

export function ConfidenceBreakdownTooltip({
  children,
  breakdown,
}: ConfidenceBreakdownTooltipProps) {
  if (!breakdown) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            <div className="p-1">
              <p className="text-sm font-medium mb-2">Contributor Confidence</p>
              <p className="text-xs text-muted-foreground">
                Measures how likely stargazers and forkers are to return and make meaningful
                contributions to your repository.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const {
    starForkConfidence,
    engagementConfidence,
    retentionConfidence,
    qualityConfidence,
    totalStargazers = 0,
    totalForkers = 0,
    contributorCount = 0,
    conversionRate = 0,
  } = breakdown;

  const factors = [
    {
      name: 'Star/Fork Conversion',
      value: starForkConfidence,
      weight: 35,
      icon: Star,
      description: '% of stargazers/forkers who became contributors',
      detail: `${contributorCount} contributors from ${totalStargazers + totalForkers} total engagement`,
    },
    {
      name: 'Comment Engagement',
      value: engagementConfidence,
      weight: 25,
      icon: MessageSquare,
      description: '% of commenters who made contributions',
      detail: 'Tracks issue/PR comment to contribution conversion',
    },
    {
      name: 'Contributor Retention',
      value: retentionConfidence,
      weight: 25,
      icon: RotateCcw,
      description: '% of contributors who return over time',
      detail: 'Measures repeat contribution patterns',
    },
    {
      name: 'Contribution Quality',
      value: qualityConfidence,
      weight: 15,
      icon: CheckCircle,
      description: '% of contributions that are merged',
      detail: 'Tracks PR acceptance and merge rates',
    },
  ];

  const getColorForValue = (value: number) => {
    if (value <= 30) return 'text-red-600';
    if (value <= 50) return 'text-orange-600';
    if (value <= 70) return 'text-blue-600';
    return 'text-green-600';
  };

  const getProgressColorForValue = (value: number) => {
    if (value <= 30) return 'bg-red-500';
    if (value <= 50) return 'bg-orange-500';
    if (value <= 70) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-md">
          <div className="p-3">
            <p className="text-sm font-medium mb-3">Confidence Breakdown</p>

            <div className="space-y-3">
              {factors.map((factor) => {
                const Icon = factor.icon;
                return (
                  <div key={factor.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3 w-3" />
                        <span className="text-xs font-medium">{factor.name}</span>
                        <span className="text-xs text-muted-foreground">({factor.weight}%)</span>
                      </div>
                      <span className={`text-xs font-medium ${getColorForValue(factor.value)}`}>
                        {Math.round(factor.value)}%
                      </span>
                    </div>

                    <div className="relative">
                      <Progress value={factor.value} className="h-1.5" />
                      <div
                        className={`absolute top-0 left-0 h-1.5 rounded-full transition-all ${getProgressColorForValue(factor.value)}`}
                        style={{ width: `${Math.min(factor.value, 100)}%` }}
                      />
                    </div>

                    <p className="text-xs text-muted-foreground">{factor.description}</p>
                    {factor.detail && (
                      <p className="text-xs text-muted-foreground italic">{factor.detail}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Overall conversion rate:{' '}
                <span className={`font-medium ${getColorForValue(conversionRate)}`}>
                  {conversionRate.toFixed(1)}%
                </span>
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
