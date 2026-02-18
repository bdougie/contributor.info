import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, XCircle, GitCommit } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { PrAttentionData, PrAlertData } from '../types';

const urgencyColors: Record<string, string> = {
  critical: 'border-red-500/50 bg-red-500/5',
  high: 'border-orange-500/50 bg-orange-500/5',
  medium: 'border-yellow-500/50 bg-yellow-500/5',
  low: 'border-blue-500/50 bg-blue-500/5',
};

function getUrgencyIcon(urgency: PrAlertData['urgency']) {
  switch (urgency) {
    case 'critical':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'high':
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case 'medium':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'low':
      return <AlertCircle className="h-4 w-4 text-blue-500" />;
  }
}

interface PrAlertCardProps {
  data: PrAttentionData;
  owner: string;
  repo: string;
}

export function PrAlertCard({ data, owner, repo }: PrAlertCardProps) {
  if (!data.alerts || data.alerts.length === 0) {
    return (
      <Card className="p-3 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <p className="text-sm text-green-700 dark:text-green-300">
          All pull requests are being handled efficiently!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {data.alerts.map((alert) => (
        <Card
          key={alert.number}
          className={cn(
            'p-3 cursor-pointer hover:shadow-md transition-all',
            urgencyColors[alert.urgency]
          )}
          onClick={() => window.open(alert.url, '_blank')}
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {getUrgencyIcon(alert.urgency)}
              <span className="text-sm font-medium">#{alert.number}</span>
              <Badge variant="destructive" className="text-xs">
                Needs Response
              </Badge>
            </div>
            <h4 className="text-sm font-medium line-clamp-1">{alert.title}</h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>by {alert.author}</span>
              <span>{alert.daysSinceCreated}d ago</span>
              {alert.linesChanged > 0 && (
                <div className="flex items-center gap-1">
                  <GitCommit className="h-3 w-3" />
                  <span>{alert.linesChanged} lines</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {alert.reasons.map((reason, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {reason}
                </Badge>
              ))}
            </div>
          </div>
        </Card>
      ))}

      {data.metrics.totalAlerts > data.alerts.length && (
        <button
          className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors"
          onClick={() =>
            window.open(
              `https://github.com/${owner}/${repo}/pulls?q=is%3Apr+is%3Aopen+sort%3Acreated-asc`,
              '_blank'
            )
          }
        >
          View all {data.metrics.totalAlerts} PRs on GitHub
        </button>
      )}
    </div>
  );
}
