/**
 * Spam Leaderboard - Public display of verified known spammers
 * Issue #1622: Known Spammer Community Database
 *
 * Shows #1 spammer publicly, requires login to view full list
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ExternalLink, Trophy, Users, Plus, Lock } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { getVerifiedSpammers, type SpammerWithLatestPR } from '@/lib/spam/SpamReportService';
import { useAuth } from '@/hooks/use-auth';

function getRankColor(index: number): string {
  if (index === 0) return 'text-yellow-500';
  if (index === 1) return 'text-gray-400';
  return 'text-amber-600';
}

export function SpamLeaderboardPage() {
  const [spammers, setSpammers] = useState<SpammerWithLatestPR[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isLoggedIn, login } = useAuth();

  useEffect(() => {
    async function loadSpammers() {
      setIsLoading(true);
      setError(null);
      const result = await getVerifiedSpammers();
      if (result.error) {
        setError(result.error);
      } else {
        setSpammers(result.data);
      }
      setIsLoading(false);
    }
    loadSpammers();
  }, []);

  // Memoize expensive calculation to avoid recalculating on every render
  const totalSpamPRs = useMemo(
    () => spammers.reduce((sum, s) => sum + s.spam_pr_count, 0),
    [spammers]
  );

  // Show only #1 to non-logged-in users
  const visibleSpammers = isLoggedIn ? spammers : spammers.slice(0, 1);
  const hiddenCount = spammers.length - visibleSpammers.length;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-orange-500" />
                Known Spammer List
              </CardTitle>
              <CardDescription className="mt-2">
                Community-verified spam contributors. Help keep open source clean by reporting spam
                PRs.
              </CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild size="icon">
                  <Link to="/spam/new" aria-label="Report Spam">
                    <Plus className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Report Spam</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        <CardContent>
          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Total Verified Spammers
              </div>
              <div className="text-2xl font-bold mt-1">
                {isLoading ? <Skeleton className="h-8 w-16" /> : spammers.length}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                Total Spam PRs Reported
              </div>
              <div className="text-2xl font-bold mt-1">
                {isLoading ? <Skeleton className="h-8 w-16" /> : totalSpamPRs}
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="mx-auto h-8 w-8 mb-2 text-destructive" />
              <p>{error}</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && spammers.length === 0 && (
            <div className="text-center py-12">
              <Trophy className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">No Verified Spammers Yet</h3>
            </div>
          )}

          {/* Spammer Table */}
          {!isLoading && !error && spammers.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>GitHub User</TableHead>
                    <TableHead className="text-right">Spam PRs</TableHead>
                    <TableHead className="hidden sm:table-cell">First Reported</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleSpammers.map((spammer, index) => (
                    <TableRow key={spammer.id}>
                      <TableCell className="font-medium">
                        {index < 3 ? (
                          <span className={getRankColor(index)}>#{index + 1}</span>
                        ) : (
                          `#${index + 1}`
                        )}
                      </TableCell>
                      <TableCell>
                        {spammer.latest_pr_url ? (
                          <a
                            href={spammer.latest_pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:underline"
                            aria-label={`View ${spammer.github_login}'s latest spam PR on GitHub (opens in new tab)`}
                          >
                            {spammer.github_login}
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <span>{spammer.github_login}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {spammer.spam_pr_count}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {new Date(spammer.first_reported_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          variant={
                            spammer.verification_status === 'verified' ? 'destructive' : 'secondary'
                          }
                        >
                          {spammer.verification_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Login prompt for non-authenticated users */}
              {!isLoggedIn && hiddenCount > 0 && (
                <div className="relative mt-4">
                  {/* Blurred preview of hidden rows */}
                  <div className="blur-sm pointer-events-none select-none opacity-50">
                    <Table>
                      <TableBody>
                        {spammers.slice(1, 4).map((spammer, index) => (
                          <TableRow key={spammer.id}>
                            <TableCell className="font-medium w-16">#{index + 2}</TableCell>
                            <TableCell>{spammer.github_login}</TableCell>
                            <TableCell className="text-right font-mono">
                              {spammer.spam_pr_count}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">-</TableCell>
                            <TableCell className="hidden sm:table-cell">-</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Login overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-[2px] rounded-lg">
                    <Lock className="h-8 w-8 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Login to see all {spammers.length} verified spammers
                    </p>
                    <Button
                      onClick={() => login()}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      Login with GitHub
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t text-center">
                <p className="text-sm text-muted-foreground">
                  See something suspicious?{' '}
                  <Link to="/spam/new" className="underline hover:text-foreground">
                    Report a potential spam PR
                  </Link>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
