import Logger from '../utils/logger.js';

/**
 * Pull Request Reviewer Suggestions Handler
 * Posts reviewer suggestions and insights on opened/ready_for_review PRs
 */

export async function handlePRWithReviewerSuggestions(payload, githubApp, supabase, parentLogger) {
  const logger = parentLogger ? parentLogger.child('PRReviewerSuggestions') : new Logger('PRReviewerSuggestions');
  const { pull_request: pr, repository: repo, installation, action } = payload;
  
  // Only process opened and ready_for_review events
  if (!['opened', 'ready_for_review'].includes(action)) {
    logger.info('Skipping action %s - only handling opened/ready_for_review', action);
    return { success: true, skipped: true };
  }

  // Skip if PR is still a draft (for opened events)
  if (action === 'opened' && pr.draft) {
    logger.info('Skipping draft PR #%s', pr.number);
    return { success: true, skipped: true };
  }
  
  logger.info('Processing PR #%s (%s) in %s for reviewer suggestions', pr.number, action, repo.full_name);
  
  try {
    // Get installation Octokit
    const octokit = await githubApp.getInstallationOctokit(installation.id);
    
    // Generate insights in parallel
    const [contributorInsights, reviewerSuggestions] = await Promise.all([
      generateContributorInsights(pr, repo, supabase, logger),
      generateReviewerSuggestions(pr, repo, supabase, octokit, logger)
    ]);
    
    // Format the comment
    const comment = formatPRComment(pr, contributorInsights, reviewerSuggestions);
    
    // Post comment
    await octokit.rest.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: pr.number,
      body: comment
    });
    
    logger.info('✅ Posted reviewer suggestions on PR #%s', pr.number);
    
    // Track PR in database
    await trackPullRequest(pr, repo, supabase, logger);
    
    return { success: true, commented: true };
  } catch (error) {
    logger.error('Error handling PR with reviewer suggestions:', error);
    // Don't throw - we don't want to trigger retries for comment failures
    return { success: false, error: error.message };
  }
}

async function generateContributorInsights(pr, repo, supabase, logger) {
  try {
    // Get contributor's PR history from database
    const { data: prHistory } = await supabase
      .from('pull_requests')
      .select('id, state, merged, created_at')
      .eq('repository_id', repo.id)
      .eq('author_id', pr.user.id);
    
    const totalPRs = prHistory?.length || 0;
    const mergedPRs = prHistory?.filter(p => p.merged).length || 0;
    
    // Get review history
    const { data: reviews } = await supabase
      .from('reviews')
      .select('id')
      .eq('reviewer_id', pr.user.id);
    
    const reviewsGiven = reviews?.length || 0;
    
    // Get comment history
    const { data: comments } = await supabase
      .from('comments')
      .select('id')
      .eq('commenter_id', pr.user.id);
    
    const commentsLeft = comments?.length || 0;
    
    // Calculate approval rate (simplified)
    const approvalRate = mergedPRs > 0 ? Math.round((mergedPRs / Math.max(totalPRs, 1)) * 100) : 0;
    
    return {
      totalPRs: totalPRs + 1, // Include current PR
      mergedPRs,
      reviewsGiven,
      commentsLeft,
      approvalRate
    };
  } catch (error) {
    logger.error('Error generating contributor insights:', error);
    return {
      totalPRs: 1,
      mergedPRs: 0,
      reviewsGiven: 0,
      commentsLeft: 0,
      approvalRate: 0
    };
  }
}

async function generateReviewerSuggestions(pr, repo, supabase, octokit, logger) {
  try {
    // Get files changed in the PR
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner: repo.owner.login,
      repo: repo.name,
      pull_number: pr.number,
      per_page: 100
    });
    
    const changedFiles = files.map(f => f.filename);
    logger.info('PR #%s changed %d files', pr.number, changedFiles.length);
    
    // Find contributors who have worked on similar files
    const fileContributors = await findFileContributors(changedFiles, repo, supabase, logger);
    
    // Find frequent reviewers
    const frequentReviewers = await findFrequentReviewers(pr.user.login, repo, supabase, logger);
    
    // Combine and score suggestions
    const suggestions = new Map();
    
    // Add file contributors
    fileContributors.forEach(contributor => {
      if (contributor.login !== pr.user.login) {
        suggestions.set(contributor.login, {
          login: contributor.login,
          name: contributor.name,
          avatarUrl: contributor.avatar_url,
          score: 0.5,
          reasons: [`Contributed to ${contributor.fileCount} of the modified files`]
        });
      }
    });
    
    // Add frequent reviewers
    frequentReviewers.forEach(reviewer => {
      if (reviewer.login !== pr.user.login) {
        const existing = suggestions.get(reviewer.login);
        if (existing) {
          existing.score += 0.3;
          existing.reasons.push(`Reviewed ${reviewer.count} similar PRs`);
        } else {
          suggestions.set(reviewer.login, {
            login: reviewer.login,
            name: reviewer.name,
            avatarUrl: reviewer.avatar_url,
            score: 0.3,
            reasons: [`Reviewed ${reviewer.count} similar PRs`]
          });
        }
      }
    });
    
    // Sort by score and return top 3
    return Array.from(suggestions.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  } catch (error) {
    logger.error('Error generating reviewer suggestions:', error);
    return [];
  }
}

async function findFileContributors(filePaths, repo, supabase, logger) {
  try {
    // Get contributors who have modified these files
    const { data: fileContributors } = await supabase
      .from('file_contributors')
      .select(`
        contributor_id,
        commit_count,
        contributors!inner (
          github_id,
          username,
          avatar_url
        )
      `)
      .eq('repository_id', repo.id)
      .in('file_path', filePaths)
      .limit(10);
    
    if (!fileContributors || fileContributors.length === 0) {
      return [];
    }
    
    // Aggregate by contributor
    const contributorMap = new Map();
    
    fileContributors.forEach(fc => {
      const contributor = fc.contributors;
      if (!contributor) return;
      
      const existing = contributorMap.get(contributor.username) || {
        login: contributor.username,
        name: contributor.username,
        avatar_url: contributor.avatar_url,
        fileCount: 0,
        totalCommits: 0
      };
      
      existing.fileCount++;
      existing.totalCommits += fc.commit_count;
      
      contributorMap.set(contributor.username, existing);
    });
    
    return Array.from(contributorMap.values());
  } catch (error) {
    logger.error('Error finding file contributors:', error);
    return [];
  }
}

async function findFrequentReviewers(authorLogin, repo, supabase, logger) {
  try {
    // Find reviewers who have reviewed this author's PRs before
    const { data: reviews } = await supabase
      .from('reviews')
      .select(`
        reviewer_id,
        contributors!reviewer_id (
          username,
          avatar_url
        ),
        pull_requests!inner (
          author_id,
          repository_id
        )
      `)
      .eq('pull_requests.repository_id', repo.id)
      .limit(50);
    
    if (!reviews || reviews.length === 0) {
      return [];
    }
    
    // Count reviews per reviewer
    const reviewerCounts = new Map();
    
    reviews.forEach(review => {
      const reviewer = review.contributors;
      if (!reviewer || !reviewer.username) return;
      
      const existing = reviewerCounts.get(reviewer.username) || {
        login: reviewer.username,
        name: reviewer.username,
        avatar_url: reviewer.avatar_url,
        count: 0
      };
      
      existing.count++;
      reviewerCounts.set(reviewer.username, existing);
    });
    
    // Sort by count and return top reviewers
    return Array.from(reviewerCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  } catch (error) {
    logger.error('Error finding frequent reviewers:', error);
    return [];
  }
}

function formatPRComment(pr, insights, reviewerSuggestions) {
  let comment = `## contributor.info stats

| Metric | Value |
|--------|-------|
| **PRs** | ${insights.mergedPRs}/${insights.totalPRs} merged |
| **Reviews** | ${insights.reviewsGiven} given |
| **Comments** | ${insights.commentsLeft} |
| **Approval Rate** | ${insights.approvalRate}% |
`;

  // Add reviewer suggestions if we have any
  if (reviewerSuggestions.length > 0) {
    comment += `
## Suggested Reviewers
`;
    reviewerSuggestions.forEach(reviewer => {
      const mainReason = reviewer.reasons[0] || 'Code expertise';
      comment += `- **[${reviewer.login}](https://github.com/${reviewer.login})** - ${mainReason}\n`;
    });
  }

  // Add footer
  comment += `
---
*This comment was generated by [contributor.info](https://contributor.info) - providing contributor insights and reviewer suggestions. [Install on your repositories](https://github.com/apps/contributor-info)*`;

  return comment;
}

async function trackPullRequest(pr, repo, supabase, logger) {
  try {
    // First ensure the repository is tracked
    const { data: repoData } = await supabase
      .from('repositories')
      .upsert({
        github_id: repo.id,
        owner: repo.owner.login,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        is_private: repo.private,
        html_url: repo.html_url,
        created_at: repo.created_at,
        updated_at: repo.updated_at
      }, {
        onConflict: 'github_id'
      })
      .select('id')
      .single();
    
    if (!repoData) {
      logger.error('Failed to track repository');
      return;
    }
    
    // Track the contributor
    const { data: contributorData } = await supabase
      .from('contributors')
      .upsert({
        github_id: pr.user.id,
        username: pr.user.login,
        avatar_url: pr.user.avatar_url,
        html_url: pr.user.html_url,
        is_bot: pr.user.type === 'Bot'
      }, {
        onConflict: 'github_id'
      })
      .select('id')
      .single();
    
    if (!contributorData) {
      logger.error('Failed to track contributor');
      return;
    }
    
    // Track the PR with proper repository_id and author_id
    await supabase
      .from('pull_requests')
      .upsert({
        github_id: pr.id,
        repository_id: repoData.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        author_id: contributorData.id,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        html_url: pr.html_url,
        base_branch: pr.base.ref,
        head_branch: pr.head.ref,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changed_files: pr.changed_files || 0,
        commits: pr.commits || 0,
        merged: false,
        merged_at: null
      }, {
        onConflict: 'github_id'
      });
      
    logger.info('✅ Tracked PR #%s in database', pr.number);
  } catch (error) {
    logger.error('Error tracking PR in database:', error);
  }
}