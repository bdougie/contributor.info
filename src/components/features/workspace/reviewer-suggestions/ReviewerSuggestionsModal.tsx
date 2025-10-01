import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Copy } from '@/components/ui/icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  fetchCodeOwners,
  suggestReviewers,
  fetchRecentPullRequests,
  fetchPRsWithoutReviewers,
  type MinimalPR,
} from '@/services/reviewer-suggestions.service';
import type { Repository } from '@/components/features/workspace/RepositoryList';

interface ReviewerSuggestionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repositories: Array<Pick<Repository, 'id' | 'name' | 'owner' | 'full_name'>>;
}

export function ReviewerSuggestionsModal({
  open,
  onOpenChange,
  repositories,
}: ReviewerSuggestionsModalProps) {
  const [activeRepo, setActiveRepo] = useState<string>('');
  const active = useMemo(
    () => repositories.find((r) => r.id === activeRepo) || repositories[0],
    [repositories, activeRepo]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggest Reviewers state
  const [prUrl, setPrUrl] = useState('');
  type ReviewerSuggestionDTO = {
    handle: string;
    reason: string;
    confidence: number;
    signals: string[];
    metadata?: {
      avatarUrl?: string;
      reviewCount?: number;
      lastReviewDate?: string;
      score: number;
    };
  };

  type SuggestionsResponse = {
    suggestions: ReviewerSuggestionDTO[];
    codeOwners: string[];
    repository: string;
    filesAnalyzed: number;
    directoriesAffected: number;
    generatedAt: string;
  };

  const [suggestions, setSuggestions] = useState<SuggestionsResponse | null>(null);

  // CODEOWNERS state (read-only for reference)
  const [codeowners, setCodeowners] = useState<{
    exists: boolean;
    content?: string;
    path?: string;
    message?: string;
  } | null>(null);

  const [pullRequests, setPullRequests] = useState<MinimalPR[]>([]);
  const [prsWithoutReviewers, setPrsWithoutReviewers] = useState<MinimalPR[]>([]);
  const [selectedPR, setSelectedPR] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuggestions(null);
    setCodeowners(null);
  }, [open]);

  useEffect(() => {
    // Load recent PRs and PRs without reviewers when active repository changes
    (async () => {
      if (!active?.id) return;
      const [prs, prsNoReviewers] = await Promise.all([
        fetchRecentPullRequests(active.id, 25),
        fetchPRsWithoutReviewers(active.id, 10),
      ]);
      setPullRequests(prs);
      setPrsWithoutReviewers(prsNoReviewers);
    })();
  }, [active?.id]);

  const owner = active?.owner || active?.full_name?.split('/')[0] || '';
  const repo = active?.name || active?.full_name?.split('/')[1] || '';

  const handleLoadCodeowners = async () => {
    if (!owner || !repo) return;
    try {
      const co = await fetchCodeOwners(owner, repo);
      setCodeowners(co);
    } catch (e: unknown) {
      console.error('Failed to fetch CODEOWNERS:', e);
      setCodeowners({ exists: false, message: 'Failed to fetch CODEOWNERS' });
    }
  };

  // Load CODEOWNERS when repository changes
  useEffect(() => {
    if (owner && repo) {
      handleLoadCodeowners().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.log('[CODEOWNERS] Failed to load, will continue without:', message);
      });
    }
  }, [owner, repo, handleLoadCodeowners]);

  const handleGetReviewers = async (prNumber: number) => {
    setSelectedPR(String(prNumber));
    const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
    setPrUrl(prUrl);

    if (owner && repo) {
      setLoading(true);
      setError(null);
      try {
        const res = await suggestReviewers(owner, repo, undefined, undefined, prUrl);
        setSuggestions(res);
      } catch (e: unknown) {
        console.error('Failed to get reviewer suggestions:', e);
        const errorMessage = e instanceof Error ? e.message : 'Failed to get suggestions';
        setError(`Error: ${errorMessage}. Please ensure the repository is tracked and try again.`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Reviewer Suggestions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Repository selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Repository</span>
            <Select value={active?.id || ''} onValueChange={setActiveRepo}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select repository" />
              </SelectTrigger>
              <SelectContent>
                {repositories.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.full_name || `${r.owner}/${r.name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Show CODEOWNERS status */}
            {codeowners && (
              <div className="flex items-center gap-2 ml-auto">
                {codeowners.exists ? (
                  <>
                    <Badge variant="secondary" className="text-xs">
                      CODEOWNERS exists
                    </Badge>
                    <span className="text-xs text-muted-foreground">{codeowners.path}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">No CODEOWNERS file</span>
                )}
              </div>
            )}
          </div>

          {/* Show if we have a PR selected and suggestions */}
          {suggestions && (
            <div className="flex items-center justify-between">
              <div>
                {selectedPR && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm font-medium">PR #{selectedPR}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {prUrl && `${prUrl.split('/').slice(-4, -2).join('/')} • `}
                      Analysis complete
                    </div>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSuggestions(null);
                  setError(null);
                  setSelectedPR('');
                  setPrUrl('');
                }}
              >
                Back to PRs
              </Button>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h4 className="font-medium text-red-800 dark:text-red-200 mb-1">
                    Failed to get reviewer suggestions
                  </h4>
                  <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Main content area */}
          {!suggestions && !error && (
            <>
              {/* PRs without reviewers section */}
              {prsWithoutReviewers.length > 0 && (
                <div className="p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-amber-600" />
                    <h3 className="font-medium text-amber-800 dark:text-amber-200">
                      PRs Needing Reviewers ({prsWithoutReviewers.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {prsWithoutReviewers.slice(0, 5).map((pr) => (
                      <div
                        key={pr.number}
                        className="flex items-center gap-3 p-2 bg-white dark:bg-amber-950/40 rounded border hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors"
                      >
                        <Avatar className="h-6 w-6">
                          {pr.author?.avatar_url ? (
                            <AvatarImage src={pr.author.avatar_url} alt={pr.author.username} />
                          ) : (
                            <AvatarFallback>
                              {pr.author?.username?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            #{pr.number} · {pr.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            by @{pr.author?.username} ·{' '}
                            {new Date(pr.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => handleGetReviewers(pr.number)}
                          disabled={loading && selectedPR === String(pr.number)}
                        >
                          {loading && selectedPR === String(pr.number) ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              Analyzing...
                            </>
                          ) : (
                            'Get Reviewers'
                          )}
                        </Button>
                      </div>
                    ))}
                    {prsWithoutReviewers.length > 5 && (
                      <div className="text-xs text-muted-foreground text-center pt-2">
                        ... and {prsWithoutReviewers.length - 5} more PRs needing reviewers
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manual PR selection */}
              {pullRequests.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Or select any open PR</span>
                  <Select
                    value={selectedPR}
                    onValueChange={(v) => {
                      setSelectedPR(v);
                      const num = Number(v);
                      if (owner && repo && Number.isFinite(num)) {
                        setPrUrl(`https://github.com/${owner}/${repo}/pull/${num}`);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[320px]">
                      <SelectValue placeholder="Select open PR (recent)" />
                    </SelectTrigger>
                    <SelectContent>
                      {pullRequests.map((pr) => (
                        <SelectItem key={pr.number} value={String(pr.number)}>
                          #{pr.number} · {pr.title?.slice(0, 50) || 'Untitled'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPR && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGetReviewers(Number(selectedPR))}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Analyzing...
                        </>
                      ) : (
                        'Get Reviewers'
                      )}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Suggestions display */}
          {suggestions && (
            <ScrollArea className="h-[400px] rounded-md border p-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        suggestions.suggestions
                          .slice(0, 3)
                          .map((s: ReviewerSuggestionDTO) => `@${s.handle}`)
                          .join(' ')
                      )
                    }
                    title="Copy top reviewers"
                  >
                    <Copy className="h-4 w-4 mr-2" /> Copy top reviewers
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Analyzed {suggestions.filesAnalyzed} files in {suggestions.directoriesAffected}{' '}
                    directories
                  </span>
                </div>

                <h4 className="font-semibold text-base mb-3">Suggested Reviewers</h4>
                {suggestions.suggestions.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      No reviewer suggestions available
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This could be due to insufficient review history in the last 90 days. Consider
                      manually assigning reviewers based on code ownership or expertise.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {suggestions.suggestions.map((s) => (
                      <div
                        key={s.handle}
                        className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <Avatar className="h-10 w-10">
                          {s.metadata?.avatarUrl ? (
                            <AvatarImage src={s.metadata.avatarUrl} alt={s.handle} />
                          ) : (
                            <AvatarFallback>{s.handle[0]?.toUpperCase()}</AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">@{s.handle}</span>
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(s.confidence * 100)}% confidence
                            </Badge>
                            {s.signals?.includes('recently_active') && (
                              <Badge variant="outline" className="text-xs text-green-600">
                                Recently Active
                              </Badge>
                            )}
                            {s.signals?.includes('code_owner') && (
                              <Badge variant="default" className="text-xs">
                                Code Owner
                              </Badge>
                            )}
                            {s.signals?.includes('team') && (
                              <Badge variant="default" className="text-xs">
                                Team
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{s.reason}</div>
                          {s.metadata?.reviewCount && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {s.metadata.reviewCount} recent reviews • {s.signals?.join(', ')}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigator.clipboard.writeText(`@${s.handle}`)}
                          title="Copy username"
                          aria-label={`Copy @${s.handle}`}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
