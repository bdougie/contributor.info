import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { HealthAssessmentData } from '../types';

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'good':
      return (
        <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
          Good
        </Badge>
      );
    case 'warning':
      return (
        <Badge
          variant="outline"
          className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200"
        >
          Warning
        </Badge>
      );
    case 'critical':
      return (
        <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-200">
          Critical
        </Badge>
      );
    default:
      return null;
  }
}

interface HealthCardProps {
  data: HealthAssessmentData;
}

export function HealthCard({ data }: HealthCardProps) {
  return (
    <Card className="p-4 border-pink-200 dark:border-pink-800 bg-pink-50/30 dark:bg-pink-950/20">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            <h4 className="text-sm font-semibold">Health Assessment</h4>
          </div>
          <span className={cn('text-2xl font-bold', getScoreColor(data.score))}>{data.score}</span>
        </div>

        {data.factors.length > 0 && (
          <div className="space-y-2">
            {data.factors.map((factor, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{factor.name}</span>
                  {getStatusBadge(factor.status)}
                </div>
                <span className={cn('font-medium', getScoreColor(factor.score))}>
                  {factor.score}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.recommendations.length > 0 && (
          <div className="border-t pt-2 space-y-1">
            {data.recommendations.map((rec, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {rec}
              </p>
            ))}
          </div>
        )}

        {data.assessedAt && (
          <p className="text-xs text-muted-foreground/70">
            Assessed {new Date(data.assessedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </Card>
  );
}
