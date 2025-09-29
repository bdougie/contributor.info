import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Copy } from '@/components/ui/icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { fetchCodeOwners, fetchFileTree, fetchSuggestedCodeOwners, suggestReviewers, fetchRecentPullRequests, fetchPRsWithoutReviewers, type MinimalPR } from '@/services/reviewer-suggestions.service';
import type { Repository } from '@/components/features/workspace/RepositoryList';

interface ReviewerSuggestionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repositories: Array<Pick<Repository, 'id' | 'name' | 'owner' | 'full_name'>>;
}

export function ReviewerSuggestionsModal({ open, onOpenChange, repositories }: ReviewerSuggestionsModalProps) {
  const [activeRepo, setActiveRepo] = useState<string>('');
  const active = useMemo(
    () => repositories.find((r) => r.id === activeRepo) || repositories[0],
    [repositories, activeRepo]
  );

  const [tab, setTab] = useState<'reviewers' | 'codeowners' | 'generate'>('reviewers');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggest Reviewers state
  const [prUrl, setPrUrl] = useState('');
  const [useAI, setUseAI] = useState(true);
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

  // CODEOWNERS state
  const [codeowners, setCodeowners] = useState<
    { exists: boolean; content?: string; path?: string; message?: string } | null
  >(null);

  // Generate CODEOWNERS state
  const [generated, setGenerated] = useState<
    { suggestions: Array<{ pattern: string; owners: string[]; confidence: number; reasoning: string }>; codeOwnersContent: string } | null
  >(null);
  const [fileTree, setFileTree] = useState<{ files: string[]; directories: string[] } | null>(null);
  const [pullRequests, setPullRequests] = useState<MinimalPR[]>([]);
  const [prsWithoutReviewers, setPrsWithoutReviewers] = useState<MinimalPR[]>([]);
  const [selectedPR, setSelectedPR] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuggestions(null);
    setGenerated(null);
    setCodeowners(null);
    if (!active && repositories.length > 0) {
      // initialize
    }
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
    setLoading(true);
    setError(null);
    try {
      const co = await fetchCodeOwners(owner, repo);
      setCodeowners(co);
    } catch (e: any) {
      setError(e?.message || 'Failed to load CODEOWNERS');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!owner || !repo) return;
    setLoading(true);
    setError(null);
    try {
      const [ft, gen] = await Promise.all([
        fetchFileTree(owner, repo),
        fetchSuggestedCodeOwners(owner, repo, { llm: useAI }),
      ]);
      setFileTree(ft);
      setGenerated(gen);
    } catch (e: any) {
      setError(e?.message || 'Failed to generate suggestions');
    } finally {
      setLoading(false);
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

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <div className="flex items-center justify-between gap-4 mb-4">
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
            </div>
            <TabsList>
              <TabsTrigger value="reviewers">Suggest Reviewers</TabsTrigger>
              <TabsTrigger value="codeowners">CODEOWNERS</TabsTrigger>
              <TabsTrigger value="generate">Generate CODEOWNERS</TabsTrigger>
            </TabsList>
          </div>

          {/* PRs without reviewers section - only show in reviewers tab */}
          {tab === 'reviewers' && prsWithoutReviewers.length > 0 && (
          <div className="mb-6 p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
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
                  className="flex items-center gap-3 p-2 bg-white dark:bg-amber-950/40 rounded border hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors cursor-pointer"
                  onClick={async () => {
                    setSelectedPR(String(pr.number));
                    const prUrl = `https://github.com/${owner}/${repo}/pull/${pr.number}`;
                    setPrUrl(prUrl);
                    setTab('reviewers');

                    // Automatically trigger reviewer suggestions
                    if (owner && repo) {
                      setLoading(true);
                      setError(null);
                      try {
                        const res = await suggestReviewers(owner, repo, undefined, undefined, prUrl);
                        setSuggestions(res);
                      } catch (e: any) {
                        setError(e?.message || 'Failed to get suggestions');
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                >
                  <Avatar className="h-6 w-6">
                    {pr.author?.avatar_url ? (
                      <AvatarImage src={pr.author.avatar_url} alt={pr.author.username} />
                    ) : (
                      <AvatarFallback>{pr.author?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      #{pr.number} · {pr.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      by @{pr.author?.username} · {new Date(pr.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={async (e) => {
                      e.stopPropagation(); // Prevent triggering the card's onClick
                      setSelectedPR(String(pr.number));
                      const prUrl = `https://github.com/${owner}/${repo}/pull/${pr.number}`;
                      setPrUrl(prUrl);
                      setTab('reviewers');

                      // Trigger reviewer suggestions
                      if (owner && repo) {
                        setLoading(true);
                        setError(null);
                        try {
                          // First try with PR URL, if that fails, try with dummy files
                          let res;
                          try {
                            res = await suggestReviewers(owner, repo, undefined, undefined, prUrl);
                          } catch (e: any) {
                            // If PR URL fetch fails, try with some common files as fallback
                            console.log('PR URL fetch failed, trying with sample files...');
                            const sampleFiles = ['README.md', 'src/index.ts', 'package.json'];
                            res = await suggestReviewers(owner, repo, sampleFiles, undefined, undefined);
                          }
                          setSuggestions(res);
                        } catch (e: any) {
                          console.error('Failed to get reviewer suggestions:', e);
                          const errorMessage = e?.message || 'Failed to get suggestions';
                          setError(`Error: ${errorMessage}. Please ensure the repository is tracked and try again.`);
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
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

          {/* Original PR selection for manual entry - only show in reviewers tab */}
          {tab === 'reviewers' && pullRequests.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
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
                onClick={async () => {
                  setTab('reviewers');
                  if (owner && repo && selectedPR) {
                    setLoading(true);
                    setError(null);
                    try {
                      const res = await suggestReviewers(owner, repo, undefined, undefined, prUrl);
                      setSuggestions(res);
                    } catch (e: any) {
                      console.error('Failed to get reviewer suggestions:', e);
                      const errorMessage = e?.message || 'Failed to get suggestions';
                      setError(`Error: ${errorMessage}. Please ensure the repository is tracked and try again.`);
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
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

          <TabsContent value="reviewers" className="mt-4 space-y-4 min-h-[400px]">
            {selectedPR && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium">Selected PR #{selectedPR}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {prUrl && `${prUrl.split('/').slice(-3, -1).join('/')} • `}
                  Analyzing changed files for reviewer suggestions
                </div>
              </div>
            )}
            {!selectedPR && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Select a PR above to get reviewer suggestions</p>
              </div>
            )}
            {loading && (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Analyzing PR and suggesting reviewers...</p>
              </div>
            )}
            {error && (
              <div className="text-center py-4">
                <span className="text-sm text-red-500">{error}</span>
              </div>
            )}
            {suggestions && (
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="secondary"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      suggestions.suggestions.slice(0, 3).map((s: ReviewerSuggestionDTO) => `@${s.handle}`).join(' ')
                    )
                  }
                  title="Copy top reviewers"
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy top reviewers
                </Button>
                <span className="text-xs text-muted-foreground">
                  Analyzed {suggestions.filesAnalyzed} files in {suggestions.directoriesAffected} directories
                </span>
              </div>
            )}
            {suggestions && suggestions.suggestions && (
              <div className="space-y-4">
                <h4 className="font-semibold text-base mb-3">Suggested Reviewers</h4>
                {suggestions.suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No reviewer suggestions available.</p>
                ) : (
                  <div className="grid gap-3">
                    {suggestions.suggestions.map((s) => (
                      <div key={s.handle} className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
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
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {s.reason}
                          </div>
                          {s.metadata?.reviewCount && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {s.metadata.reviewCount} recent reviews • {s.signals?.join(', ')}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigator.clipboard.writeText(s.handle)}
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
            )}
          </TabsContent>

          <TabsContent value="codeowners" className="mt-4 space-y-3 min-h-[400px]">
            <div className="flex items-center gap-2">
              <Button onClick={handleLoadCodeowners} disabled={loading} variant="outline">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Load CODEOWNERS
              </Button>
              {codeowners?.path && (
                <span className="text-sm text-muted-foreground">Path: {codeowners.path}</span>
              )}
            </div>
            {error && <span className="text-sm text-red-500">{error}</span>}
            {codeowners ? (
              <ScrollArea className="h-72 rounded border">
                <pre className="p-3 bg-muted/30 text-xs whitespace-pre-wrap">
                  {codeowners.content || codeowners.message}
                </pre>
              </ScrollArea>
            ) : !loading && (
              <div className="flex items-center justify-center h-72 rounded border border-dashed">
                <div className="text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Click "Load CODEOWNERS" to view the file</p>
                  <p className="text-xs mt-1">This will fetch the CODEOWNERS file from the repository</p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="generate" className="mt-4 space-y-3 min-h-[400px]">
            <div className="flex items-center gap-4">
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Generate Suggestions
              </Button>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Use AI</span>
                <Switch checked={useAI} onCheckedChange={setUseAI} />
              </div>
              {error && <span className="text-sm text-red-500">{error}</span>}
            </div>
            {fileTree && (
              <div className="text-xs text-muted-foreground">
                {fileTree.directories.length} directories, {fileTree.files.length} files
              </div>
            )}
            {generated ? (
              <div className="grid gap-2">
                <ScrollArea className="h-48 rounded border">
                  <div className="p-2 space-y-2">
                    {generated.suggestions.map((s, idx) => (
                      <div key={idx} className="border rounded p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <code>{s.pattern}</code>
                          <Badge variant="secondary">{Math.round(s.confidence * 100)}%</Badge>
                        </div>
                        <div className="text-xs mt-1">Owners: {s.owners.join(' ')}</div>
                        <div className="text-xs text-muted-foreground">{s.reasoning}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div>
                  <h4 className="font-semibold mt-2">Generated CODEOWNERS</h4>
                  <ScrollArea className="h-72 rounded border">
                    <pre className="p-3 bg-muted/30 text-xs whitespace-pre-wrap">
                      {generated.codeOwnersContent}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            ) : !loading && (
              <div className="flex items-center justify-center h-72 rounded border border-dashed">
                <div className="text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Generate CODEOWNERS suggestions</p>
                  <p className="text-xs mt-1">AI will analyze your repository structure and suggest ownership patterns</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
