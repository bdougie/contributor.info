import { supabase } from './supabase';
import type { PullRequest, Organization, OrganizationMember, Team, RepositoryCollaborator } from './types';

const GITHUB_API_BASE = 'https://api.github.com';

export async function fetchUserOrganizations(username: string, headers: HeadersInit): Promise<Organization[]> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/users/${username}/orgs`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const orgs = await response.json();
    return orgs.slice(0, 3).map((org: any) => ({
      id: org.id,
      login: org.login,
      avatar_url: org.avatar_url,
      description: org.description,
      url: org.url
    }));
  } catch (error) {
    console.error('Error fetching user organizations:', error);
    return [];
  }
}

export async function fetchRepositoryCollaborators(
  owner: string,
  repo: string,
  headers: HeadersInit
): Promise<RepositoryCollaborator[]> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/collaborators?affiliation=all`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const collaborators = await response.json();
    return collaborators.map((collab: any) => ({
      login: collab.login,
      id: collab.id,
      avatar_url: collab.avatar_url,
      permissions: collab.permissions,
      role_name: collab.role_name
    }));
  } catch (error) {
    console.error('Error fetching repository collaborators:', error);
    return [];
  }
}

export async function fetchOrganizationMembers(
  orgLogin: string,
  headers: HeadersInit
): Promise<OrganizationMember[]> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/orgs/${orgLogin}/members`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const members = await response.json();
    return members.map((member: any) => ({
      login: member.login,
      id: member.id,
      avatar_url: member.avatar_url,
      role: member.role || 'member',
      organization: {
        id: member.organization?.id,
        login: orgLogin,
        avatar_url: member.organization?.avatar_url,
        url: member.organization?.url
      }
    }));
  } catch (error) {
    console.error('Error fetching organization members:', error);
    return [];
  }
}

export async function fetchUserTeams(
  username: string,
  orgLogin: string,
  headers: HeadersInit
): Promise<Team[]> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/orgs/${orgLogin}/teams`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const teams = await response.json();
    return teams
      .filter((team: any) => team.members_url.includes(username))
      .map((team: any) => ({
        id: team.id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        privacy: team.privacy,
        organization: {
          id: team.organization?.id,
          login: orgLogin,
          avatar_url: team.organization?.avatar_url,
          url: team.organization?.url
        }
      }));
  } catch (error) {
    console.error('Error fetching user teams:', error);
    return [];
  }
}

async function fetchPRFiles(owner: string, repo: string, prNumber: number, headers: HeadersInit) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const files = await response.json();
    return files.map((file: any) => ({
      filename: file.filename,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      status: file.status,
      raw_url: file.raw_url,
      language: getLanguageFromFilename(file.filename)
    }));
  } catch (error) {
    console.error(`Error fetching files for PR #${prNumber}:`, error);
    return [];
  }
}

function getLanguageFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    py: 'Python',
    rb: 'Ruby',
    java: 'Java',
    go: 'Go',
    rs: 'Rust',
    cpp: 'C++',
    c: 'C',
    h: 'C',
    cs: 'C#',
    php: 'PHP',
    swift: 'Swift',
    kt: 'Kotlin',
    scala: 'Scala',
    css: 'CSS',
    scss: 'CSS',
    less: 'CSS',
    html: 'HTML',
    md: 'Markdown',
    json: 'JSON',
    yml: 'YAML',
    yaml: 'YAML',
    xml: 'XML',
    sql: 'SQL',
    sh: 'Shell',
    bash: 'Shell',
    zsh: 'Shell',
  };

  return extension ? (languageMap[extension] || 'Other') : 'Other';
}

async function fetchPRReviews(owner: string, repo: string, prNumber: number, headers: HeadersInit) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const reviews = await response.json();
    return reviews.map((review: any) => ({
      id: review.id,
      state: review.state,
      user: {
        login: review.user.login,
        avatar_url: review.user.avatar_url
      },
      submitted_at: review.submitted_at
    }));
  } catch (error) {
    console.error(`Error fetching reviews for PR #${prNumber}:`, error);
    return [];
  }
}

async function fetchPRComments(owner: string, repo: string, prNumber: number, headers: HeadersInit) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const comments = await response.json();
    return comments.map((comment: any) => ({
      id: comment.id,
      user: {
        login: comment.user.login,
        avatar_url: comment.user.avatar_url
      },
      created_at: comment.created_at
    }));
  } catch (error) {
    console.error(`Error fetching comments for PR #${prNumber}:`, error);
    return [];
  }
}

export async function fetchPullRequests(owner: string, repo: string, timeRange: string = '30'): Promise<PullRequest[]> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  const { data: { session } } = await supabase.auth.getSession();
  const userToken = session?.provider_token;
  const token = userToken || import.meta.env.VITE_GITHUB_TOKEN;
  
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    const since = new Date();
    since.setDate(since.getDate() - parseInt(timeRange));
    
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100&since=${since.toISOString()}`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 404) {
        throw new Error(`Repository "${owner}/${repo}" not found. Please check if the repository exists and is public.`);
      } else if (response.status === 403 && error.message?.includes('rate limit')) {
        if (!token) {
          throw new Error('GitHub API rate limit exceeded. Please log in with GitHub to increase the rate limit.');
        } else {
          throw new Error('GitHub API rate limit exceeded. Please try again later.');
        }
      } else if (response.status === 401) {
        throw new Error('Invalid GitHub token. Please check your token and try again.');
      }
      throw new Error(`GitHub API error: ${error.message || response.statusText}`);
    }

    const prs = await response.json();
    
    const filteredPRs = prs.filter((pr: any) => {
      const prDate = new Date(pr.updated_at);
      return prDate >= since;
    });
    
    const detailedPRs = await Promise.all(
      filteredPRs.map(async (pr: any) => {
        const [detailsResponse, files, reviews, comments, organizations] = await Promise.all([
          fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pr.number}`, { headers }),
          fetchPRFiles(owner, repo, pr.number, headers),
          fetchPRReviews(owner, repo, pr.number, headers),
          fetchPRComments(owner, repo, pr.number, headers),
          fetchUserOrganizations(pr.user.login, headers)
        ]);

        if (!detailsResponse.ok) {
          console.warn(`Failed to fetch details for PR #${pr.number}`);
          return {
            ...pr,
            additions: 0,
            deletions: 0,
          };
        }

        const details = await detailsResponse.json();
        
        const isBot = pr.user.type === 'Bot' || pr.user.login.includes('[bot]');
        
        // Aggregate file changes by language
        const languageChanges = files.reduce((acc: Record<string, { additions: number; deletions: number }>, file) => {
          const lang = file.language || 'Other';
          if (!acc[lang]) {
            acc[lang] = { additions: 0, deletions: 0 };
          }
          acc[lang].additions += file.additions;
          acc[lang].deletions += file.deletions;
          return acc;
        }, {});

        const commits = Object.entries(languageChanges).map(([language, changes]) => ({
          language,
          additions: changes.additions,
          deletions: changes.deletions
        }));

        return {
          id: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          merged_at: pr.merged_at,
          closed_at: pr.closed_at,
          additions: details.additions,
          deletions: details.deletions,
          repository_owner: owner,
          repository_name: repo,
          html_url: pr.html_url,
          user: {
            id: pr.user.id,
            login: pr.user.login,
            avatar_url: pr.user.avatar_url,
            type: isBot ? 'Bot' : 'User',
          },
          organizations,
          commits,
          files,
          reviews,
          comments
        };
      })
    );

    return detailedPRs;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred while fetching repository data.');
  }
}

export async function fetchDirectCommits(owner: string, repo: string, timeRange: string = '30'): Promise<{
  directCommits: Array<{
    sha: string;
    actor: {
      login: string;
      avatar_url: string;
      type?: 'User' | 'Bot';
    };
    event_time: string;
    push_num_commits: number;
  }>;
  hasYoloCoders: boolean;
  yoloCoderStats: Array<{
    login: string;
    avatar_url: string;
    directCommits: number;
    totalPushedCommits: number;
    type?: 'User' | 'Bot';
  }>;
}> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  const { data: { session } } = await supabase.auth.getSession();
  const userToken = session?.provider_token;
  const token = userToken || import.meta.env.VITE_GITHUB_TOKEN;
  
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    const repoResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
      { headers }
    );

    if (!repoResponse.ok) {
      throw new Error(`Failed to fetch repository information: ${repoResponse.statusText}`);
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch;
    const defaultRef = `refs/heads/${defaultBranch}`;

    const since = new Date();
    since.setDate(since.getDate() - parseInt(timeRange));

    const pullRequests = await fetchPullRequests(owner, repo, timeRange);
    const mergedPRs = pullRequests.filter(pr => pr.merged_at);
    
    const prMergeShaSet = new Set<string>();
    
    await Promise.all(
      mergedPRs.map(async (pr) => {
        try {
          const prResponse = await fetch(
            `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pr.number}`,
            { headers }
          );
          
          if (prResponse.ok) {
            const prData = await prResponse.json();
            if (prData.merge_commit_sha) {
              prMergeShaSet.add(prData.merge_commit_sha);
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch merge commit SHA for PR #${pr.number}:`, error);
        }
      })
    );

    const eventsResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/events?per_page=100`,
      { headers }
    );

    if (!eventsResponse.ok) {
      throw new Error(`Failed to fetch repository events: ${eventsResponse.statusText}`);
    }

    const events = await eventsResponse.json();
    
    const pushEvents = events.filter((event: any) => {
      return event.type === 'PushEvent' && 
             event.payload.ref === defaultRef &&
             new Date(event.created_at) >= since;
    });

    const yoloPushes = pushEvents.filter((push: any) => {
      return !prMergeShaSet.has(push.payload.head);
    });

    const directCommits = await Promise.all(yoloPushes.map(async (push: any) => {
      let avatar_url = '';
      try {
        const userResponse = await fetch(
          `${GITHUB_API_BASE}/users/${push.actor.login}`,
          { headers }
        );
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          avatar_url = userData.avatar_url;
        }
      } catch (error) {
        console.warn(`Failed to fetch user details for ${push.actor.login}:`, error);
      }

      return {
        sha: push.payload.head,
        actor: {
          login: push.actor.login,
          avatar_url,
          type: push.actor.login.includes('[bot]') ? 'Bot' : 'User'
        },
        event_time: push.created_at,
        push_num_commits: push.payload.size
      };
    }));

    const yoloCoderMap = new Map<string, { 
      login: string; 
      avatar_url: string; 
      directCommits: number;
      totalPushedCommits: number;
      type?: 'User' | 'Bot'; 
    }>();

    for (const commit of directCommits) {
      const login = commit.actor.login;
      const isBot = login.includes('[bot]');
      
      if (yoloCoderMap.has(login)) {
        const coder = yoloCoderMap.get(login)!;
        coder.directCommits += 1;
        coder.totalPushedCommits += commit.push_num_commits;
      } else {
        yoloCoderMap.set(login, {
          login,
          avatar_url: commit.actor.avatar_url,
          directCommits: 1,
          totalPushedCommits: commit.push_num_commits,
          type: isBot ? 'Bot' : 'User',
        });
      }
    }

    const yoloCoderStats = Array.from(yoloCoderMap.values())
      .sort((a, b) => b.directCommits - a.directCommits);

    return {
      directCommits,
      hasYoloCoders: directCommits.length > 0,
      yoloCoderStats,
    };
  } catch (error) {
    console.error('Error fetching direct commits:', error);
    return {
      directCommits: [],
      hasYoloCoders: false,
      yoloCoderStats: [],
    };
  }
}