import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Self-contained spam detection types and logic
interface PullRequestData {
  id: string;
  title: string;
  body?: string;
  number: number;
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  html_url: string;
  author: {
    id: number;
    login: string;
    created_at?: string;
    public_repos?: number;
    followers?: number;
    following?: number;
    bio?: string;
    company?: string;
    location?: string;
  };
  repository: {
    full_name: string;
  };
}

interface SpamDetectionResult {
  spam_score: number;
  is_spam: boolean;
  flags: any;
  detected_at: string;
  confidence: number;
  reasons: string[];
}

// Spam thresholds
const SPAM_THRESHOLDS = {
  LEGITIMATE: 25,
  WARNING: 50,
  LIKELY_SPAM: 75,
  DEFINITE_SPAM: 90,
} as const;

// Self-contained spam detection service
class SpamDetectionService {
  async detectSpam(pr: PullRequestData): Promise<SpamDetectionResult> {
    const startTime = Date.now();

    try {
      if (!pr || !pr.author) {
        throw new Error('Invalid PR data: missing required fields');
      }

      // Analyze different aspects
      const contentScore = this.analyzeContent(pr);
      const accountScore = this.analyzeAccount(pr);
      const prScore = this.analyzePRCharacteristics(pr);

      // Calculate composite score
      const spamScore = Math.min(
        Math.round(contentScore * 0.4 + accountScore * 0.4 + prScore * 0.2),
        100
      );

      const isSpam = spamScore >= SPAM_THRESHOLDS.LIKELY_SPAM;
      const confidence = this.calculateConfidence(spamScore);
      const reasons = this.generateReasons(pr, spamScore);

      return {
        spam_score: spamScore,
        is_spam: isSpam,
        flags: { content_score: contentScore, account_score: accountScore, pr_score: prScore },
        detected_at: new Date().toISOString(),
        confidence,
        reasons,
      };
    } catch (error) {
      console.error('Error during spam detection:', error);
      return {
        spam_score: 0,
        is_spam: false,
        flags: {},
        detected_at: new Date().toISOString(),
        confidence: 0,
        reasons: ['Error during spam detection'],
      };
    }
  }

  private analyzeContent(pr: PullRequestData): number {
    const description = pr.body || '';
    const title = pr.title || '';
    let score = 0;

    // Empty or very short description
    if (description.length === 0) score += 40;
    else if (description.length < 10) score += 30;
    else if (description.length < 20) score += 20;

    // Check for spam patterns
    const spamPatterns = [
      /^(fix|update|add|remove|change)\s*$/i,
      /hacktoberfest/i,
      /please merge/i,
      /first contribution/i,
      /beginner friendly/i,
    ];

    const text = `${title} ${description}`.toLowerCase();
    const matchedPatterns = spamPatterns.filter(pattern => pattern.test(text));
    score += matchedPatterns.length * 15;

    // Very generic titles
    if (/^(fix|update|add|remove|change|test)\s*\.?$/i.test(title)) {
      score += 25;
    }

    return Math.min(score, 100);
  }

  private analyzeAccount(pr: PullRequestData): number {
    let score = 0;
    const author = pr.author;

    // Account age analysis
    if (author.created_at) {
      const accountAge = (new Date().getTime() - new Date(author.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (accountAge <= 7) score += 50;
      else if (accountAge <= 30) score += 30;
      else if (accountAge <= 90) score += 15;
    }

    // Profile completeness
    const hasProfile = author.bio || author.company || author.location;
    if (!hasProfile) score += 20;

    // Repository and follower counts (if available)
    if (author.public_repos !== undefined && author.public_repos === 0) score += 15;
    if (author.followers !== undefined && author.followers === 0) score += 10;

    return Math.min(score, 100);
  }

  private analyzePRCharacteristics(pr: PullRequestData): number {
    let score = 0;
    const totalChanges = pr.additions + pr.deletions;
    const descriptionLength = (pr.body || '').length;

    // Single file changes with no context
    if (pr.changed_files === 1 && descriptionLength < 20) {
      score += 30;
    }

    // Large changes with inadequate description
    if (totalChanges > 100 && descriptionLength < 50) {
      score += 25;
    }

    // Very large PRs (often spam)
    if (pr.changed_files > 20) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  private calculateConfidence(spamScore: number): number {
    if (spamScore > 80 || spamScore < 20) return 0.8;
    if (spamScore > 70 || spamScore < 30) return 0.7;
    return 0.6;
  }

  private generateReasons(pr: PullRequestData, spamScore: number): string[] {
    const reasons: string[] = [];

    if ((pr.body || '').length === 0) {
      reasons.push('Empty description');
    } else if ((pr.body || '').length < 10) {
      reasons.push('Very short description');
    }

    if (/^(fix|update|add|remove|change|test)\s*\.?$/i.test(pr.title)) {
      reasons.push('Generic title');
    }

    if (pr.author.created_at) {
      const accountAge = (new Date().getTime() - new Date(pr.author.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (accountAge <= 7) {
        reasons.push(`Very new account (${Math.round(accountAge)} days old)`);
      } else if (accountAge <= 30) {
        reasons.push(`New account (${Math.round(accountAge)} days old)`);
      }
    }

    if (pr.changed_files === 1 && (pr.body || '').length < 20) {
      reasons.push('Single file change with no context');
    }

    if (spamScore >= SPAM_THRESHOLDS.LIKELY_SPAM) {
      reasons.push('Multiple spam indicators detected');
    }

    return reasons.length > 0 ? reasons : ['Automated analysis completed'];
  }
}

// Batch processing function
async function batchProcessPRsForSpam(
  supabase: any,
  repositoryId: string,
  limit: number = 100
): Promise<{ processed: number; errors: number }> {
  const spamService = new SpamDetectionService();
  let processed = 0;
  let errors = 0;
  let offset = 0;
  const batchSize = 10;

  console.log(`[Spam Detection] Starting batch processing for repository ${repositoryId}`);

  while (true) {
    // Fetch PRs without spam scores - Fix the foreign key reference
    const { data: prs, error: fetchError } = await supabase
      .from('pull_requests')
      .select(`
        id,
        github_id,
        number,
        title,
        body,
        additions,
        deletions,
        changed_files,
        created_at,
        html_url,
        author:contributors!pull_requests_author_id_fkey(
          id,
          github_id,
          username,
          created_at,
          first_seen_at
        ),
        repository:repositories(
          full_name
        )
      `)
      .eq('repository_id', repositoryId)
      .is('spam_score', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fetchError) {
      console.error(`[Spam Detection] Error fetching PRs:`, fetchError);
      break;
    }

    if (!prs || prs.length === 0) {
      break;
    }

    // Process PRs in concurrent batches
    for (let i = 0; i < prs.length; i += batchSize) {
      const batch = prs.slice(i, i + batchSize);
      const batchPromises = batch.map(async (pr: any) => {
        try {
          // Convert to spam detection format
          const prData: PullRequestData = {
            id: pr.id,
            title: pr.title,
            body: pr.body || '',
            number: pr.number,
            additions: pr.additions,
            deletions: pr.deletions,
            changed_files: pr.changed_files,
            created_at: pr.created_at,
            html_url: pr.html_url,
            author: {
              id: pr.author.github_id,
              login: pr.author.username,
              created_at: pr.author.created_at || pr.author.first_seen_at,
            },
            repository: {
              full_name: pr.repository.full_name,
            },
          };

          // Run spam detection
          const spamResult = await spamService.detectSpam(prData);

          // Update PR with spam detection results
          const { error: updateError } = await supabase
            .from('pull_requests')
            .update({
              spam_score: spamResult.spam_score,
              spam_flags: spamResult.flags,
              is_spam: spamResult.is_spam,
              spam_detected_at: spamResult.detected_at,
            })
            .eq('id', pr.id);

          if (updateError) {
            console.error(`[Spam Detection] Error updating PR ${pr.number}:`, updateError);
            return { success: false, prNumber: pr.number };
          } else {
            return { success: true, prNumber: pr.number };
          }
        } catch (error) {
          console.error(`[Spam Detection] Error processing PR ${pr.number}:`, error);
          return { success: false, prNumber: pr.number };
        }
      });

      const results = await Promise.all(batchPromises);
      results.forEach((result) => {
        if (result.success) {
          processed++;
        } else {
          errors++;
        }
      });

      console.log(
        `[Spam Detection] Batch complete. Total processed: ${processed}, errors: ${errors}`
      );
    }

    offset += limit;
  }

  console.log(
    `[Spam Detection] Batch processing complete. Processed: ${processed}, Errors: ${errors}`
  );

  return { processed, errors };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpamDetectionRequest {
  // Single PR detection
  pr_id?: string;

  // Batch detection
  repository_id?: string;
  repository_owner?: string;
  repository_name?: string;
  analyze_all?: boolean; // Analyze all repositories

  // Options
  limit?: number;
  force_recheck?: boolean; // Re-analyze PRs that already have spam scores
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[Spam Detection] Received spam detection request');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse request body
    const body: SpamDetectionRequest = await req.json().catch(() => ({}));
    const {
      pr_id,
      repository_id,
      repository_owner,
      repository_name,
      analyze_all = false,
      limit = 100,
      force_recheck = false,
    } = body;

    console.log('[Spam Detection] Request:', {
      pr_id,
      repository_id,
      repository_owner,
      repository_name,
      analyze_all,
      limit,
      force_recheck,
    });

    const spamService = new SpamDetectionService();

    // Single PR detection
    if (pr_id) {
      console.log('[Spam Detection] Analyzing single PR: %s', pr_id);

            // Fetch PR data with corrected foreign key reference
      const { data: pr, error: prError } = await supabase
        .from('pull_requests')
        .select(
          `
          id,
          github_id,
          number,
          title,
          body,
          additions,
          deletions,
          changed_files,
          created_at,
          html_url,
          spam_score,
          author:contributors!pull_requests_author_id_fkey(
            id,
            github_id,
            username,
            created_at,
            first_seen_at
          ),
          repository:repositories(
            full_name
          )
        `
        )
        .eq('id', pr_id)
        .maybeSingle();

      if (prError || !pr) {
        throw new Error(`Pull request not found: ${pr_id}`);
      }

      // Skip if already has spam score and not forcing recheck
      if (pr.spam_score !== null && !force_recheck) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'PR already has spam score',
            spam_score: pr.spam_score,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Convert to spam detection format
      const prData: PullRequestData = {
        id: pr.id,
        title: pr.title,
        body: pr.body || '',
        number: pr.number,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        created_at: pr.created_at,
        html_url: pr.html_url,
        author: {
          id: pr.author.github_id,
          login: pr.author.username,
          created_at: pr.author.created_at || pr.author.first_seen_at,
        },
        repository: {
          full_name: pr.repository.full_name,
        },
      };

      // Run spam detection
      const spamResult = await spamService.detectSpam(prData);

      // Update PR with spam detection results
      const { error: updateError } = await supabase
        .from('pull_requests')
        .update({
          spam_score: spamResult.spam_score,
          spam_flags: spamResult.flags,
          is_spam: spamResult.is_spam,
          spam_detected_at: spamResult.detected_at,
        })
        .eq('id', pr.id);

      if (updateError) {
        throw new Error(`Failed to update PR: ${updateError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          pr_id: pr.id,
          pr_number: pr.number,
          spam_result: spamResult,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Analyze all repositories
    if (analyze_all) {
      console.log('[Spam Detection] Analyzing all repositories');

      // Get all repositories with PRs
      const { data: repositories, error: reposError } = await supabase
        .from('repositories')
        .select('id, full_name')
        .order('full_name');

      if (reposError) {
        throw new Error(`Failed to fetch repositories: ${reposError.message}`);
      }

      if (!repositories || repositories.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No repositories found',
            processed: 0,
            errors: 0,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      let totalProcessed = 0;
      let totalErrors = 0;
      const results = [];

      // Process each repository
      for (const repo of repositories) {
        try {
          console.log('[Spam Detection] Processing repository: %s', repo.full_name);

          // If force_recheck is true, clear existing spam scores first
          if (force_recheck) {
            console.log(
              '[Spam Detection] Force recheck enabled for %s, clearing existing spam scores',
              repo.full_name
            );
            const { error: clearError } = await supabase
              .from('pull_requests')
              .update({
                spam_score: null,
                spam_flags: null,
                is_spam: null,
                spam_detected_at: null,
              })
              .eq('repository_id', repo.id);

            if (clearError) {
              console.warn(
                `[Spam Detection] Error clearing spam scores for ${repo.full_name}:`,
                clearError
              );
            }
          }

          // Run batch processing for this repository
          const { processed, errors } = await batchProcessPRsForSpam(supabase, repo.id, limit);

          totalProcessed += processed;
          totalErrors += errors;

          results.push({
            repository_id: repo.id,
            repository_name: repo.full_name,
            processed,
            errors,
          });

          console.log(
            '[Spam Detection] Completed %s: ${processed} processed, ${errors} errors',
            repo.full_name
          );
        } catch (repoError) {
          console.error(
            `[Spam Detection] Error processing repository ${repo.full_name}:`,
            repoError
          );
          totalErrors++;
          results.push({
            repository_id: repo.id,
            repository_name: repo.full_name,
            processed: 0,
            errors: 1,
            error: repoError.message,
          });
        }
      }

      // Get overall statistics
      const { data: overallStats, error: statsError } = await supabase
        .from('pull_requests')
        .select('spam_score, is_spam')
        .not('spam_score', 'is', null);

      let avgScore = 0;
      let spamCount = 0;

      if (overallStats && overallStats.length > 0) {
        avgScore = overallStats.reduce((sum, pr) => sum + pr.spam_score, 0) / overallStats.length;
        spamCount = overallStats.filter((pr) => pr.is_spam).length;
      }

      return new Response(
        JSON.stringify({
          success: true,
          analyze_all: true,
          total_repositories: repositories.length,
          total_processed: totalProcessed,
          total_errors: totalErrors,
          results,
          overall_stats: {
            total_analyzed: overallStats?.length || 0,
            spam_count: spamCount,
            spam_percentage: overallStats?.length ? (spamCount / overallStats.length) * 100 : 0,
            avg_spam_score: Math.round(avgScore * 10) / 10,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Batch detection for repository
    if (repository_id || (repository_owner && repository_name)) {
      let repoId = repository_id;

      // If we have owner/name but not ID, look it up
      if (!repoId && repository_owner && repository_name) {
        const { data: repo, error: repoError } = await supabase
          .from('repositories')
          .select('id')
          .eq('owner', repository_owner)
          .eq('name', repository_name)
          .maybeSingle();

        if (repoError || !repo) {
          throw new Error(`Repository not found: ${repository_owner}/${repository_name}`);
        }

        repoId = repo.id;
      }

      console.log('[Spam Detection] Running batch detection for repository: %s', repoId);

      // If force_recheck is true, clear existing spam scores first
      if (force_recheck) {
        console.log('[Spam Detection] Force recheck enabled, clearing existing spam scores');
        const { error: clearError } = await supabase
          .from('pull_requests')
          .update({
            spam_score: null,
            spam_flags: null,
            is_spam: null,
            spam_detected_at: null,
          })
          .eq('repository_id', repoId);

        if (clearError) {
          console.warn('[Spam Detection] Error clearing spam scores:', clearError);
        }
      }

      // Run batch processing
      const { processed, errors } = await batchProcessPRsForSpam(supabase, repoId, limit);

      // Get summary statistics
      const { data: stats, error: statsError } = await supabase
        .from('pull_requests')
        .select('spam_score, is_spam')
        .eq('repository_id', repoId)
        .not('spam_score', 'is', null);

      let avgScore = 0;
      let spamCount = 0;

      if (stats && stats.length > 0) {
        avgScore = stats.reduce((sum, pr) => sum + pr.spam_score, 0) / stats.length;
        spamCount = stats.filter((pr) => pr.is_spam).length;
      }

      return new Response(
        JSON.stringify({
          success: true,
          repository_id: repoId,
          processed,
          errors,
          stats: {
            total_analyzed: stats?.length || 0,
            spam_count: spamCount,
            spam_percentage: stats?.length ? (spamCount / stats.length) * 100 : 0,
            avg_spam_score: Math.round(avgScore * 10) / 10,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // No valid parameters provided
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid request. Provide either pr_id, repository details, or analyze_all=true.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  } catch (error) {
    console.error('[Spam Detection] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
