import { MessageSquare, Star, ExternalLink } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ActiveTriagerCardProps {
  triager: {
    username: string;
    avatar_url: string;
    triages: number;
  } | null;
  loading?: boolean;
}

export function ActiveTriagerCard({ triager, loading }: ActiveTriagerCardProps) {
  if (loading) {
    return (
      <Card className="p-3 min-w-0">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  if (!triager) {
    return (
      <Card className="p-3 min-w-0">
        <div className="flex items-center justify-between">
          <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-xs text-muted-foreground truncate">Top Triager</h3>
        </div>
        <div className="mt-2">
          <dd className="text-sm text-muted-foreground">Coming soon</dd>
          <a
            href="https://github.com/bdougie/contributor.info/issues/670"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-1"
          >
            <span>Add issue data</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 min-w-0">
      <div className="flex items-center justify-between">
        <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-xs text-muted-foreground truncate">Top Triager</h3>
      </div>
      <dl className="mt-2">
        <dt className="sr-only">Most Active Triager</dt>
        <dd className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={triager.avatar_url} alt={triager.username} />
            <AvatarFallback className="text-xs">
              {triager.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium truncate">{triager.username}</span>
        </dd>
        <div className="flex items-center gap-1 mt-1">
          <Star className="h-3 w-3 text-yellow-500" aria-hidden="true" />
          <dt className="sr-only">Triage Count</dt>
          <dd className="text-xs text-muted-foreground truncate">{triager.triages} triages</dd>
        </div>
      </dl>
    </Card>
  );
}
