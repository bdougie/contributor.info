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
 * Generate a hash of the client IP for anonymous rate limiting
 * Uses a simple hash that can be computed client-side
 */
async function generateIpHash(): Promise<string> {
  // In production, this would be done server-side with the actual IP
  // For now, we use a fingerprint-based approach
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.width,
    screen.height,
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check rate limits before allowing a spam report submission
 */
export async function checkRateLimit(userId?: string): Promise<RateLimitResult> {
  const supabase = await getSupabase();
  const ipHash = userId ? null : await generateIpHash();

  const { data, error } = await supabase.rpc('check_spam_report_rate_limit', {
    p_user_id: userId || null,
    p_ip_hash: ipHash,
  });

  if (error) {
    logger.error('Error checking rate limit', { error });
    // Default to allowing if rate limit check fails
    return { allowed: true };
  }

  return data as RateLimitResult;
}

/**
 * Fetch PR author information from GitHub
 */
async function fetchPRAuthor(
  owner: string,
  repo: string,
  prNumber: number
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      logger.warn('Failed to fetch PR info', { owner, repo, prNumber, status: response.status });
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
 * Get or create a spam reporter record
 */
async function getOrCreateReporter(userId: string | null): Promise<string | null> {
  const supabase = await getSupabase();
  const ipHash = userId ? null : await generateIpHash();

  // Try to find existing reporter
  let query = supabase.from('spam_reporters').select('id');

  if (userId) {
    query = query.eq('user_id', userId);
  } else if (ipHash) {
    query = query.eq('ip_hash', ipHash);
  } else {
    return null;
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    return existing.id;
  }

  // Create new reporter record
  const { data: newReporter, error } = await supabase
    .from('spam_reporters')
    .insert({
      user_id: userId,
      ip_hash: ipHash,
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

  // Fetch PR author from GitHub
  const contributorLogin = await fetchPRAuthor(prInfo.owner, prInfo.repo, prInfo.number);

  // Get or create reporter record
  const reporterId = await getOrCreateReporter(userId || null);
  const ipHash = userId ? null : await generateIpHash();

  // Check for existing report (duplicate detection)
  const { data: existingReport } = await supabase
    .from('spam_reports')
    .select('id, report_count')
    .eq('pr_owner', prInfo.owner)
    .eq('pr_repo', prInfo.repo)
    .eq('pr_number', prInfo.number)
    .maybeSingle();

  if (existingReport) {
    // Increment report count for duplicate
    const { error: updateError } = await supabase
      .from('spam_reports')
      .update({
        report_count: existingReport.report_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingReport.id);

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
      reporter_id: userId || null,
      reporter_ip_hash: ipHash,
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
