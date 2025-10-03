import { FileText, RotateCcw, ExternalLink } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface RepeatReportersCardProps {
  reporters: {
    username: string;
    avatar_url: string;
    issues: number;
  }[];
  loading?: boolean;
}

export function RepeatReportersCard({ reporters, loading }: RepeatReportersCardProps) {
  if (loading) {
    return (
      <Card className="p-3 min-w-0">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  const topReporter = reporters[0];

  if (!topReporter) {
    return (
      <Card className="p-3 min-w-0">
        <div className="flex items-center justify-between">
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-xs text-muted-foreground truncate">Repeat Reporters</h3>
        </div>
        <div className="mt-2">
          <p className="text-sm text-muted-foreground">Limited data</p>
          <a
            href="https://github.com/bdougie/contributor.info/issues/670"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-1"
          >
            <span>Enhance metrics</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 min-w-0">
      <div className="flex items-center justify-between">
        <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-xs text-muted-foreground truncate">Repeat Reporters</h3>
      </div>
      <dl className="mt-2">
        <dt className="sr-only">Top Issue Reporter</dt>
        <dd className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={topReporter.avatar_url} alt={topReporter.username} />
            <AvatarFallback className="text-xs">
              {topReporter.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium truncate">{topReporter.username}</span>
        </dd>
        <div className="flex items-center gap-1 mt-1">
          <RotateCcw className="h-3 w-3 text-purple-500" aria-hidden="true" />
          <dt className="sr-only">Issue Count</dt>
          <dd className="text-xs text-muted-foreground truncate">{topReporter.issues} issues</dd>
        </div>
        {reporters.length > 1 && (
          <div className="flex items-center gap-1 mt-1">
            <Badge variant="secondary" className="text-xs">
              +{reporters.length - 1} more
            </Badge>
          </div>
        )}
      </dl>
    </Card>
  );
}
