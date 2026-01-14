import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { ExternalLink, Check, X, RefreshCw } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { SpamIndicator, SpamProbabilityBadge } from '@/components/features/spam/spam-indicator';
import { useWorkspaceSpam, type SpamPullRequest } from '@/hooks/useWorkspaceSpam';
import type { Repository } from '@/components/features/workspace';
import type { WorkspaceMemberWithUser } from '@/types/workspace';
import { getFallbackAvatar } from '@/lib/utils/avatar';

interface WorkspaceSpamTabProps {
  repositories: Repository[];
  selectedRepositories: string[];
  currentUser: User | null;
  currentMember: WorkspaceMemberWithUser | null;
}

export function WorkspaceSpamTab({
  repositories,
  selectedRepositories,
  currentUser,
  currentMember,
}: WorkspaceSpamTabProps) {
  const navigate = useNavigate();
  const [minSpamScore, setMinSpamScore] = useState(0); // Default to 0% to show all analyzed PRs
  const [includeUnanalyzed, setIncludeUnanalyzed] = useState(false);

  const { pullRequests, stats, loading, error, refresh, updateSpamStatus } = useWorkspaceSpam({
    repositories,
    selectedRepositories,
    minSpamScore,
    includeUnanalyzed,
  });

  const handlePullRequestClick = (pr: SpamPullRequest) => {
    window.open(pr.html_url, '_blank', 'noopener,noreferrer');
  };

  const handleRepositoryClick = (owner: string, name: string) => {
    navigate(`/${owner}/${name}`);
  };

  const handleMarkAsSpam = async (pr: SpamPullRequest) => {
    try {
      await updateSpamStatus(pr.id, true);
      toast.success('Marked as spam');
    } catch (err) {
      console.error('Failed to mark PR as spam: %s', err);
      toast.error('Failed to mark as spam');
    }
  };

  const handleMarkAsLegitimate = async (pr: SpamPullRequest) => {
    try {
      await updateSpamStatus(pr.id, false);
      toast.success('Marked as legitimate');
    } catch (err) {
      console.error('Failed to mark PR as legitimate: %s', err);
      toast.error('Failed to mark as legitimate');
    }
  };

  // Check if user can manage spam (owner, admin, or maintainer)
  const canManageSpam = useMemo(() => {
    if (!currentUser || !currentMember) return false;
    return ['owner', 'admin', 'maintainer'].includes(currentMember.role);
  }, [currentUser, currentMember]);

  if (loading) {
    return <WorkspaceSpamTabSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Spam Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={refresh} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Analyzed</CardDescription>
              <CardTitle className="text-2xl">{stats.totalAnalyzed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Spam Detected</CardDescription>
              <CardTitle className="text-2xl text-destructive">
                {stats.spamCount} ({stats.spamPercentage}%)
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Score</CardDescription>
              <CardTitle className="text-2xl">{stats.averageScore}%</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Distribution</CardDescription>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {[
                  { label: 'clean', value: stats.distribution.legitimate, variant: 'default' as const },
                  { label: 'warn', value: stats.distribution.warning, variant: 'secondary' as const },
                  { label: 'likely', value: stats.distribution.likelySpam, variant: 'secondary' as const },
                  { label: 'spam', value: stats.distribution.definiteSpam, variant: 'destructive' as const },
                ].map((item) => (
                  <Badge
                    key={item.label}
                    variant="outline"
                    className="text-xs justify-center"
                  >
                    {item.value} {item.label}
                  </Badge>
                ))}
              </div>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Spam Filters</CardTitle>
          <CardDescription>Filter PRs by spam detection score</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Minimum Spam Score: {minSpamScore}%</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={minSpamScore === 0 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMinSpamScore(0)}
              >
                All
              </Button>
              <Button
                variant={minSpamScore === 25 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMinSpamScore(25)}
              >
                Warning+ (25%)
              </Button>
              <Button
                variant={minSpamScore === 50 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMinSpamScore(50)}
              >
                Likely+ (50%)
              </Button>
              <Button
                variant={minSpamScore === 75 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMinSpamScore(75)}
              >
                Definite (75%)
              </Button>
            </div>
            <Slider
              value={[minSpamScore]}
              onValueChange={(value) => setMinSpamScore(value[0])}
              max={100}
              step={5}
              className="w-full max-w-md"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="include-unanalyzed"
              checked={includeUnanalyzed}
              onCheckedChange={setIncludeUnanalyzed}
            />
            <Label htmlFor="include-unanalyzed">Include unanalyzed PRs</Label>
          </div>

          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </CardContent>
      </Card>

      {/* PR Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {pullRequests.length} Pull Request{pullRequests.length !== 1 ? 's' : ''}
          </CardTitle>
          <CardDescription>PRs with spam score {minSpamScore}% or higher</CardDescription>
        </CardHeader>
        <CardContent>
          {pullRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pull requests match the current filters.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px] min-w-[80px]">Score</TableHead>
                    <TableHead className="min-w-[250px]">PR</TableHead>
                    <TableHead className="min-w-[180px]">Repository</TableHead>
                    <TableHead className="min-w-[140px]">Author</TableHead>
                    <TableHead className="min-w-[120px]">Status</TableHead>
                    <TableHead className="min-w-[100px]">Created</TableHead>
                    {canManageSpam && (
                      <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pullRequests.map((pr) => (
                    <TableRow key={pr.id}>
                      <TableCell>
                        <SpamProbabilityBadge spamScore={pr.spam_score} />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handlePullRequestClick(pr)}
                          className="text-left hover:underline flex items-center gap-1.5"
                        >
                          <span className="text-muted-foreground whitespace-nowrap">
                            #{pr.number}
                          </span>
                          <span className="truncate max-w-[200px]" title={pr.title}>
                            {pr.title}
                          </span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() =>
                            handleRepositoryClick(pr.repository.owner, pr.repository.name)
                          }
                          className="hover:underline text-sm whitespace-nowrap"
                        >
                          {pr.repository.full_name}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <img
                            src={pr.author.avatar_url || getFallbackAvatar()}
                            alt={`${pr.author.username}'s avatar`}
                            className="h-6 w-6 rounded-full flex-shrink-0"
                          />
                          <span className="text-sm whitespace-nowrap">{pr.author.username}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <SpamIndicator spamScore={pr.spam_score} isSpam={pr.is_spam} size="sm" />
                          {pr.is_spam && (
                            <Badge variant="destructive" className="text-xs whitespace-nowrap">
                              Confirmed Spam
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(pr.created_at).toLocaleDateString()}
                      </TableCell>
                      {canManageSpam && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!pr.is_spam && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsSpam(pr)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Mark as spam"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                            {pr.is_spam && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsLegitimate(pr)}
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Mark as legitimate"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceSpamTabSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Skeleton */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16 mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Filter Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full max-w-md" />
        </CardContent>
      </Card>

      {/* Table Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
