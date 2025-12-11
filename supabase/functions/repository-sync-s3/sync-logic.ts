import { GitHubPullRequest, SyncDependencies, SyncRequest } from './types.ts';

const MAX_PRS_PER_SYNC = 100;
const DEFAULT_DAYS_LIMIT = 30;
const GITHUB_API_BASE = 'https://api.github.com';

export async function processSyncRequest(
  req: SyncRequest,
  deps: SyncDependencies
): Promise<{ status: number; body: unknown }> {
  const startTime = Date.now();
  const {
    owner,
    name,
    fullSync = false,
    daysLimit = DEFAULT_DAYS_LIMIT,
    prLimit = MAX_PRS_PER_SYNC,
    resumeFrom,
  } = req;

  // Validate input parameters
  if (!owner || !name) {
    return {
      status: 400,
      body: { error: 'Missing required fields', details: 'Both owner and name are required' },
    };
  }

  try {
    // Step 1: Verify repository exists and is tracked
    const { data: repoData, error: repoError } = await deps.supabase
      .from('repositories')
      .select('id, github_id, full_name, is_tracked')
      .eq('owner', owner)
      .eq('name', name)
      .single();

    if (repoError || !repoData) {
      return {
        status: 404,
        body: { error: 'Repository not found', details: `${owner}/${name} is not tracked` },
      };
    }

    if (!repoData.is_tracked) {
      return {
        status: 400,
        body: { error: 'Repository not tracked', details: 'Please track the repository first' },
      };
    }

    // Step 2: Calculate date range for sync
    const cutoffDate = fullSync
      ? new Date(0) // Beginning of time for full sync
      : new Date(Date.now() - daysLimit * 24 * 60 * 60 * 1000);

    // Prepare S3/File path
    // Using a temp directory structure simulating S3 path
    // If we were using the actual S3 mount, this would be /s3/temp/...
    // But for this logic, we rely on the fileSystem abstraction to handle the root.
    // The issue suggests: /s3/inngest-results/${repositoryId}/prs.json
    // We'll use a unique ID for this run or just repo ID.
    // To allow concurrent runs? Maybe use a timestamp or random ID.
    const runId = Date.now().toString();
    const filePath = `/s3/temp/${repoData.id}_${runId}_prs.jsonl`;

    // Ensure directory exists (if needed by FS implementation)
    await deps.fileSystem.ensureDir('/s3/temp');

    // Step 3: Fetch pull requests from GitHub and write to file
    let page = 1;
    let hasMore = true;
    let cursor = resumeFrom;
    let fetchedCount = 0;

    // If resuming, we need to find where we left off
    const resumeDate = resumeFrom ? new Date(resumeFrom) : null;

    deps.logger.info(`Starting sync for ${owner}/${name}, writing to ${filePath}`);

    while (hasMore && fetchedCount < prLimit) {
      // Check execution time (simple check, not robust)
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const timeout = parseInt(deps.env.get('SUPABASE_FUNCTION_TIMEOUT') || '50', 10);
      const maxExecutionTime = timeout - 10;

      if (elapsedSeconds > maxExecutionTime) {
         // Handle timeout - we could process what we have so far
         deps.logger.warn('Time limit reached during fetch phase');
         break;
      }

      const response = await deps.fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${name}/pulls?state=all&per_page=100&page=${page}&sort=updated&direction=desc`,
        {
          headers: {
            Authorization: `Bearer ${deps.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'contributor-info-sync',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const prs = (await response.json()) as GitHubPullRequest[];

      if (prs.length === 0) {
        hasMore = false;
        break;
      }

      // Filter and write
      let reachedResumePoint = false;
      const filteredPrs: GitHubPullRequest[] = [];

      for (const pr of prs) {
        const prDate = new Date(pr.updated_at);

        if (resumeDate) {
          if (prDate > resumeDate) {
             continue; // Newer than resume point (already processed)
          } else if (prDate.getTime() === resumeDate.getTime()) {
             reachedResumePoint = true;
             continue;
          }
        }

        if (prDate < cutoffDate) {
           // Past cutoff
           continue;
        }

        filteredPrs.push(pr);
      }

      // Write to file
      if (filteredPrs.length > 0) {
        const content = filteredPrs.map(pr => JSON.stringify(pr)).join('\n') + '\n';
        await deps.fileSystem.writeTextFile(filePath, content, { append: true });
        fetchedCount += filteredPrs.length;
      }

      // Check exit conditions
      // Note: Logic here is simplified compared to original which handled filteredPrs vs prs length
      // If we filtered out some PRs because they were past cutoff, we should stop
      const lastPr = prs[prs.length - 1];
      const lastPrDate = new Date(lastPr.updated_at);

      if (reachedResumePoint) {
        hasMore = false;
      } else if (!fullSync && lastPrDate < cutoffDate) {
        hasMore = false;
      } else if (prs.length < 100) {
        hasMore = false;
      } else {
        page++;
        cursor = lastPr.updated_at;
      }
    }

    // Step 4: Read from file and process
    // This demonstrates the persistent storage usage:
    // We offloaded memory to disk/S3, now we read it back.

    let processed = 0;
    let errors = 0;
    let totalFound = 0;

    if (await deps.fileSystem.exists(filePath)) {
        const fileContent = await deps.fileSystem.readTextFile(filePath);
        const lines = fileContent.trim().split('\n');
        totalFound = lines.length;

        // Remove empty lines
        const validLines = lines.filter(line => line.trim().length > 0);

        for (const line of validLines) {
            try {
                const pr = JSON.parse(line) as GitHubPullRequest;

                // Ensure contributor exists
                const contributorId = await deps.ensureContributor(deps.supabase, pr.user);

                if (!contributorId) {
                  errors++;
                  continue;
                }

                // Upsert pull request
                const { error: prError } = await deps.supabase.from('pull_requests').upsert(
                  {
                    github_id: pr.id,
                    repository_id: repoData.id,
                    number: pr.number,
                    title: pr.title,
                    body: pr.body,
                    state: pr.state,
                    created_at: pr.created_at,
                    updated_at: pr.updated_at,
                    closed_at: pr.closed_at,
                    merged_at: pr.merged_at,
                    merged: pr.merged_at !== null,
                    merge_commit_sha: pr.merge_commit_sha,
                    base_branch: pr.base.ref,
                    head_branch: pr.head.ref,
                    additions: pr.additions || 0,
                    deletions: pr.deletions || 0,
                    changed_files: pr.changed_files || 0,
                    commits: pr.commits || 0,
                    author_id: contributorId,
                    html_url: `https://github.com/${owner}/${name}/pull/${pr.number}`,
                    last_synced_at: new Date().toISOString(),
                  },
                  {
                    onConflict: 'github_id',
                    ignoreDuplicates: false,
                  },
                );

                if (prError) {
                  deps.logger.error(`Error upserting PR #${pr.number}:`, prError);
                  errors++;
                } else {
                  processed++;
                }

            } catch (e) {
                deps.logger.error('Error parsing or processing PR from file', e);
                errors++;
            }
        }

        // Cleanup file
        // In a real S3 scenario, we might keep it for audit or delete it.
        // For temp storage, deleting is good practice.
        await deps.fileSystem.remove(filePath);
    }

    // Step 5: Update repository last sync time
    await deps.supabase
      .from('repositories')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: 'completed',
      })
      .eq('id', repoData.id);

    return {
      status: 200,
      body: {
        success: true,
        repository: `${owner}/${name}`,
        processed,
        errors,
        totalFound,
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        syncType: fullSync ? 'full' : 'incremental',
        dateRange: fullSync ? 'all' : `last ${daysLimit} days`,
        storagePath: filePath
      },
    };

  } catch (error) {
    deps.logger.error('Sync failed', error);
    return {
      status: 500,
      body: { error: 'Internal Server Error', details: String(error) },
    };
  }
}
