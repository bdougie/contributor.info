import { useState, useMemo, useEffect } from 'react';
import { ExternalLink, Star, GitFork, User, Clock, Eye } from '@/components/ui/icon';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRepos } from '@/hooks/use-user-repos';
import { humanizeNumber } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Breadcrumbs } from '@/components/common/layout/breadcrumbs';
import { SocialMetaTags } from '@/components/common/layout';
import { avatarCache } from '@/lib/avatar-cache';

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
    TypeScript: '#3178c6',
    JavaScript: '#f1e05a',
    Python: '#3572A5',
    Java: '#b07219',
    'C#': '#239120',
    Go: '#00ADD8',
    Rust: '#dea584',
    Ruby: '#701516',
    PHP: '#4F5D95',
    Swift: '#fa7343',
    Kotlin: '#A97BFF',
    Dart: '#00B4AB',
    HTML: '#e34c26',
    CSS: '#1572B6',
  };
  return colors[language] || '#6b7280';
};

const getActivityLevel = (updatedAt: string): { level: string; color: string } => {
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceUpdate <= 7)
    return {
      level: 'Active',
      color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    };
  if (daysSinceUpdate <= 30)
    return {
      level: 'Moderate',
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    };
  return { level: 'Low', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' };
};

const TrackingStatusBadge = ({ repo }: { repo: RepositoryWithTracking }) => {
  const navigate = useNavigate();
  const [owner, repoName] = repo.full_name.split('/');

  const handleViewRepo = () => {
    navigate(`/${owner}/${repoName}`);
  };

  if (repo.is_tracked) {
    return (
      <Button variant="outline" size="sm" className="text-xs h-6 px-2" onClick={handleViewRepo}>
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
    <Button variant="outline" size="sm" className="text-xs h-6 px-2" onClick={handleViewRepo}>
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
          {repo.description || 'No description available'}
        </p>
      </TableCell>
      <TableCell>
        <Badge className={activity.color}>{activity.level}</Badge>
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

const CollaborationNotice = ({ username }: { username: string }) => {
  return (
    <Card className="mt-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              Optimized for Collaboration
            </h3>
            <p className="text-blue-700 dark:text-blue-300">
              This product focuses on collaborative projects. We only show repositories from{' '}
              {username} that have stars, forks, or active pull request activity, as these indicate
              collaborative development.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
            asChild
          >
            <a
              href={`https://github.com/${username}?tab=repositories`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4" />
              View All Repositories on GitHub
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function UserView() {
  const { username } = useParams<{ username: string }>();
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const [cachedAvatarUrl, setCachedAvatarUrl] = useState<string | null>(null);

  const { repositories, userData, isLoading, error } = useUserRepos(username);

  // Check for cached avatar URL on mount
  useEffect(() => {
    if (username) {
      const cached = avatarCache.get(username);
      if (cached) {
        setCachedAvatarUrl(cached);
        // Preload the image to browser cache
        avatarCache.preload(cached);
      }
    }
  }, [username]);

  // Cache the avatar URL when we get user data
  useEffect(() => {
    if (userData?.avatar_url && username) {
      avatarCache.set(username, userData.avatar_url);
      // Preload for next visit
      avatarCache.preload(userData.avatar_url);
    }
  }, [userData, username]);

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
              <h2 className="text-xl font-semibold text-destructive">Error Loading User</h2>
              <p className="text-muted-foreground">
                {error.message ||
                  `Unable to load repositories for ${username}. Please check if the user exists.`}
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

  // Generate dynamic meta tags for the user profile
  const userTitle = `${userData?.name || username} - Open Source Contributor`;
  const userDescription = `View ${userData?.name || username}'s contribution history and open source project insights. Discover their collaborative repositories and development activity.`;
  const userUrl = `https://contributor.info/${username}`;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <SocialMetaTags
        title={userTitle}
        description={userDescription}
        url={userUrl}
        type="article"
        image="social-cards/user"
      />
      {/* Breadcrumbs */}
      <Breadcrumbs />

      {/* Header */}
      <div className="space-y-4 user-header">
        <div className="flex items-center gap-3">
          <div className="user-avatar-container">
            {/* Use cached avatar URL immediately if available, fall back to userData */}
            {(() => {
              const avatarSrc = cachedAvatarUrl || userData?.avatar_url;
              const altText = userData?.name || username || '';
              const fallbackInitial = username?.charAt(0)?.toUpperCase() || '?';

              return avatarSrc ? (
                <UserAvatar
                  src={avatarSrc}
                  alt={altText}
                  size={48}
                  priority={true}
                  lazy={false} // Always load immediately for user avatar
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {fallbackInitial}
                </div>
              );
            })()}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{userData?.name || username}</h1>
            <p className="text-muted-foreground">
              {userData?.bio || 'Collaborative projects from this GitHub user'}
            </p>
          </div>
        </div>
      </div>

      {/* Repositories Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Collaborative Repositories
            <div className="ml-auto repo-count-badge">
              {!isLoading ? (
                <Badge variant="secondary">{repositories.length} collaborative</Badge>
              ) : (
                <div className="h-6 w-16 skeleton-loading rounded" />
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="user-repos-table">
          {isLoading ? (
            <div className="space-y-4">
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
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex flex-col space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-3 w-8" />
                            <Skeleton className="h-3 w-8" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Skeleton className="w-3 h-3 rounded-full" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-16 rounded" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                  <Button variant="outline" onClick={showMoreRepos} className="gap-2">
                    Show More Repositories
                    <span className="text-xs text-muted-foreground">
                      ({displayCount} of {Math.min(repositories.length, MAX_DISPLAY_COUNT)})
                    </span>
                  </Button>
                </div>
              )}

              {hasMoreRepos && displayCount >= MAX_DISPLAY_COUNT && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Showing most collaborative repositories. View GitHub profile for all repositories.
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No collaborative repositories found for this user.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collaboration Notice */}
      <div className="user-cta-section">
        {!isLoading && <CollaborationNotice username={username || ''} />}
      </div>
    </div>
  );
}
