import type { Context } from '@netlify/functions';
import { createSupabaseClient } from '../../src/lib/supabase';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation';

interface ReviewerSuggestion {
  username: string;
  avatarUrl?: string;
  score: number;
  reasoning: string[];
  relevantFiles: string[];
  recentActivity: boolean;
}

interface PullRequestFiles {
  files: string[];
  directories: Set<string>;
  fileTypes: Set<string>;
}

async function analyzePRFiles(files: string[]): PullRequestFiles {
  const directories = new Set<string>();
  const fileTypes = new Set<string>();

  for (const file of files) {
    // Extract directory
    const lastSlash = file.lastIndexOf('/');
    if (lastSlash > 0) {
      const dir = file.substring(0, lastSlash);
      directories.add(dir);
      // Add parent directories too
      const parts = dir.split('/');
      for (let i = 1; i <= parts.length; i++) {
        directories.add(parts.slice(0, i).join('/'));
      }
    }

    // Extract file extension
    const lastDot = file.lastIndexOf('.');
    if (lastDot > 0 && lastDot < file.length - 1) {
      fileTypes.add(file.substring(lastDot + 1));
    }
  }

  return { files, directories, fileTypes };
}

async function getContributorScores(
  owner: string,
  repo: string,
  prFiles: PullRequestFiles
): Promise<Map<string, ReviewerSuggestion>> {
  const supabase = createSupabaseClient();

  // Get recent contributions with file-level data
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: contributions, error } = await supabase
    .from('github_contributions')
    .select(`
      contributor:github_contributors!inner(
        username,
        avatar_url
      ),
      additions,
      deletions,
      commits,
      files_changed,
      last_contributed_at
    `)
    .eq('repository_id', `${owner}/${repo}`.toLowerCase())
    .gte('last_contributed_at', thirtyDaysAgo)
    .order('commits', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching contributions:', error);
    throw new Error('Failed to fetch contribution data');
  }

  const reviewerMap = new Map<string, ReviewerSuggestion>();

  for (const contribution of contributions || []) {
    const username = contribution.contributor?.username;
    if (!username) continue;

    const relevantFiles: string[] = [];
    const reasoning: string[] = [];
    let score = 0;

    // Check if contributor has worked on the same files
    if (contribution.files_changed && Array.isArray(contribution.files_changed)) {
      for (const file of contribution.files_changed) {
        if (typeof file === 'string') {
          // Direct file match
          if (prFiles.files.includes(file)) {
            relevantFiles.push(file);
            score += 10;
            if (!reasoning.includes('Has modified the same files')) {
              reasoning.push('Has modified the same files');
            }
          }

          // Directory match
          const fileDir = file.substring(0, file.lastIndexOf('/'));
          if (fileDir && prFiles.directories.has(fileDir)) {
            score += 5;
            if (!reasoning.includes('Familiar with affected directories')) {
              reasoning.push('Familiar with affected directories');
            }
          }

          // File type expertise
          const fileExt = file.substring(file.lastIndexOf('.') + 1);
          if (fileExt && prFiles.fileTypes.has(fileExt)) {
            score += 2;
            if (!reasoning.includes(`Experience with .${fileExt} files`)) {
              reasoning.push(`Experience with .${fileExt} files`);
            }
          }
        }
      }
    }

    // Boost score for recent activity
    const lastContributed = contribution.last_contributed_at
      ? new Date(contribution.last_contributed_at)
      : null;
    const daysSinceLastContribution = lastContributed
      ? (Date.now() - lastContributed.getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    const recentActivity = daysSinceLastContribution < 7;
    if (recentActivity) {
      score += 5;
      reasoning.push('Active in the past week');
    } else if (daysSinceLastContribution < 30) {
      score += 2;
      reasoning.push('Active in the past month');
    }

    // Add commit count as a factor
    score += Math.min(contribution.commits || 0, 10);

    if (score > 0) {
      if (!reviewerMap.has(username)) {
        reviewerMap.set(username, {
          username,
          avatarUrl: contribution.contributor?.avatar_url,
          score,
          reasoning,
          relevantFiles: relevantFiles.slice(0, 5), // Limit to 5 files
          recentActivity,
        });
      } else {
        const existing = reviewerMap.get(username)!;
        existing.score += score;
        existing.reasoning = [...new Set([...existing.reasoning, ...reasoning])];
        existing.relevantFiles = [...new Set([...existing.relevantFiles, ...relevantFiles])].slice(0, 5);
      }
    }
  }

  return reviewerMap;
}

async function fetchCodeOwnersFromGitHub(
  owner: string,
  repo: string,
  token: string
): Promise<string | null> {
  const possiblePaths = ['.github/CODEOWNERS', 'CODEOWNERS'];

  for (const path of possiblePaths) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.content) {
          return Buffer.from(data.content, 'base64').toString('utf-8');
        }
      }
    } catch (error) {
      console.error(`Error fetching CODEOWNERS from ${path}:`, error);
    }
  }

  return null;
}

function parseCodeOwners(content: string, prFiles: PullRequestFiles): Set<string> {
  const owners = new Set<string>();
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;

    const pattern = parts[0];
    const fileOwners = parts.slice(1).filter(o => o.startsWith('@'));

    // Check if pattern matches any PR files
    let matches = false;

    for (const file of prFiles.files) {
      if (pattern.endsWith('/')) {
        // Directory pattern
        if (file.startsWith(pattern)) {
          matches = true;
          break;
        }
      } else if (pattern.includes('*')) {
        // Wildcard pattern - simple implementation
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(file)) {
          matches = true;
          break;
        }
      } else {
        // Exact file match
        if (file === pattern) {
          matches = true;
          break;
        }
      }
    }

    if (matches) {
      fileOwners.forEach(o => owners.add(o.substring(1))); // Remove @ prefix
    }
  }

  return owners;
}

export default async (req: Request, context: Context) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }

  try {
    // Extract owner and repo from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');

    // Expected path: /api/repos/:owner/:repo/suggest-reviewers
    const apiIndex = pathParts.findIndex(part => part === 'api');
    if (apiIndex === -1 || pathParts.length < apiIndex + 5) {
      return createErrorResponse('Invalid API path format');
    }

    const owner = pathParts[apiIndex + 2];
    const repo = pathParts[apiIndex + 3];

    // Validate repository is tracked
    const validation = await validateRepository(owner, repo);

    if (!validation.isTracked) {
      return createNotFoundResponse(owner, repo, validation.trackingUrl);
    }

    if (validation.error) {
      return createErrorResponse(validation.error);
    }

    // Parse request body
    const body = await req.json();
    const { files, prAuthor } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return createErrorResponse('Please provide an array of files changed in the PR');
    }

    // Analyze PR files
    const prFiles = await analyzePRFiles(files);

    // Get contributor scores
    const reviewerMap = await getContributorScores(owner, repo, prFiles);

    // Check CODEOWNERS file
    const token = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
    let codeOwners: string[] = [];

    if (token) {
      const codeOwnersContent = await fetchCodeOwnersFromGitHub(owner, repo, token);
      if (codeOwnersContent) {
        const codeOwnerSet = parseCodeOwners(codeOwnersContent, prFiles);
        codeOwners = Array.from(codeOwnerSet);

        // Boost scores for code owners
        for (const codeOwner of codeOwners) {
          if (reviewerMap.has(codeOwner)) {
            const reviewer = reviewerMap.get(codeOwner)!;
            reviewer.score += 20;
            reviewer.reasoning.unshift('Listed in CODEOWNERS');
          } else {
            // Add code owner even if not in recent contributors
            reviewerMap.set(codeOwner, {
              username: codeOwner,
              score: 20,
              reasoning: ['Listed in CODEOWNERS'],
              relevantFiles: [],
              recentActivity: false,
            });
          }
        }
      }
    }

    // Sort reviewers by score and filter out PR author
    const suggestions = Array.from(reviewerMap.values())
      .filter(r => r.username !== prAuthor)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10 suggestions

    // Categorize suggestions
    const primaryReviewers = suggestions.filter(s => s.score >= 20);
    const secondaryReviewers = suggestions.filter(s => s.score >= 10 && s.score < 20);
    const additionalReviewers = suggestions.filter(s => s.score < 10);

    return new Response(
      JSON.stringify({
        suggestions: {
          primary: primaryReviewers,
          secondary: secondaryReviewers,
          additional: additionalReviewers,
        },
        codeOwners,
        repository: `${owner}/${repo}`,
        filesAnalyzed: files.length,
        directoriesAffected: prFiles.directories.size,
        generatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in api-suggest-reviewers:', error);
    return createErrorResponse(
      `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
};

export const config = {
  path: '/api/repos/:owner/:repo/suggest-reviewers',
};