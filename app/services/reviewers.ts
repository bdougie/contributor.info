import { PullRequest, Repository } from '../types/github';
import { supabase } from '../../src/lib/supabase';
import { githubAppAuth } from '../lib/auth';
import { 
  fetchCodeOwners, 
  getSuggestedReviewersFromCodeOwners,
  CodeOwnerSuggestion 
} from './codeowners';
import { findFileContributors, getExpertiseFromFiles } from './git-history';
import { findSimilarFiles } from './file-embeddings';

export interface ReviewerSuggestion {
  login: string;
  name?: string;
  avatarUrl: string;
  score: number;
  reasons: string[];
  stats: {
    reviewsGiven: number;
    avgResponseTime: string;
    expertise: string[];
    lastActive: string;
  };
}

/**
 * Suggest reviewers for a pull request
 */
export interface ReviewerSuggestionsResult {
  suggestions: ReviewerSuggestion[];
  hasCodeOwners: boolean;
}

export async function suggestReviewers(
  pullRequest: PullRequest,
  repository: Repository,
  installationId?: number
): Promise<ReviewerSuggestionsResult> {
  try {
    const suggestions: ReviewerSuggestion[] = [];
    let hasCodeOwners = false;
    
    // Get octokit client if we have installation ID
    let octokit;
    if (installationId) {
      octokit = await githubAppAuth.getInstallationOctokit(installationId);
    }
    
    // Get files changed in the PR
    const changedFiles = await getChangedFiles(pullRequest, repository, octokit);
    
    // 1. Find code owners
    const codeOwnersResult = await findCodeOwners(
      changedFiles, 
      repository, 
      octokit,
      pullRequest.user.login
    );
    
    // Track if CODEOWNERS exists (will be set in findCodeOwners)
    hasCodeOwners = codeOwnersResult.hasCodeOwners || false;
    const codeOwners = codeOwnersResult.owners || [];
    
    // 2. Find frequent reviewers
    const frequentReviewers = await findFrequentReviewers(pullRequest.user.login, repository);
    
    // 3. Find subject matter experts
    const experts = await findSubjectMatterExperts(changedFiles, repository);
    
    // 4. Combine and score all candidates
    const allCandidates = new Map<string, ReviewerCandidate>();
    
    // Add code owners with high base score
    codeOwners.forEach(owner => {
      if (owner.login !== pullRequest.user.login) {
        allCandidates.set(owner.login, {
          ...owner,
          score: 0.4,
          reasons: [`Owns ${owner.ownership}% of modified files`],
        });
      }
    });
    
    // Add frequent reviewers
    frequentReviewers.forEach(reviewer => {
      if (reviewer.login !== pullRequest.user.login) {
        const existing = allCandidates.get(reviewer.login);
        if (existing) {
          existing.score += 0.3;
          existing.reasons.push(`Reviewed ${reviewer.count} similar PRs`);
        } else {
          allCandidates.set(reviewer.login, {
            ...reviewer,
            score: 0.3,
            reasons: [`Reviewed ${reviewer.count} similar PRs`],
          });
        }
      }
    });
    
    // Add experts
    experts.forEach(expert => {
      if (expert.login !== pullRequest.user.login) {
        const existing = allCandidates.get(expert.login);
        if (existing) {
          existing.score += 0.2;
          existing.reasons.push(`Expert in ${expert.expertise.join(', ')}`);
        } else {
          allCandidates.set(expert.login, {
            ...expert,
            score: 0.2,
            reasons: [`Expert in ${expert.expertise.join(', ')}`],
          });
        }
      }
    });
    
    // 5. Get additional stats for top candidates
    const topCandidates = Array.from(allCandidates.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    
    for (const candidate of topCandidates) {
      const stats = await getReviewerStats(candidate.login, repository);
      
      suggestions.push({
        login: candidate.login,
        name: candidate.name,
        avatarUrl: candidate.avatarUrl || '',
        score: candidate.score,
        reasons: candidate.reasons,
        stats,
      });
    }
    
    return {
      suggestions: suggestions.slice(0, 3), // Return top 3
      hasCodeOwners
    };
    
  } catch (error) {
    console.error('Error suggesting reviewers:', error);
    return {
      suggestions: [],
      hasCodeOwners: false
    };
  }
}

interface ReviewerCandidate {
  login: string;
  name?: string;
  avatarUrl?: string;
  score: number;
  reasons: string[];
  ownership?: number;
  count?: number;
  expertise?: string[];
}

/**
 * Get files changed in a PR
 */
async function getChangedFiles(pr: PullRequest, repo: Repository, octokit?: any): Promise<string[]> {
  try {
    if (!octokit) {
      console.error('No octokit client available for getting changed files');
      return [];
    }

    const changedFiles: string[] = [];
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      const { data: files } = await octokit.pulls.listFiles({
        owner: repo.owner.login,
        repo: repo.name,
        pull_number: pr.number,
        per_page: 100,
        page,
      });
      
      changedFiles.push(...files.map((f: any) => f.filename));
      
      // Check if there are more pages
      hasMorePages = files.length === 100;
      page++;
      
      // Safety limit to prevent infinite loops
      if (page > 10) {
        console.warn(`PR #${pr.number} has more than 1000 files, stopping pagination`);
        break;
      }
    }
    
    return changedFiles;
  } catch (error) {
    console.error('Error getting changed files:', error);
    return [];
  }
}

/**
 * Find code owners for changed files
 */
interface CodeOwnersResult {
  owners: any[];
  hasCodeOwners: boolean;
}

async function findCodeOwners(
  files: string[], 
  repo: Repository, 
  octokit?: any,
  prAuthor?: string
): Promise<CodeOwnersResult> {
  try {
    // Get octokit client if not provided
    if (!octokit) {
      const installation = await supabase
        .from('github_app_installations')
        .select('installation_id')
        .eq('repository_id', repo.id)
        .single();
        
      if (installation?.data) {
        octokit = await githubAppAuth.getInstallationOctokit(installation.data.installation_id);
      }
    }
    
    if (!octokit) {
      console.log('No octokit client available for CODEOWNERS lookup');
      return { owners: [], hasCodeOwners: false };
    }

    // Fetch CODEOWNERS file
    const { owners: codeOwners, source } = await fetchCodeOwners(
      octokit,
      repo.owner.login,
      repo.name
    );

    if (codeOwners.length === 0) {
      console.log('No CODEOWNERS file found');
      return { owners: [], hasCodeOwners: false };
    }

    // Get suggested reviewers from CODEOWNERS
    const suggestions = getSuggestedReviewersFromCodeOwners(
      files,
      codeOwners,
      prAuthor
    );

    // Convert to expected format and fetch additional user data
    const ownersWithData = [];
    
    for (const suggestion of suggestions) {
      try {
        // Get user data from GitHub
        const { data: userData } = await octokit.users.getByUsername({
          username: suggestion.username,
        });

        ownersWithData.push({
          login: suggestion.username,
          name: userData.name || suggestion.username,
          avatarUrl: userData.avatar_url,
          ownership: suggestion.ownershipPercentage,
          matchedFiles: suggestion.matchedFiles,
        });
      } catch (error) {
        // User might not exist or be accessible
        console.log(`Could not fetch data for user ${suggestion.username}`);
        ownersWithData.push({
          login: suggestion.username,
          name: suggestion.username,
          avatarUrl: `https://github.com/${suggestion.username}.png`,
          ownership: suggestion.ownershipPercentage,
          matchedFiles: suggestion.matchedFiles,
        });
      }
    }

    return { owners: ownersWithData, hasCodeOwners: true };
  } catch (error) {
    console.error('Error finding code owners:', error);
    return { owners: [], hasCodeOwners: false };
  }
}

/**
 * Find reviewers who frequently review PRs from this author
 */
async function findFrequentReviewers(authorLogin: string, repo: Repository): Promise<any[]> {
  try {
    // Query database for past reviews
    const { data: reviews } = await supabase
      .from('reviews')
      .select(`
        reviewer_id,
        contributors!reviewer_id (
          github_login,
          name,
          avatar_url
        )
      `)
      .eq('pull_requests.contributor.github_login', authorLogin)
      .limit(20);
    
    // Count reviews per reviewer
    const reviewerCounts = new Map<string, any>();
    
    reviews?.forEach(review => {
      const reviewer = review.contributors;
      if (reviewer) {
        const existing = reviewerCounts.get(reviewer.github_login);
        if (existing) {
          existing.count++;
        } else {
          reviewerCounts.set(reviewer.github_login, {
            login: reviewer.github_login,
            name: reviewer.name,
            avatarUrl: reviewer.avatar_url,
            count: 1,
          });
        }
      }
    });
    
    return Array.from(reviewerCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
  } catch (error) {
    console.error('Error finding frequent reviewers:', error);
    return [];
  }
}

/**
 * Find subject matter experts based on file types and areas
 */
async function findSubjectMatterExperts(files: string[], repo: Repository): Promise<any[]> {
  try {
    // Get repository ID
    const { data: dbRepo } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', repo.id)
      .single();
    
    if (!dbRepo) {
      return [];
    }
    
    // Find contributors who have worked on these files
    const fileContributors = await findFileContributors(dbRepo.id, files);
    
    // Find contributors who have worked on similar files
    const similarFiles = await findSimilarFiles(dbRepo.id, files);
    const similarFilePaths: string[] = [];
    
    for (const [_, similar] of similarFiles) {
      similarFilePaths.push(...similar.map(s => s.path));
    }
    
    // Get contributors for similar files
    const similarFileContributors = similarFilePaths.length > 0
      ? await findFileContributors(dbRepo.id, similarFilePaths)
      : new Map();
    
    // Determine expertise based on files
    const expertise = getExpertiseFromFiles(files);
    
    // Combine and score experts
    const experts: any[] = [];
    
    // Add direct file contributors as experts
    for (const [login, contributor] of fileContributors) {
      experts.push({
        login,
        name: contributor.name,
        avatarUrl: contributor.avatarUrl,
        expertise,
        score: contributor.totalCommits * 0.1, // Score based on commit count
        directContributor: true,
      });
    }
    
    // Add similar file contributors with lower score
    for (const [login, contributor] of similarFileContributors) {
      if (!fileContributors.has(login)) {
        experts.push({
          login,
          name: contributor.name,
          avatarUrl: contributor.avatarUrl,
          expertise,
          score: contributor.totalCommits * 0.05, // Lower score for similar files
          directContributor: false,
        });
      }
    }
    
    // Sort by score and return top experts
    return experts
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    
  } catch (error) {
    console.error('Error finding subject matter experts:', error);
    return [];
  }
}

/**
 * Get detailed stats for a reviewer
 */
async function getReviewerStats(login: string, repo: Repository): Promise<any> {
  try {
    // Query database for reviewer stats
    const { data: contributor } = await supabase
      .from('contributors')
      .select(`
        *,
        reviews (
          created_at,
          submitted_at
        )
      `)
      .eq('github_login', login)
      .single();
    
    if (!contributor) {
      return {
        reviewsGiven: 0,
        avgResponseTime: 'Unknown',
        expertise: [],
        lastActive: 'Unknown',
      };
    }
    
    // Calculate average response time
    const responseTimes: number[] = [];
    contributor.reviews?.forEach((review: any) => {
      if (review.created_at && review.submitted_at) {
        const created = new Date(review.created_at);
        const submitted = new Date(review.submitted_at);
        const hours = (submitted.getTime() - created.getTime()) / (1000 * 60 * 60);
        responseTimes.push(hours);
      }
    });
    
    const avgHours = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    
    const avgResponseTime = avgHours < 1 ? '<1 hour' :
                           avgHours < 24 ? `${Math.round(avgHours)} hours` :
                           `${Math.round(avgHours / 24)} days`;
    
    // Get expertise based on files they've contributed to
    const { data: fileContributions } = await supabase
      .from('file_contributors')
      .select('file_path')
      .eq('contributor_id', contributor.id)
      .eq('repository_id', repo.id)
      .limit(50);
    
    const filePaths = fileContributions?.map(fc => fc.file_path) || [];
    const expertise = getExpertiseFromFiles(filePaths);
    
    return {
      reviewsGiven: contributor.reviews?.length || 0,
      avgResponseTime,
      expertise: expertise.length > 0 ? expertise : ['general'],
      lastActive: calculateLastActive(contributor.last_active_at),
    };
    
  } catch (error) {
    console.error('Error getting reviewer stats:', error);
    return {
      reviewsGiven: 0,
      avgResponseTime: 'Unknown',
      expertise: [],
      lastActive: 'Unknown',
    };
  }
}

/**
 * Calculate how long ago someone was last active
 */
function calculateLastActive(lastActiveAt: string | null): string {
  if (!lastActiveAt) return 'Unknown';
  
  const now = new Date();
  const lastActive = new Date(lastActiveAt);
  const diffHours = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
  
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.round(diffHours)} hours ago`;
  if (diffHours < 168) return `${Math.round(diffHours / 24)} days ago`;
  return `${Math.round(diffHours / 168)} weeks ago`;
}