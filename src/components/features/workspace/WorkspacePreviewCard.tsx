import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  GitCommit, 
  ExternalLink,
  Users,
  Calendar,
  Activity
} from "@/components/ui/icon";
import { cn } from "@/lib/utils";

// Utility function to format last activity date
function formatLastActivity(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  // Guard against future timestamps
  if (diffMs < 0) {
    return "just now";
  }
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}w ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months}mo ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years}y ago`;
  }
}

export interface WorkspacePreviewRepository {
  id: string;
  full_name: string;
  name: string;
  owner: string;
  description?: string;
  language?: string;
  activity_score: number; // Recent activity indicator (commits, PRs, issues in last 30 days)
  last_activity: string; // ISO date string of last activity
  avatar_url?: string;
  html_url: string;
}

export interface WorkspacePreviewData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  owner: {
    id: string;
    avatar_url?: string;
    display_name?: string;
  };
  repository_count: number;
  member_count: number;
  repositories: WorkspacePreviewRepository[];
  created_at: string;
}

export interface WorkspacePreviewCardProps {
  workspace: WorkspacePreviewData;
  loading?: boolean;
  className?: string;
}

export function WorkspacePreviewCard({ 
  workspace, 
  loading = false,
  className 
}: WorkspacePreviewCardProps) {
  if (loading) {
    return <WorkspacePreviewCardSkeleton className={className} />;
  }

  const displayRepos = workspace.repositories.slice(0, 3);
  const hasMoreRepos = workspace.repository_count > 3;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 border">
            <AvatarImage 
              src={workspace.owner.avatar_url} 
              alt={workspace.owner.display_name || workspace.owner.id}
            />
            <AvatarFallback className="text-sm">
              {workspace.owner.display_name?.charAt(0)?.toUpperCase() || 
               workspace.owner.id.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg truncate">
                {workspace.name}
              </h3>
              <Badge variant="secondary" className="text-xs">
                Workspace
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {workspace.description || "No description given."}
            </p>
            
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{workspace.repository_count} repos</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{workspace.member_count} members</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {displayRepos.length > 0 && (
          <div className="space-y-3 mb-4">
            <h4 className="text-sm font-medium">Top Repositories</h4>
            <div className="space-y-2">
              {displayRepos.map((repo) => (
                <div key={repo.id} className="flex items-center gap-3 p-2 rounded-md border bg-muted/30">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={repo.avatar_url} alt={repo.owner} />
                    <AvatarFallback className="text-xs">
                      {repo.owner.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {repo.name}
                      </span>
                      {repo.language && (
                        <Badge variant="outline" className="text-xs">
                          {repo.language}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        <span>{repo.activity_score} recent</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <GitCommit className="h-3 w-3" />
                        <span>{formatLastActivity(repo.last_activity)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    asChild
                  >
                    <a 
                      href={repo.html_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
            
            {hasMoreRepos && (
              <p className="text-xs text-muted-foreground text-center">
                and {workspace.repository_count - 3} more repositories...
              </p>
            )}
          </div>
        )}

        <Button asChild className="w-full">
          <Link to={`/i/${workspace.id}`}>
            View Full Workspace
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function WorkspacePreviewCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-32 bg-muted animate-pulse rounded" />
              <div className="h-5 w-16 bg-muted animate-pulse rounded" />
            </div>
            
            <div className="h-4 w-48 bg-muted animate-pulse rounded" />
            
            <div className="flex items-center gap-4">
              <div className="h-3 w-16 bg-muted animate-pulse rounded" />
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3 mb-4">
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-md border bg-muted/30">
                <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-8 bg-muted animate-pulse rounded" />
                    <div className="h-2 w-8 bg-muted animate-pulse rounded" />
                  </div>
                </div>
                <div className="h-6 w-6 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="h-10 w-full bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}