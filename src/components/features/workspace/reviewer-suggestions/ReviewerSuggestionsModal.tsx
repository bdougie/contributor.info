import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Copy } from '@/components/ui/icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { fetchCodeOwners, fetchFileTree, fetchSuggestedCodeOwners, suggestReviewers, fetchRecentPullRequests, type MinimalPR } from '@/services/reviewer-suggestions.service';
import type { Repository } from '@/types/github';

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
  const [fileList, setFileList] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [useAI, setUseAI] = useState(true);
  type ReviewerSuggestionDTO = {
    username: string;
    avatarUrl?: string;
    score: number;
    reasoning: string[];
    relevantFiles: string[];
    recentActivity: boolean;
  };

  type SuggestionsResponse = {
    suggestions: {
      primary: ReviewerSuggestionDTO[];
      secondary: ReviewerSuggestionDTO[];
      additional: ReviewerSuggestionDTO[];
    };
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
    // Load recent PRs when active repository changes
    (async () => {
      if (!active?.id) return;
      const prs = await fetchRecentPullRequests(active.id, 25);
      setPullRequests(prs);
    })();
  }, [active?.id]);

  const owner = active?.owner || active?.full_name?.split('/')[0] || '';
  const repo = active?.name || active?.full_name?.split('/')[1] || '';

  const handleSuggest = async () => {
    if (!owner || !repo) return;
    setLoading(true);
    setError(null);
    try {
      const files = fileList
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await suggestReviewers(
        owner,
        repo,
        files.length ? files : undefined,
        undefined,
        prUrl || undefined
      );
      setSuggestions(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to get suggestions');
    } finally {
      setLoading(false);
    }
  };

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

        <div className="flex items-center gap-3 mb-4">
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
          {pullRequests.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">Pull Request</span>
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
                  <SelectValue placeholder="Select PR (recent)" />
                </SelectTrigger>
                <SelectContent>
                  {pullRequests.map((pr) => (
                    <SelectItem key={pr.github_number} value={String(pr.github_number)}>
                      #{pr.github_number} · {pr.title?.slice(0, 50) || 'Untitled'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="reviewers">Suggest Reviewers</TabsTrigger>
            <TabsTrigger value="codeowners">CODEOWNERS</TabsTrigger>
            <TabsTrigger value="generate">Generate CODEOWNERS</TabsTrigger>
          </TabsList>

          <TabsContent value="reviewers" className="mt-4 space-y-4">
            <div className="grid gap-3">
              <div>
                <div className="text-sm font-medium">Pull Request URL</div>
                <Textarea
                  className="mt-2 h-10"
                  placeholder="https://github.com/owner/repo/pull/123"
                  value={prUrl}
                  onChange={(e) => setPrUrl(e.target.value)}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Paste a PR URL to auto-analyze changed files, or enter files manually below.
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Changed files (one per line)</div>
                <Textarea
                  className="mt-2 h-32"
                  placeholder="src/components/Button.tsx\nsrc/pages/home.tsx"
                  value={fileList}
                  onChange={(e) => setFileList(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSuggest} disabled={loading || (!fileList.trim() && !prUrl.trim())}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Get Suggestions
              </Button>
              {error && <span className="text-sm text-red-500">{error}</span>}
              {suggestions && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      suggestions.suggestions.primary.map((s) => `@${s.username}`).join(' ')
                    )
                  }
                  title="Copy primary reviewers"
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy primary
                </Button>
              )}
            </div>
            {suggestions && (
              <div className="space-y-6">
                {(['primary', 'secondary', 'additional'] as const).map((group) => (
                  <div key={group}>
                    <h4 className="font-semibold capitalize">{group}</h4>
                    <ScrollArea className="h-auto max-h-72 rounded border">
                      <div className="p-2 space-y-2">
                        {suggestions.suggestions[group].length === 0 && (
                          <p className="text-sm text-muted-foreground">No suggestions.</p>
                        )}
                        {suggestions.suggestions[group].map((s) => (
                          <div key={s.username} className="flex items-center gap-3 rounded border p-2">
                            <Avatar className="h-6 w-6">
                              {s.avatarUrl ? (
                                <AvatarImage src={s.avatarUrl} alt={s.username} />
                              ) : (
                                <AvatarFallback>{s.username[0]?.toUpperCase()}</AvatarFallback>
                              )}
                            </Avatar>
                            <span className="font-medium">@{s.username}</span>
                            <Badge variant="secondary">Score {s.score}</Badge>
                            <div className="text-xs text-muted-foreground ml-auto truncate max-w-[40%]">
                              {s.reasoning.slice(0, 2).join(' • ')}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="ml-1"
                              onClick={() => navigator.clipboard.writeText(s.username)}
                              title="Copy username"
                              aria-label={`Copy @${s.username}`}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="codeowners" className="mt-4 space-y-3">
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
            {codeowners && (
              <ScrollArea className="h-72 rounded border">
                <pre className="p-3 bg-muted/30 text-xs whitespace-pre-wrap">
                  {codeowners.content || codeowners.message}
                </pre>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="generate" className="mt-4 space-y-3">
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
            {generated && (
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
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
