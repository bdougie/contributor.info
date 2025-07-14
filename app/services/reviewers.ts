import { PullRequest, Repository } from '../types/github';
import { supabase } from '../../src/lib/supabase';
import { githubAppAuth } from '../lib/auth';

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
export async function suggestReviewers(
  pullRequest: PullRequest,
  repository: Repository
): Promise<ReviewerSuggestion[]> {
  try {
    const suggestions: ReviewerSuggestion[] = [];
    
    // Get files changed in the PR
    const changedFiles = await getChangedFiles(pullRequest, repository);
    
    // 1. Find code owners
    const codeOwners = await findCodeOwners(changedFiles, repository);
    
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
    
    return suggestions.slice(0, 3); // Return top 3
    
  } catch (error) {
    console.error('Error suggesting reviewers:', error);
    return [];
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
async function getChangedFiles(pr: PullRequest, repo: Repository): Promise<string[]> {
  try {
    // In a real implementation, fetch from GitHub API
    // For now, return mock data based on PR title
    const files: string[] = [];
    
    if (pr.title.toLowerCase().includes('auth')) {
      files.push('src/auth/login.ts', 'src/auth/middleware.ts');
    }
    if (pr.title.toLowerCase().includes('api')) {
      files.push('src/api/routes.ts', 'src/api/handlers.ts');
    }
    if (pr.title.toLowerCase().includes('frontend')) {
      files.push('src/components/App.tsx', 'src/pages/Home.tsx');
    }
    
    return files.length > 0 ? files : ['src/index.ts'];
  } catch (error) {
    console.error('Error getting changed files:', error);
    return [];
  }
}

/**
 * Find code owners for changed files
 */
async function findCodeOwners(files: string[], repo: Repository): Promise<any[]> {
  // In a real implementation, this would:
  // 1. Check CODEOWNERS file
  // 2. Analyze git blame for recent contributors
  // 3. Check who has made most commits to these files
  
  // Mock implementation
  const owners = [
    {
      login: 'alice-dev',
      name: 'Alice Developer',
      avatarUrl: 'https://github.com/alice-dev.png',
      ownership: 67,
    },
    {
      login: 'bob-reviewer',
      name: 'Bob Reviewer',
      avatarUrl: 'https://github.com/bob-reviewer.png',
      ownership: 45,
    },
  ];
  
  return owners;
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
  // Determine expertise areas from files
  const expertiseNeeded = new Set<string>();
  
  files.forEach(file => {
    if (file.includes('auth')) expertiseNeeded.add('auth');
    if (file.includes('api')) expertiseNeeded.add('API');
    if (file.includes('.tsx') || file.includes('.jsx')) expertiseNeeded.add('frontend');
    if (file.includes('test')) expertiseNeeded.add('testing');
    if (file.includes('.sql') || file.includes('migration')) expertiseNeeded.add('database');
  });
  
  // Mock implementation - would query database for experts
  const experts = [
    {
      login: 'charlie-expert',
      name: 'Charlie Expert',
      avatarUrl: 'https://github.com/charlie-expert.png',
      expertise: ['auth', 'security'],
    },
    {
      login: 'diana-senior',
      name: 'Diana Senior',
      avatarUrl: 'https://github.com/diana-senior.png',
      expertise: ['API', 'backend'],
    },
  ];
  
  return experts.filter(expert => 
    expert.expertise.some(exp => expertiseNeeded.has(exp))
  );
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
    
    return {
      reviewsGiven: contributor.reviews?.length || 0,
      avgResponseTime,
      expertise: ['frontend', 'auth', 'API'], // Mock data
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