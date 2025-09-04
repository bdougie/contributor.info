import { MessageSquare, Star } from '@/components/ui/icon';
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
          <dd className="text-sm text-muted-foreground">No triager found</dd>
          <dd className="text-xs text-muted-foreground mt-1">
            PR and issue activity will appear here when available
          </dd>
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
          <dd className="text-xs text-muted-foreground truncate">
            {triager.triages} triaged issues
          </dd>
        </div>
      </dl>
    </Card>
  );
}
