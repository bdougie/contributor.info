import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ExternalLink, Star, GitFork, Users, Clock, Eye } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useOrgRepos } from "@/hooks/use-org-repos";
import { humanizeNumber } from "@/lib/utils";
import { OrganizationAvatar } from "@/components/ui/organization-avatar";

interface RepositoryWithTracking {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  html_url: string;
  updated_at: string;
  archived: boolean;
  disabled: boolean;
  is_tracked?: boolean;
  is_processing?: boolean;
}

const INITIAL_DISPLAY_COUNT = 10;
const MAX_DISPLAY_COUNT = 25;

const getLanguageColor = (language: string): string => {
  const colors: { [key: string]: string } = {
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    Java: "#b07219",
    "C#": "#239120",
    Go: "#00ADD8",
    Rust: "#dea584",
    Ruby: "#701516",
    PHP: "#4F5D95",
    Swift: "#fa7343",
    Kotlin: "#A97BFF",
    Dart: "#00B4AB",
    HTML: "#e34c26",
    CSS: "#1572B6",
  };
  return colors[language] || "#6b7280";
};

const getActivityLevel = (updatedAt: string): { level: string; color: string } => {
  const daysSinceUpdate = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceUpdate <= 7) return { level: "Active", color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" };
  if (daysSinceUpdate <= 30) return { level: "Moderate", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400" };
  return { level: "Low", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" };
};

const TrackingStatusBadge = ({ repo }: { repo: RepositoryWithTracking }) => {
  const navigate = useNavigate();
  const [owner, repoName] = repo.full_name.split('/');

  const handleViewRepo = () => {
    navigate(`/${owner}/${repoName}`);
  };

  if (repo.is_tracked) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        className="text-xs h-6 px-2"
        onClick={handleViewRepo}
      >
        <Eye className="w-3 h-3 mr-1" />
        View
      </Button>
    );
  }
  
  if (repo.is_processing) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/20">
        <Clock className="w-3 h-3 mr-1" />
        Processing
      </Badge>
    );
  }
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="text-xs h-6 px-2"
      onClick={handleViewRepo}
    >
      Track
    </Button>
  );
};

const RepositoryRow = ({ repo }: { repo: RepositoryWithTracking }) => {
  const activity = getActivityLevel(repo.updated_at);
  const [owner, repoName] = repo.full_name.split('/');

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <Link 
            to={`/${owner}/${repoName}`}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            {repo.name}
          </Link>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3" />
              {humanizeNumber(repo.stargazers_count)}
            </span>
            <span className="flex items-center gap-1">
              <GitFork className="w-3 h-3" />
              {humanizeNumber(repo.forks_count)}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="max-w-md">
        <p className="text-sm text-muted-foreground truncate">
          {repo.description || "No description available"}
        </p>
      </TableCell>
      <TableCell>
        <Badge className={activity.color}>
          {activity.level}
        </Badge>
      </TableCell>
      <TableCell>
        {repo.language && (
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: getLanguageColor(repo.language) }}
            />
            <span className="text-sm">{repo.language}</span>
          </div>
        )}
      </TableCell>
      <TableCell>
        <TrackingStatusBadge repo={repo} />
      </TableCell>
    </TableRow>
  );
};

const RequestMoreReposCTA = ({ org }: { org: string }) => {
  const handleRequestMoreRepos = () => {
    const discussionUrl = `https://github.com/bdougie/contributor.info/discussions/new?category=request-a-repo&title=Request%20more%20repositories%20for%20${encodeURIComponent(org)}&body=I'd%20like%20to%20request%20additional%20repositories%20from%20the%20${encodeURIComponent(org)}%20organization%20to%20be%20tracked%3A%0A%0A%5BList%20specific%20repositories%20or%20describe%20the%20type%20of%20repositories%20you're%20interested%20in%5D`;
    window.open(discussionUrl, '_blank', 'noopener,noreferrer');
    
    toast.success("Request submitted!", {
      description: "Let us know which specific repositories you'd like to see tracked."
    });
  };

  return (
    <Card className="mt-6">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Looking for specific repositories?</h3>
            <p className="text-muted-foreground">
              We're showing the most active repositories for {org}. Request specific repos to be tracked.
            </p>
          </div>
          <Button onClick={handleRequestMoreRepos} className="gap-2">
            <ExternalLink className="w-4 h-4" />
            Request Specific Repositories
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function OrgView() {
  const { org } = useParams<{ org: string }>();
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  
  const { repositories, orgData, isLoading, error } = useOrgRepos(org);
  
  const displayedRepos = useMemo(() => {
    return repositories.slice(0, displayCount);
  }, [repositories, displayCount]);

  const showMoreRepos = () => {
    setDisplayCount(Math.min(displayCount + 10, MAX_DISPLAY_COUNT));
  };

  const canShowMore = displayCount < Math.min(repositories.length, MAX_DISPLAY_COUNT);
  const hasMoreRepos = repositories.length > MAX_DISPLAY_COUNT;

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-destructive">Error Loading Organization</h2>
              <p className="text-muted-foreground">
                {error.message || `Unable to load repositories for ${org}. Please check if the organization exists.`}
              </p>
              <Button asChild>
                <Link to="/">Return to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4 org-header">
        <div className="flex items-center gap-3">
          <div className="org-avatar-container">
            {orgData?.avatar_url ? (
              <OrganizationAvatar
                src={orgData.avatar_url}
                alt={orgData.name || org || ''}
                size={48}
                priority={true}
              />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center text-white font-bold text-lg">
                {org?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{orgData?.name || org}</h1>
            <p className="text-muted-foreground">
              Most active repositories from this GitHub organization
            </p>
          </div>
        </div>
      </div>

      {/* Repositories Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Repositories
            <div className="ml-auto repo-count-badge">
              {!isLoading ? (
                <Badge variant="secondary">
                  {repositories.length} total
                </Badge>
              ) : (
                <div className="h-6 w-16 skeleton-loading rounded" />
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="org-repos-table">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : repositories.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repository</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedRepos.map((repo) => (
                    <RepositoryRow key={repo.id} repo={repo} />
                  ))}
                </TableBody>
              </Table>
              
              {canShowMore && (
                <div className="mt-6 text-center">
                  <Button 
                    variant="outline" 
                    onClick={showMoreRepos}
                    className="gap-2"
                  >
                    Show More Repositories
                    <span className="text-xs text-muted-foreground">
                      ({displayCount} of {Math.min(repositories.length, MAX_DISPLAY_COUNT)})
                    </span>
                  </Button>
                </div>
              )}
              
              {hasMoreRepos && displayCount >= MAX_DISPLAY_COUNT && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Showing most active repositories. Use the request form below for specific repositories.
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No repositories found for this organization.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request More Repositories CTA */}
      <div className="org-cta-section">
        {!isLoading && repositories.length > 0 && (
          <RequestMoreReposCTA org={org || ""} />
        )}
      </div>
    </div>
  );
}