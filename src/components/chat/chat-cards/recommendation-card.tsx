import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Target, Lightbulb, Zap } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { RecommendationsData } from '../types';

const typeIcons: Record<string, typeof Sparkles> = {
  process: Target,
  contributor: Lightbulb,
  performance: Zap,
  quality: Sparkles,
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

interface RecommendationCardProps {
  data: RecommendationsData;
  owner: string;
  repo: string;
}

export function RecommendationCard({ data }: RecommendationCardProps) {
  if (!data.recommendations || data.recommendations.length === 0) {
    return (
      <Card className="p-3 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <p className="text-sm text-green-700 dark:text-green-300">
          No critical recommendations — this repo is in great shape!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {data.recommendations.map((rec, i) => {
        const Icon = typeIcons[rec.type] || Sparkles;
        return (
          <Card key={i} className="p-3 hover:shadow-sm transition-shadow">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-medium">{rec.title}</h4>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', priorityColors[rec.priority])}
                    >
                      {rec.priority.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{rec.description}</p>
                  <p className="text-xs text-muted-foreground font-medium">Impact: {rec.impact}</p>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
