import { useState } from 'react';
import {
  Database,
  Upload,
  CheckCircle,
  XCircle,
  Info,
  ExternalLink,
  Loader2,
} from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { sendInngestEvent } from '@/lib/inngest/client-safe';

interface ProcessResult {
  added: string[];
  skipped: string[];
  errors: string[];
  total: number;
  repoIds?: Record<string, string>; // Map repo name to ID for backfill
}

interface BackfillJob {
  repoName: string;
  runId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  message?: string;
}

export function BulkAddRepos() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [includeBackfill, setIncludeBackfill] = useState(true);
  const [backfillDays, setBackfillDays] = useState(30);
  const [maxPRs, setMaxPRs] = useState(1000);
  const [backfillJobs, setBackfillJobs] = useState<Record<string, BackfillJob>>({});
  const { toast } = useToast();

  const parseRepoList = (text: string): string[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')) // Allow comments
      .filter((line) => {
        // Validate owner/repo format
        const parts = line.split('/');
        return parts.length === 2 && parts[0] && parts[1];
      });
  };

  const insertReposInBatches = async (
    repos: string[],
    batchSize: number = 15,
  ): Promise<ProcessResult> => {
    const result: ProcessResult = {
      added: [],
      skipped: [],
      errors: [],
      total: repos.length,
      repoIds: {},
    };

    // Check existing repos in repositories table
    const repoChecks = repos.map((repo) => {
      const [owner, name] = repo.split('/');
      return `(owner.eq.${owner},name.eq.${name})`;
    });

    // Check which repos already exist
    const { data: existingRepos, error: checkError } = await supabase
      .from('repositories')
      .select('id, owner, name')
      .or(repoChecks.join(','));

    if (checkError) {
      throw new Error(`Failed to check existing repos: ${checkError.message}`);
    }

    const existingMap = new Map<string, string>();
    existingRepos?.forEach((repo) => {
      const key = `${repo.owner}/${repo.name}`;
      existingMap.set(key, repo.id);
      result.repoIds![key] = repo.id;
    });

    const newRepos = repos.filter((repo) => !existingMap.has(repo));
    result.skipped = repos.filter((repo) => existingMap.has(repo));

    if (newRepos.length === 0) {
      setProgress(100);
      return result;
    }

    // Process in batches
    for (let i = 0; i < newRepos.length; i += batchSize) {
      const batch = newRepos.slice(i, i + batchSize);

      // First, create entries in repositories table
      const repoInsertData = batch.map((repo) => {
        const [owner, name] = repo.split('/');
        return {
          owner,
          name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      try {
        const { data: insertedRepos, error: repoError } = await supabase
          .from('repositories')
          .insert(repoInsertData)
          .select('id, owner, name');

        if (repoError) {
          console.error('Failed to insert repositories:', repoError);
          batch.forEach((repo) => result.errors.push(repo));
        } else if (insertedRepos) {
          // Store repo IDs for backfill
          insertedRepos.forEach((repo) => {
            const key = `${repo.owner}/${repo.name}`;
            result.repoIds![key] = repo.id;
          });

          // Then create entries in tracked_repositories
          const trackedInsertData = insertedRepos.map((repo) => ({
            organization_name: repo.owner,
            repository_name: repo.name,
            tracking_enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

          const { error: trackedError } = await supabase
            .from('tracked_repositories')
            .insert(trackedInsertData);

          if (trackedError) {
            console.error('Failed to insert tracked repos:', trackedError);
            batch.forEach((repo) => result.errors.push(repo));
          } else {
            result.added.push(...batch);
          }
        }
      } catch (error) {
        console.error("Error:", error);
        batch.forEach((repo) => result.errors.push(repo));
      }

      // Update progress
      const processed = Math.min(i + batchSize, newRepos.length) + result.skipped.length;
      setProgress((processed / repos.length) * 100);

      // Small delay to prevent overwhelming the database
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return result;
  };

  const handleProcess = async () => {
    if (!input.trim()) {
      toast({
        title: 'No input provided',
        description: 'Please paste a list of repositories to add.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      const repos = parseRepoList(input);

      if (repos.length === 0) {
        toast({
          title: 'No valid repositories found',
          description: "Please ensure repositories are in 'owner/repo' format.",
          variant: 'destructive',
        });
        return;
      }

      const result = await insertReposInBatches(repos);
      setResult(result);

      // Trigger backfill if requested
      if (includeBackfill && (result.added.length > 0 || result.skipped.length > 0)) {
        const reposToBackfill = [...result.added, ...result.skipped];

        // For large PR requests (>150), we need to create a progressive backfill
        if (maxPRs > 150) {
          // Create progressive backfill entries
          for (const repoName of reposToBackfill) {
            const repoId = result.repoIds?.[repoName];
            if (repoId) {
              try {
                // Insert progressive backfill state
                const { error: backfillError } = await supabase
                  .from('progressive_backfill_state')
                  .insert({
                    repository_id: repoId,
                    total_prs: maxPRs,
                    processed_prs: 0,
                    status: 'active',
                    chunk_size: 25,
                    metadata: {
                      max_prs_limit: maxPRs,
                      days_limit: backfillDays,
                      triggered_from: 'bulk_add_ui',
                      initiated_by: 'manual_bulk_add',
                    },
                  });

                if (backfillError) {
                  console.error('Failed to create progressive backfill:', backfillError);
                }
              } catch (error) {
                console.error("Error:", error);
              }
            }
          }

          toast({
            title: 'Progressive backfill created',
            description: `Fetching up to ${maxPRs} PRs for ${reposToBackfill.length} repositories. This will be processed by the automated workflow.`,
            variant: 'default',
          });
        } else {
          // For smaller requests, use the regular sync
          const backfillEvents = [];

          for (const repoName of reposToBackfill) {
            const repoId = result.repoIds?.[repoName];
            if (repoId) {
              backfillEvents.push({
                name: 'capture/repository.sync.graphql' as const,
                data: {
                  repositoryId: repoId,
                  days: backfillDays,
                  priority: 'high' as const,
                  reason: 'bulk_add_initial_backfill',
                },
              });
            }
          }

          if (backfillEvents.length > 0) {
            try {
              // Send events individually
              for (const event of backfillEvents) {
                await sendInngestEvent(event);
              }

              // Initialize backfill job tracking
              const jobs: Record<string, BackfillJob> = {};
              reposToBackfill.forEach((repoName) => {
                const repoId = result.repoIds?.[repoName];
                if (repoId) {
                  jobs[repoId] = {
                    repoName,
                    status: 'pending',
                    progress: 0,
                    total: Math.min(maxPRs, 150),
                  };
                }
              });
              setBackfillJobs(jobs);

              toast({
                title: 'Backfill started',
                description: `Fetching up to ${Math.min(maxPRs, 150)} PRs from the last ${backfillDays} days for ${backfillEvents.length} repositories`,
                variant: 'default',
              });
            } catch (error) {
              console.error("Error:", error);
              toast({
                title: 'Backfill failed to start',
                description: "Repositories were added but backfill couldn't be started",
                variant: 'destructive',
              });
            }
          }
        }
      }

      const successMessage = `${result.added.length} repos added, ${result.skipped.length} already tracked`;

      toast({
        title: 'Bulk add completed',
        description: successMessage,
        variant: result.errors.length > 0 ? 'destructive' : 'default',
      });
    } catch (error) {
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setInput('');
    setResult(null);
    setProgress(0);
    setBackfillJobs({});
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Database className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Bulk Add Repositories</h1>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Repository Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Textarea
                placeholder={`Paste repository list (one per line):
vue/vue
vitejs/vite
shadcn/ui
nestjs/nest
# Comments starting with # are ignored`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                disabled={isProcessing}
              />
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing repositories...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            <div className="mb-4 space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeBackfill}
                  onChange={(e) => setIncludeBackfill(e.target.checked)}
                  className="rounded"
                  disabled={isProcessing}
                />
                <span className="text-sm">Fetch historical PR data (recommended)</span>
              </label>
              {includeBackfill && (
                <>
                  <div className="ml-6 space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Maximum number of PRs to fetch:</label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="100"
                          max="1000"
                          step="100"
                          value={maxPRs}
                          onChange={(e) => setMaxPRs(Number(e.target.value))}
                          className="flex-1"
                          disabled={isProcessing}
                        />
                        <span className="text-sm font-medium w-20">{maxPRs} PRs</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Time window (days):</label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="7"
                          max="30"
                          value={backfillDays}
                          onChange={(e) => setBackfillDays(Number(e.target.value))}
                          className="flex-1"
                          disabled={isProcessing}
                        />
                        <span className="text-sm font-medium w-16">{backfillDays} days</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 space-y-1 ml-6">
                    <p>
                      • Fetches up to {maxPRs} PRs OR {backfillDays} days of history (whichever
                      limit is reached first)
                    </p>
                    <p>• Skips PRs already in the database</p>
                    <p>• Estimated time: ~{Math.ceil(maxPRs / 200)} minutes per repository</p>
                    <p>• For best performance, start with smaller values</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleProcess}
                disabled={isProcessing || !input.trim()}
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                {isProcessing ? 'Processing...' : 'Add Repositories'}
              </Button>

              <Button variant="outline" onClick={handleClear} disabled={isProcessing}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Results Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Added:</span>
                  <Badge variant="secondary">{result.added.length}</Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Skipped:</span>
                  <Badge variant="outline">{result.skipped.length}</Badge>
                </div>

                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium">Errors:</span>
                  <Badge variant="destructive">{result.errors.length}</Badge>
                </div>
              </div>

              {result.skipped.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Already tracked repositories:</p>
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded max-h-32 overflow-y-auto">
                    {result.skipped.join(', ')}
                  </div>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2 text-red-600">Failed to add:</p>
                  <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded max-h-32 overflow-y-auto">
                    {result.errors.join(', ')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {Object.keys(backfillJobs).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Backfill Progress</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open('https://app.inngest.com/env/production/runs', '_blank')
                  }
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View All Runs
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(backfillJobs).map(([repoId, job]) => (
                  <div key={repoId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {job.status === 'running' && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        )}
                        {job.status === 'completed' && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                        {job.status === 'failed' && <XCircle className="h-4 w-4 text-red-600" />}
                        {job.status === 'pending' && <Info className="h-4 w-4 text-gray-400" />}
                        <span className="font-medium text-sm">{job.repoName}</span>
                      </div>

                      {job.runId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const url = `https://app.inngest.com/env/production/runs/${job.runId}`;
                            window.open(url, '_blank');
                          }}
                          className="gap-1 text-xs"
                        >
                          View Run
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Progress value={(job.progress / job.total) * 100} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{job.message || `${job.progress}/${job.total} PRs`}</span>
                        <span>{Math.round((job.progress / job.total) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Repos</p>
                    <p className="font-medium">{Object.keys(backfillJobs).length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completed</p>
                    <p className="font-medium text-green-600">
                      {Object.values(backfillJobs).filter((j) => j.status === 'completed').length}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">In Progress</p>
                    <p className="font-medium text-blue-600">
                      {Object.values(backfillJobs).filter((j) => j.status === 'running').length}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
