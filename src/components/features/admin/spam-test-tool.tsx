import { useState } from 'react'
import { Search, AlertTriangle, CheckCircle, RefreshCw, ExternalLink, Bug } from '@/components/ui/icon';
import { supabase } from '@/lib/supabase';
import { SpamDetectionService } from '@/lib/spam';
import { PRTemplateService } from '@/lib/spam/PRTemplateService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { logAdminAction, useAdminGitHubId } from '@/hooks/use-admin-auth';

interface PRAnalysisResult {
  pr: unknown;
  spamScore: number;
  detectionReasons: string[];
  currentDbScore?: number;
  wasDetected: boolean;
  dataSource: 'database' | 'github_sync' | 'github_api' | 'mock';
  warnings: string[];
}

interface AdminGuidance {
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function SpamTestTool() {
  const [prUrl, setPrUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PRAnalysisResult | null>(null);
  const [manualFeedback, setManualFeedback] = useState('');
  const [adminGuidance, setAdminGuidance] = useState<AdminGuidance[]>([]);
  const [templateSyncLoading, setTemplateSyncLoading] = useState(false);
  const [markingSpam, setMarkingSpam] = useState(false);
  const adminGitHubId = useAdminGitHubId();
  const prTemplateService = new PRTemplateService();
  const { toast } = useToast();

  const parsePRUrl = (url: string) => {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (!match) throw new Error('Invalid GitHub PR URL format');
    return {
      owner: match[1],
      repo: match[2],
      prNumber: parseInt(match[3])
    };
  };

  const checkRepositoryTracking = async (owner: string, repo: string) => {
    const { data: trackedRepo, error } = await supabase
      .from('tracked_repositories')
      .select('*')
      .eq('organization_name', owner)
      .eq('repository_name', repo)
      .maybeSingle();

    return { isTracked: !!trackedRepo && !error, trackedRepo };
  };

  const addRepositoryToTracking = async (owner: string, repo: string) => {
    const { error } = await supabase
      .from('tracked_repositories')
      .insert({
        organization_name: owner,
        repository_name: repo,
        tracking_enabled: true,
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to add repository to tracking: ${error.message}`);
    }

    // Log admin action
    if (adminGitHubId) {
      await logAdminAction(
        adminGitHubId,
        'repository_added_to_tracking',
        'repository',
        `${owner}/${repo}`,
        { reason: 'spam_test_tool_request' }
      );
    }
  };

  const ensureRepositoryTemplate = async (owner: string, repo: string) => {
    try {
      setTemplateSyncLoading(true);
      
      // Get or create repository in database
      let { data: repository, error } = await supabase
        .from('repositories')
        .select('id, pr_template_content, pr_template_fetched_at')
        .eq('owner', owner)
        .eq('name', repo)
        .maybeSingle();

      if (error && error.code === 'PGRST116') {
        // Repository doesn't exist, create it
        const { data: newRepo, error: insertError } = await supabase
          .from('repositories')
          .insert({
            owner,
            name: repo,
            full_name: `${owner}/${repo}`,
            tracking_enabled: true,
            created_at: new Date().toISOString()
          })
          .select('id')
          .maybeSingle();

        if (insertError) {
          throw new Error(`Failed to create repository: ${insertError.message}`);
        }
        repository = {
          id: newRepo!.id,
          pr_template_content: null,
          pr_template_fetched_at: null
        };
      } else if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      if (!repository) {
        throw new Error('Failed to get repository ID');
      }

      // Fetch and cache PR template
      const template = await prTemplateService.ensurePRTemplate(repository.id, owner, repo);
      
      if (template) {
        setAdminGuidance(prev => [...prev, {
          type: 'info',
          title: 'PR Template Cached',
          message: `Successfully fetched and cached PR template for ${owner}/${repo}. Repository-specific spam patterns have been generated.`
        }]);
      } else {
        setAdminGuidance(prev => [...prev, {
          type: 'warning',
          title: 'No PR Template Found',
          message: `No PR template found for ${owner}/${repo}. Using fallback spam detection patterns.`
        }]);
      }

      return template;
    } catch (error) {
      setAdminGuidance(prev => [...prev, {
        type: 'error',
        title: 'Template Sync Failed',
        message: `Failed to sync PR template: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
      throw error;
    } finally {
      setTemplateSyncLoading(false);
    }
  };

  const analyzePR = async () => {
    if (!prUrl.trim()) return;
    
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setAdminGuidance([]);

      const { owner, repo, prNumber } = parsePRUrl(prUrl);
      const warnings: string[] = [];
      let dataSource: 'database' | 'github_sync' | 'github_api' | 'mock' = 'database';

      // Check if repository is tracked
      const { isTracked } = await checkRepositoryTracking(owner, repo);
      
      if (!isTracked) {
        setAdminGuidance([{
          type: 'warning',
          title: 'Repository Not Tracked',
          message: `The repository ${owner}/${repo} is not in our tracking system. This means we don't have historical data for spam analysis. You can add it to tracking to enable full analysis.`,
          action: {
            label: 'Add to Tracking',
            onClick: async () => {
              try {
                await addRepositoryToTracking(owner, repo);
                setAdminGuidance(prev => prev.filter(g => g.title !== 'Repository Not Tracked'));
                setAdminGuidance(prev => [...prev, {
                  type: 'info',
                  title: 'Repository Added',
                  message: `Successfully added ${owner}/${repo} to tracking. Future syncs will include this repository's data.`
                }]);
              } catch (err) {
                setAdminGuidance(prev => [...prev, {
                  type: 'error',
                  title: 'Failed to Add Repository',
                  message: err instanceof Error ? err.message : 'Unknown error occurred'
                }]);
              }
            }
          }
        }]);
        warnings.push('Repository not tracked - limited historical context available');
      }

      // Ensure PR template is cached for repository-specific analysis
      try {
        await ensureRepositoryTemplate(owner, repo);
      } catch (templateError) {
        console.warn('Template sync failed:', templateError);
        warnings.push('Template sync failed - using generic patterns');
      }

      // First check if PR exists in our database
      // Get repository ID first since nested filtering doesn't work reliably
      const { data: repositoryData, error: repoError } = await supabase
        .from('repositories')
        .select('id')
        .eq('owner', owner)
        .eq('name', repo)
        .maybeSingle();

      let existingPR = null;
      let dbError = repoError;

      if (repositoryData && !repoError) {
        const { data: prData, error: prQueryError } = await supabase
          .from('pull_requests')
          .select(`
            *,
            repository:repositories(owner, name),
            author:contributors!pull_requests_contributor_id_fkey(username)
          `)
          .eq('repository_id', repositoryData.id)
          .eq('number', prNumber)
          .maybeSingle();
        
        existingPR = prData;
        dbError = prQueryError;
      }

      let prData = existingPR;
      let currentDbScore = existingPR?.spam_score;

      // If not in database, fetch from GitHub
      if (dbError || !existingPR) {
        try {
          // Call GitHub sync to fetch the PR
          const syncResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-sync`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              owner,
              repository: repo,
              force_refresh: true
            })
          });

          if (!syncResponse.ok) {
            const _ = await syncResponse.text();
            throw new Error(`GitHub sync failed: ${syncResponse.status} ${errorText}`);
          }

          // Wait a moment for the sync to complete
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Try to get the PR from database again
          // Simplified query without foreign key syntax to avoid PostgREST issues
          const { data: newPR, error: newError } = await supabase
            .from('pull_requests')
            .select(`
              *,
              repository:repositories(owner, name),
              author:contributors(username)
            `)
            .eq('repository.owner', owner)
            .eq('repository.name', repo)
            .eq('number', prNumber)
            .maybeSingle();

          if (newError && newError.code !== 'PGRST116') {
            throw new Error(`Database query failed: ${newError.message}`);
          }

          prData = newPR;
          currentDbScore = newPR?.spam_score;
        } catch (syncError) {
          // If sync fails, try to fetch directly from GitHub API as fallback
          console.warn('GitHub sync failed, trying direct GitHub API:', syncError);
          dataSource = 'github_api';
          warnings.push('GitHub sync service unavailable - using direct API');
          
          try {
            const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`);
            if (githubResponse.ok) {
              const githubPR = await githubResponse.json();
              
              // Transform GitHub API response to our format
              prData = {
                id: `github-${githubPR.id}`,
                title: githubPR.title,
                body: githubPR.body || '',
                number: githubPR.number,
                html_url: githubPR.html_url,
                author_id: `github-${githubPR.user.id}`,
                author: {
                  username: githubPR.user.login
                },
                repository: {
                  owner,
                  name: repo
                },
                created_at: githubPR.created_at,
                additions: githubPR.additions || 0,
                deletions: githubPR.deletions || 0,
                changed_files: githubPR.changed_files || 0
              };
              currentDbScore = null;

              setAdminGuidance(prev => [...prev, {
                type: 'warning',
                title: 'Using GitHub API Fallback',
                message: 'Could not sync through our system. Data fetched directly from GitHub API. Consider checking the GitHub sync service status.',
                action: {
                  label: 'Check Sync Status',
                  onClick: () => window.open('/dev/sync-test', '_blank')
                }
              }]);
            } else if (githubResponse.status === 404) {
              throw new Error(`PR #${prNumber} not found in ${owner}/${repo}. Please verify the URL is correct.`);
            } else if (githubResponse.status === 403) {
              throw new Error('GitHub API rate limit exceeded or access denied. Try again later.');
            } else {
              throw new Error(`GitHub API returned ${githubResponse.status}`);
            }
          } catch (githubError) {
            console.warn('Direct GitHub API also failed:', githubError);
            dataSource = 'mock';
            warnings.push('All data sources failed - using mock _data for algorithm testing');
            
            setAdminGuidance(prev => [...prev, {
              type: 'error',
              title: 'All Data Sources Failed',
              message: 'Could not fetch PR data from database, sync service, or GitHub API. Using mock data for testing. This indicates a system-wide issue.',
              action: {
                label: 'Check System Status',
                onClick: () => window.open('/admin/performance-monitoring', '_blank')
              }
            }]);
            
            // Final fallback - create mock data
            prData = {
              id: `mock-${owner}-${repo}-${prNumber}`,
              title: `PR #${prNumber} from ${owner}/${repo}`,
              body: 'Unable to fetch PR description - analyzing with limited data',
              number: prNumber,
              html_url: prUrl,
              author_id: 'mock-contributor',
              author: {
                username: 'unknown-user'
              },
              repository: {
                owner,
                name: repo
              },
              created_at: new Date().toISOString(),
              additions: 0,
              deletions: 0,
              changed_files: 0
            };
            currentDbScore = null;
          }
        }
      }

      if (!prData) {
        throw new Error('Could not fetch PR data from GitHub or _database');
      }

      // Run spam detection analysis
      const spamService = new SpamDetectionService();
      const analysis = await spamService.detectSpam({
        id: prData.id,
        title: prData.title,
        body: prData.body || '',
        number: prData.number,
        html_url: prData.html_url,
        author: {
          id: prData.author_id || 0,
          login: prData.author?.username || 'unknown',
          created_at: prData.author?.created_at || new Date().toISOString()
        },
        repository: {
          full_name: `${prData.repository?.owner}/${prData.repository?.name}` || 'unknown/unknown'
        },
        created_at: prData.created_at,
        additions: prData.additions || 0,
        deletions: prData.deletions || 0,
        changed_files: prData.changed_files || 0
      });

      // Add success guidance based on data source
      if (dataSource === '_database') {
        setAdminGuidance(prev => [...prev, {
          type: 'info',
          title: 'Using Database Data',
          message: 'PR data found in database with complete historical context. This provides the most accurate spam analysis.'
        }]);
      } else if (existingPR && !dbError) {
        // This means we successfully synced from GitHub
        dataSource = 'github_sync';
        warnings.push('Data synced from GitHub - fresh but no historical context yet');
        setAdminGuidance(prev => [...prev, {
          type: 'info',
          title: 'Synced from GitHub',
          message: 'PR data freshly synced from GitHub. Analysis based on current state without historical context.'
        }]);
      }

      setResult({
        pr: prData,
        spamScore: analysis.spam_score,
        detectionReasons: analysis.reasons,
        currentDbScore,
        wasDetected: (currentDbScore || 0) > 50,
        dataSource,
        warnings
      });

      // Show success toast for analysis completion
      toast({
        title: "Analysis Complete",
        description: `PR #${prNumber} analyzed. Spam score: ${analysis.spam_score}%. Data source: ${dataSource.replace('_', ' ')}.`,
        variant: "default"
      });

    } catch (err) {
      console.error('Error analyzing PR:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze PR';
      setError(errorMessage);
      
      // Show error toast for analysis failure
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsSpam = async (isSpam: boolean) => {
    if (!result || !adminGitHubId) {
      toast({
        title: "Cannot mark spam",
        description: "Missing PR data or admin authentication",
        variant: "destructive"
      });
      return;
    }

    setMarkingSpam(true);
    try {
      // Only create spam detection record if we have real database IDs (not GitHub API fallback)
      if (result.pr.id && !result.pr.id.toString().startsWith('github-') && !result.pr.id.toString().startsWith('mock-')) {
        // Create spam detection record
        const { error: insertError } = await supabase
          .from('spam_detections')
          .insert({
            pr_id: result.pr.id,
            contributor_id: result.pr.author_id,
            spam_score: result.spamScore, // Keep 0-100 scale
            status: isSpam ? 'confirmed' : 'false_positive',
            admin_reviewed_by: adminGitHubId,
            admin_reviewed_at: new Date().toISOString(),
            detection_reasons: result.detectionReasons,
            detected_at: new Date().toISOString()
          });

        if (insertError) {
          throw insertError;
        }
      }

      // Update PR spam score in database (only for real _database records)
      if (result.pr.id && !result.pr.id.toString().startsWith('github-') && !result.pr.id.toString().startsWith('mock-')) {
        const { error: updateError } = await supabase
          .from('pull_requests')
          .update({
            spam_score: isSpam ? Math.max(result.spamScore, 75) : Math.min(result.spamScore, 25),
            is_spam: isSpam
          })
          .eq('id', result.pr.id);

        if (updateError) {
          throw updateError;
        }
      }

      // Log admin action
      await logAdminAction(
        adminGitHubId,
        'manual_spam_classification',
        'pull_request',
        result.pr.id,
        {
          pr_url: result.pr.html_url,
          original_score: result.spamScore,
          manual_classification: isSpam ? 'spam' : 'not_spam',
          feedback: manualFeedback.trim() || undefined
        }
      );

      // Update local state
      const newScore = isSpam ? Math.max(result.spamScore, 75) : Math.min(result.spamScore, 25);
      setResult(prev => prev ? { ...prev, currentDbScore: newScore } : null);
      setError(null);

      // Show success toast
      toast({
        title: isSpam ? "Marked as Spam" : "Marked as Legitimate",
        description: `PR #${result.pr.number} has been successfully classified. Spam score updated to ${newScore}%.`,
        variant: "default"
      });

      // Clear feedback after successful submission
      setManualFeedback('');
      
    } catch (err) {
      console.error('Error updating spam status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update spam status';
      setError(errorMessage);
      
      // Show error toast
      toast({
        title: "Failed to update spam status",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setMarkingSpam(false);
    }
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 75) return "destructive";
    if (score >= 50) return "secondary";
    if (score >= 25) return "outline";
    return "default";
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-orange-100 text-orange-600">
          <Bug className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Spam Test Tool</h1>
          <p className="text-muted-foreground">
            Test and improve spam detection on individual PRs
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Admin Guidance */}
      {adminGuidance.length > 0 && (
        <div className="space-y-3 mb-6">
          {adminGuidance.map((guidance, index) => (
            <Alert 
              key={index} 
              variant={guidance.type === 'error' ? 'destructive' : 'default'}
              className={
                guidance.type === 'warning'
? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950' :
                guidance.type === 'info' ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950' : ''
              }
            >
              <AlertTriangle className={`h-4 w-4 ${
                guidance.type === 'error'
? 'text-red-600 dark:text-red-400' :
                guidance.type === 'warning'
? 'text-yellow-600 dark:text-yellow-400' :
                'text-blue-600 dark:text-blue-400'
              }`} />
              <div className="flex-1">
                <div className="font-semibold">{guidance.title}</div>
                <AlertDescription>{guidance.message}</AlertDescription>
                {guidance.action && (
                  <Button 
                    onClick={guidance.action.onClick}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    {guidance.action.label}
                  </Button>
                )}
              </div>
            </Alert>
          ))}
        </div>
      )}

      {/* Input Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Analyze Pull Request</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Enter GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)"
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
              />
            </div>
            <Button onClick={analyzePR} disabled={loading || !prUrl.trim()}>
              {loading
? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )
: (
                <Search className="h-4 w-4 mr-2" />
              )}
              Analyze
            </Button>
            <Button 
              onClick={() => setPrUrl('https://github.com/continuedev/continue/pull/6274')}
              variant="outline"
              disabled={loading}
            >
              Test Continue PR
            </Button>
            {templateSyncLoading && (
              <Button disabled variant="outline">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing Template...
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* PR Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                PR Analysis Results
                <Link 
                  to={result.pr.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">{result.pr.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    by {result.pr.author?.username || 'unknown'} • PR #{result.pr.number}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Current DB Score</span>
                    <div className="font-semibold">
                      {result.currentDbScore !== null && result.currentDbScore !== undefined
? (
                        <Badge variant={getScoreBadgeVariant(result.currentDbScore)}>
                          {result.currentDbScore}%
                        </Badge>
                      )
: (
                        <Badge variant="outline" className="text-xs">
                          📊 -
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">New Analysis Score</span>
                    <div className="font-semibold">
                      <Badge variant={getScoreBadgeVariant(result.spamScore)}>
                        {result.spamScore}%
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Detection Status</span>
                    <div className="font-semibold">
                      {result.wasDetected
? (
                        <Badge variant="destructive">Detected</Badge>
                      )
: (
                        <Badge variant="outline">Missed</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Data Source</span>
                    <div className="font-semibold">
                      <Badge variant={
                        result.dataSource === 'database'
? 'default' :
                        result.dataSource === 'github_sync'
? 'secondary' :
                        result.dataSource === 'github_api' ? 'outline' : 'destructive'
                      }>
                        {result.dataSource.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Changes</span>
                    <div className="text-sm">
                      +{result.pr.additions} -{result.pr.deletions}
                    </div>
                  </div>
                </div>

                {result.warnings.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Analysis Warnings:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {result.warnings.map((warning, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs text-yellow-700 border-yellow-300">
                          {warning}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-sm text-muted-foreground">Detection Reasons:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {result.detectionReasons.map((reason, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </div>

                {result.pr.body && (
                  <div>
                    <span className="text-sm text-muted-foreground">PR Description:</span>
                    <div className="mt-1 p-3 bg-muted rounded-md text-sm max-h-32 overflow-y-auto">
                      {result.pr.body}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Manual Classification */}
          <Card>
            <CardHeader>
              <CardTitle>Manual Classification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Feedback (optional):</label>
                  <Textarea
                    placeholder="Explain why this PR is/isn't spam to help improve detection..."
                    value={manualFeedback}
                    onChange={(e) => setManualFeedback(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-4">
                  <Button
                    onClick={() => markAsSpam(true)}
                    variant="destructive"
                    disabled={markingSpam}
                  >
                    {markingSpam
? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    )
: (
                      <AlertTriangle className="h-4 w-4 mr-2" />
                    )}
                    {markingSpam ? 'Marking...' : 'Mark as Spam'}
                  </Button>
                  <Button
                    onClick={() => markAsSpam(false)}
                    variant="default"
                    disabled={markingSpam}
                  >
                    {markingSpam
? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    )
: (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    {markingSpam ? 'Marking...' : 'Mark as Legitimate'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}