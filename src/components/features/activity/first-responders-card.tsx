import { MessageCircle, Users } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ContributorHoverCard } from '@/components/features/contributor/contributor-hover-card';

interface FirstRespondersCardProps {
  responders: {
    username: string;
    avatar_url: string;
    responses: number;
  }[];
  loading?: boolean;
}

export function FirstRespondersCard({ responders, loading }: FirstRespondersCardProps) {
  if (loading) {
    return (
      <Card className="p-3 min-w-0">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  const topResponder = responders[0];

  if (!topResponder) {
    return (
      <Card className="p-3 min-w-0">
        <div className="flex items-center justify-between">
          <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-xs text-muted-foreground truncate">First Responders</h3>
        </div>
        <div className="mt-2">
          <p className="text-sm text-muted-foreground">No first responders found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Issue responses will appear here when available
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 min-w-0">
      <div className="flex items-center justify-between">
        <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-xs text-muted-foreground truncate">First Responders</h3>
      </div>
      <dl className="mt-2">
        <dt className="sr-only">Top First Responder</dt>
        <dd className="flex items-center gap-2">
          <ContributorHoverCard
            contributor={{
              login: topResponder.username,
              avatar_url: topResponder.avatar_url,
              pullRequests: 0,
              percentage: 0,
              recentPRs: [],
            }}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={topResponder.avatar_url} alt={topResponder.username} />
              <AvatarFallback className="text-xs">
                {topResponder.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </ContributorHoverCard>
          <span className="text-sm font-medium truncate">{topResponder.username}</span>
        </dd>
        <div className="flex items-center gap-1 mt-1">
          <Users className="h-3 w-3 text-blue-500" aria-hidden="true" />
          <dt className="sr-only">Response Count</dt>
          <dd className="text-xs text-muted-foreground truncate">
            {topResponder.responses} issue {topResponder.responses === 1 ? 'comment' : 'comments'}
          </dd>
        </div>
        {responders.length > 1 && (
          <div className="flex items-center gap-1 mt-1">
            <Badge variant="secondary" className="text-xs">
              +{responders.length - 1} more
            </Badge>
          </div>
        )}
      </dl>
    </Card>
  );
}
