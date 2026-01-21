/**
 * Service for submitting and managing community spam reports
 * Issue #1622: Known Spammer Community Database
 */

import { getSupabase } from '@/lib/supabase-lazy';
import { logger } from '@/lib/logger';
import type {
  SpamReportInput,
  SpamReportSubmitResult,
  RateLimitResult,
  SpamReport,
} from './types/spam-report.types';
import { parseGitHubPRUrl } from './types/spam-report.types';

/**
 * Check rate limits before allowing a spam report submission
 */
export async function checkRateLimit(userId?: string): Promise<RateLimitResult> {
  const supabase = await getSupabase();

  const { data, error } = await supabase.rpc('check_spam_report_rate_limit', {
    p_user_id: userId || null,
    p_ip_hash: null,
  });

  if (error) {
    logger.error('Error checking rate limit', { error });
    // Fail-closed: deny on error to prevent abuse during outages
    return {
      allowed: false,
      message: 'Unable to verify rate limit. Please try again.',
    };
  }

  return data as RateLimitResult;
}

/**
 * Fetch PR author information from GitHub using the user's authenticated token
 */
async function fetchPRAuthor(
  owner: string,
  repo: string,
  prNumber: number,
  githubToken: string | null
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };

    // Use user's GitHub token from Supabase OAuth
    if (githubToken) {
      headers.Authorization = `token ${githubToken}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      { headers, signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('Failed to fetch PR info', {
        owner,
        repo,
        prNumber,
        status: response.status,
        rateLimited: response.status === 403,
      });
      return null;
    }

    const data = await response.json();
    return data.user?.login || null;
  } catch (error) {
    logger.error('Error fetching PR author', { error, owner, repo, prNumber });
    return null;
  }
}

/**
 * Get or create a spam reporter record (requires authenticated user)
 */
async function getOrCreateReporter(userId: string | null): Promise<string | null> {
  if (!userId) {
    return null;
  }

  const supabase = await getSupabase();

  // Try to find existing reporter
  const { data: existing, error: lookupError } = await supabase
    .from('spam_reporters')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (lookupError) {
    logger.error('Error fetching reporter record', { error: lookupError });
    return null;
  }

  if (existing) {
    return existing.id;
  }

  // Create new reporter record
  const { data: newReporter, error } = await supabase
    .from('spam_reporters')
    .insert({
      user_id: userId,
      total_reports: 0,
      reports_today: 0,
      reports_this_hour: 0,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error('Error creating reporter record', { error });
    return null;
  }

  return newReporter?.id || null;
}

/**
 * Submit a new spam report
 */
export async function submitSpamReport(
  input: SpamReportInput,
  userId?: string
): Promise<SpamReportSubmitResult> {
  // Require authentication for spam reports
  if (!userId) {
    return {
      success: false,
      error: 'Authentication required. Please sign in to submit spam reports.',
    };
  }

  const supabase = await getSupabase();

  // Get the user's GitHub token from Supabase session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const githubToken = session?.provider_token || null;

  // Parse and validate the PR URL
  const prInfo = parseGitHubPRUrl(input.pr_url);
  if (!prInfo) {
    return {
      success: false,
      error: 'Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/123',
    };
  }

  // Check rate limits
  const rateLimit = await checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: rateLimit.message || 'Rate limit exceeded',
    };
  }

  // Fetch PR author from GitHub using user's authenticated token
  const contributorLogin = await fetchPRAuthor(
    prInfo.owner,
    prInfo.repo,
    prInfo.number,
    githubToken
  );

  // Get or create reporter record
  const reporterId = await getOrCreateReporter(userId);

  // Check for existing report (duplicate detection)
  const { data: existingReport } = await supabase
    .from('spam_reports')
    .select('id, report_count')
    .eq('pr_owner', prInfo.owner)
    .eq('pr_repo', prInfo.repo)
    .eq('pr_number', prInfo.number)
    .maybeSingle();

  if (existingReport) {
    // Atomically increment report count for duplicate
    const { error: updateError } = await supabase.rpc('increment_spam_report_count', {
      p_report_id: existingReport.id,
    });

    if (updateError) {
      logger.error('Error updating duplicate report', { error: updateError });
    }

    // Update reporter stats
    if (reporterId) {
      await supabase.rpc('increment_reporter_counts', { p_reporter_id: reporterId });
    }

    return {
      success: true,
      report_id: existingReport.id,
      is_duplicate: true,
    };
  }

  // Create new report
  const { data: newReport, error } = await supabase
    .from('spam_reports')
    .insert({
      pr_url: input.pr_url,
      pr_owner: prInfo.owner,
      pr_repo: prInfo.repo,
      pr_number: prInfo.number,
      contributor_github_login: contributorLogin,
      spam_category: input.spam_category,
      description: input.description || null,
      reporter_id: userId,
      spam_reporter_id: reporterId,
      status: 'pending',
    })
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error('Error creating spam report', { error });
    return {
      success: false,
      error: 'Failed to submit report. Please try again.',
    };
  }

  // Update reporter stats using RPC for atomic increment
  if (reporterId) {
    await supabase.rpc('increment_reporter_counts', { p_reporter_id: reporterId });
  }

  logger.info('Spam report submitted', {
    reportId: newReport?.id,
    prUrl: input.pr_url,
    category: input.spam_category,
  });

  return {
    success: true,
    report_id: newReport?.id,
    is_duplicate: false,
  };
}

/**
 * Get recent spam reports for the current user
 */
export async function getUserReports(userId: string): Promise<SpamReport[]> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from('spam_reports')
    .select('*')
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    logger.error('Error fetching user reports', { error });
    return [];
  }

  return data || [];
}
