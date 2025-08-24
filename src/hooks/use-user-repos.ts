import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Octokit } from '@octokit/rest';
import { env } from '@/lib/env';

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  html_url: string;
  updated_at: string;
  archived: boolean;
  disabled: boolean;
  fork: boolean;
  private: boolean;
}

interface RepositoryWithTracking extends GitHubRepository {
  is_tracked?: boolean;
  is_processing?: boolean;
}

interface UseUserReposState {
  repositories: RepositoryWithTracking[];
  userData?: {
    avatar_url: string;
    name: string;
    bio?: string;
    public_repos: number;
  };
  isLoading: boolean;
  error: Error | null;
}

// Cache interface for user repositories
interface UserRepoCache {
  [user: string]: {
    repositories: RepositoryWithTracking[];
    userData?: {
      avatar_url: string;
      name: string;
      bio?: string;
      public_repos: number;
    };
    timestamp: number;
  };
}

// Cache duration: 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Global cache to persist across component re-mounts
const userRepoCache: UserRepoCache = {};
const MAX_CACHE_SIZE = 50;

/**
 * Clean up old cache entries and enforce size limits
 */
function cleanupUserCache() {
  const now = Date.now();
  const entries = Object.entries(userRepoCache);
  
  // Remove expired entries
  entries.forEach(([user, cache]) => {
    if (now - cache.timestamp > CACHE_DURATION) {
      delete userRepoCache[user];
    }
  });
  
  // If still over size limit, remove oldest entries (LRU)
  const remainingEntries = Object.entries(userRepoCache);
  if (remainingEntries.length > MAX_CACHE_SIZE) {
    const sortedByTimestamp = remainingEntries.sort(([,a], [,b]) => a.timestamp - b.timestamp);
    const toRemove = sortedByTimestamp.slice(0, remainingEntries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([user]) => delete userRepoCache[user]);
  }
}

/**
 * Hook to fetch user repositories with caching and tracking status
 */
export function useUserRepos(username?: string): UseUserReposState {
  const [state, setState] = useState<UseUserReposState>({
    repositories: [],
    userData: undefined,
    isLoading: true,
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!username) {
      setState({
        repositories: [],
        isLoading: false,
        error: new Error('Username is required'),
      });
      return;
    }

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const fetchUserRepos = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        
        // Clean up old cache entries
        cleanupUserCache();
        
        // Check cache first
        const cachedData = userRepoCache[username];
        const now = Date.now();
        
        if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
          setState({
            repositories: cachedData.repositories,
            userData: cachedData.userData,
            isLoading: false,
            error: null,
          });
          return;
        }

        // Fetch from GitHub API
        const octokit = new Octokit({
          auth: env.GITHUB_TOKEN,
        });
        
        // Fetch user data and repositories
        const [userResponse, reposResponse] = await Promise.all([
          octokit.rest.users.getByUsername({ username }),
          octokit.rest.repos.listForUser({
            username,
            sort: 'pushed',
            direction: 'desc',
            per_page: 30,
            type: 'owner', // Only repos owned by user, not forks
          })
        ]);

        const { data: userDetails } = userResponse;
        const { data: repos } = reposResponse;

        if (signal.aborted) return;

        // Filter repos for collaboration (has stars, forks, or pull requests)
        // This optimizes for collaborative projects as mentioned in the requirements
        const collaborativeRepos = repos
          .filter(repo => 
            !repo.archived && 
            !repo.disabled && 
            !repo.private &&
            ((repo.stargazers_count || 0) > 0 || (repo.forks_count || 0) > 0)
          )
          .slice(0, 25); // Max 25 as per requirements

        // Check tracking status for each repository
        const repoFullNames = collaborativeRepos.map(repo => repo.full_name);
        
        let trackedRepos: { full_name: string; last_updated: string | null }[] = [];
        if (repoFullNames.length > 0) {
          const { data } = await supabase
            .from('repositories')
            .select('full_name, last_updated')
            .in('full_name', repoFullNames);
          trackedRepos = data || [];
        }

        if (signal.aborted) return;

        // Combine GitHub data with tracking status
        const repositoriesWithTracking: RepositoryWithTracking[] = collaborativeRepos.map(repo => {
          const trackedRepo = trackedRepos.find(tr => tr.full_name === repo.full_name);
          
          return {
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            stargazers_count: repo.stargazers_count || 0,
            forks_count: repo.forks_count || 0,
            language: repo.language || null,
            html_url: repo.html_url,
            updated_at: repo.updated_at || new Date().toISOString(),
            archived: repo.archived || false,
            disabled: repo.disabled || false,
            fork: repo.fork || false,
            private: repo.private || false,
            is_tracked: Boolean(trackedRepo),
            is_processing: trackedRepo ? isRecentlyUpdated(trackedRepo.last_updated) : false,
          };
        });

        // Prepare user data
        const userData = {
          avatar_url: userDetails.avatar_url,
          name: userDetails.name || username,
          bio: userDetails.bio || undefined,
          public_repos: userDetails.public_repos || 0,
        };

        // Cache the results
        userRepoCache[username] = {
          repositories: repositoriesWithTracking,
          userData,
          timestamp: now,
        };

        setState({
          repositories: repositoriesWithTracking,
          userData,
          isLoading: false,
          error: null,
        });
        
      } catch (error) {
        if (signal.aborted) return;
        
        let errorMessage = 'Failed to fetch repositories';
        if (error instanceof Error) {
          if (error.message.includes('404')) {
            errorMessage = `User "${username}" not found`;
          } else if (error.message.includes('403')) {
            errorMessage = 'Rate limit exceeded. Please try again later.';
          } else {
            errorMessage = error.message;
          }
        }
        
        setState({
          repositories: [],
          isLoading: false,
          error: new Error(errorMessage),
        });
      }
    };

    fetchUserRepos();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [username]);

  return state;
}

/**
 * Helper function to determine if a repository is currently being processed
 */
function isRecentlyUpdated(lastUpdated: string | null): boolean {
  if (!lastUpdated) return false;
  
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const updateTime = new Date(lastUpdated).getTime();
  
  return updateTime > oneHourAgo;
}