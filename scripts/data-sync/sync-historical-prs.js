#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';
import { ensureContributor } from '../progressive-capture/lib/contributor-utils.js';
import { parseArgs } from 'util';

// Parse command line arguments
const { values } = parseArgs({
  options: {
    'repository-id': { type: 'string' },
    'repository-name': { type: 'string' },
    'time-range': { type: 'string', default: '30' },
    'max-items': { type: 'string', default: '1000' },
    'job-id': { type: 'string' },
  },
});

const repositoryId = values['repository-id'];
const repositoryName = values['repository-name'];
const timeRange = parseInt(values['time-range'] || '30', 10);
const maxItems = parseInt(values['max-items'] || '1000', 10);
const jobId = values['job-id'];

if (!repositoryId || !repositoryName) {
  console.error('Missing required arguments: --repository-id and --repository-name');
  process.exit(1);
}

if (isNaN(timeRange) || timeRange <= 0) {
  console.error('Invalid time-range value. Must be a positive number.');
  process.exit(1);
}

if (isNaN(maxItems) || maxItems <= 0) {
  console.error('Invalid max-items value. Must be a positive number.');
  process.exit(1);
}

// Initialize clients
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_TOKEN || process.env.VITE_SUPABASE_ANON_KEY;
const githubToken = process.env.GITHUB_TOKEN;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

if (!githubToken) {
  console.error(
    'GITHUB_TOKEN environment variable is required. Unauthenticated requests have a rate limit of only 60 requests per hour.'
  );
  console.error('Please set GITHUB_TOKEN with a valid GitHub personal access token.');
  process.exit(1);
}

const octokit = new Octokit({ auth: githubToken });

async function updateProgress(processed, total, currentItem) {
  if (!jobId) return;

  try {
    await supabase.from('progressive_capture_progress').upsert(
      {
        job_id: jobId,
        total_items: total,
        processed_items: processed,
        current_item: currentItem,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'job_id',
      }
    );
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
}

/**
 * Process and store PRs with proper contributor UUIDs
 */

async function syncHistoricalPRs() {
  try {
    console.log(`Starting historical PR sync for ${repositoryName}`);
    console.log(`Time range: ${timeRange} days, Max items: ${maxItems}`);

    const [owner, repo] = repositoryName.split('/');
    const since = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000).toISOString();

    // Fetch PRs
    const pulls = [];
    let page = 1;

    while (pulls.length < maxItems) {
      const { data } = await octokit.pulls.list({
        owner,
        repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        page,
      });

      if (data.length === 0) break;

      // Filter by date and add to list
      const filtered = data.filter((pr) => new Date(pr.created_at) >= new Date(since));
      pulls.push(...filtered);

      if (filtered.length < data.length || pulls.length >= maxItems) break;
      page++;
    }

    const totalPRs = Math.min(pulls.length, maxItems);
    console.log(`Found ${totalPRs} PRs to sync`);

    let processed = 0;
    const errors = [];

    for (const pr of pulls.slice(0, maxItems)) {
      try {
        // Ensure author exists using shared utility (handles github_id properly)
        let authorId = null;
        if (pr.user) {
          authorId = await ensureContributor(supabase, pr.user);
        }

        // Prepare PR data
        const prData = {
          repository_id: repositoryId,
          github_id: pr.id.toString(),
          pr_number: pr.number,
          title: pr.title,
          state: pr.state,
          author_id: authorId,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          closed_at: pr.closed_at,
          merged_at: pr.merged_at,
          pr_data: {
            body: pr.body,
            draft: pr.draft,
            labels: pr.labels.map((l) => l.name),
            milestone: pr.milestone?.title,
            head: pr.head.ref,
            base: pr.base.ref,
          },
        };

        // Upsert PR
        const { error } = await supabase.from('pull_requests').upsert(prData, {
          onConflict: 'github_id',
        });

        if (error) {
          console.error(`Failed to sync PR #${pr.number}:`, error);
          errors.push({ pr: pr.number, error: error.message });
        } else {
          processed++;
        }

        // Update progress
        await updateProgress(processed, totalPRs, `PR #${pr.number}`);

        // Rate limit handling
        if (processed % 50 === 0) {
          console.log(`Progress: ${processed}/${totalPRs} PRs synced`);
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Brief pause
        }
      } catch (error) {
        console.error(`Error processing PR #${pr.number}:`, error);
        errors.push({ pr: pr.number, error: error.message });
      }
    }

    console.log(`Sync completed: ${processed}/${totalPRs} PRs synced`);
    if (errors.length > 0) {
      console.log(`${errors.length} errors occurred`);
    }

    // Update job metadata with results
    if (jobId) {
      await supabase
        .from('progressive_capture_jobs')
        .update({
          metadata: {
            total_synced: processed,
            total_found: totalPRs,
            errors: errors.length,
            error_details: errors.slice(0, 10), // Keep first 10 errors
          },
        })
        .eq('id', jobId);
    }
  } catch (error) {
    console.error('Failed to sync historical PRs:', error);

    // Update job with error
    if (jobId) {
      await supabase
        .from('progressive_capture_jobs')
        .update({
          error: error.message,
          status: 'failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    process.exit(1);
  }
}

syncHistoricalPRs();
