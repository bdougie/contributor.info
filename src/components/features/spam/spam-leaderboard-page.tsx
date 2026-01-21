/**
 * Spam Leaderboard - Public display of verified known spammers
 * Issue #1622: Known Spammer Community Database
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ExternalLink, Trophy, Users, Plus } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

function getRankColor(index: number): string {
  if (index === 0) return 'text-yellow-500';
  if (index === 1) return 'text-gray-400';
  return 'text-amber-600';
}

export function SpamLeaderboardPage() {
  const [spammers, setSpammers] = useState<SpammerWithLatestPR[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const totalSpamPRs = spammers.reduce((sum, s) => sum + s.spam_pr_count, 0);

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-orange-500" />
                Known Spammer Leaderboard
              </CardTitle>
              <CardDescription className="mt-2">
                Community-verified spam contributors. Help keep open source clean by reporting spam
                PRs.
              </CardDescription>
            </div>
            <Button asChild>
              <Link to="/spam/new">
                <Plus className="mr-2 h-4 w-4" />
                Report Spam
              </Link>
            </Button>
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
              {[...Array(5)].map((_, i) => (
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
                  {spammers.map((spammer, index) => (
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
                          >
                            {spammer.github_login}
                            <ExternalLink className="h-3 w-3" />
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
