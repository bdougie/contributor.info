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
}

interface RepositoryWithTracking extends GitHubRepository {
  is_tracked?: boolean;
  is_processing?: boolean;
}

interface UseOrgReposState {
  repositories: RepositoryWithTracking[];
  isLoading: boolean;
  error: Error | null;
}

// Cache interface for org repositories
interface OrgRepoCache {
  [org: string]: {
    repositories: RepositoryWithTracking[];
    timestamp: number;
  };
}

// Cache duration: 24 hours as mentioned in the requirements
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Global cache to persist across component re-mounts
const orgRepoCache: OrgRepoCache = {};

/**
 * Clean up old cache entries
 */
function cleanupOrgCache() {
  const now = Date.now();
  Object.keys(orgRepoCache).forEach(org => {
    if (now - orgRepoCache[org].timestamp > CACHE_DURATION) {
      delete orgRepoCache[org];
    }
  });
}

/**
 * Hook to fetch organization repositories with caching and tracking status
 */
export function useOrgRepos(org?: string): UseOrgReposState {
  const [state, setState] = useState<UseOrgReposState>({
    repositories: [],
    isLoading: true,
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!org) {
      setState({
        repositories: [],
        isLoading: false,
        error: new Error('Organization name is required'),
      });
      return;
    }

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const fetchOrgRepos = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        
        // Clean up old cache entries
        cleanupOrgCache();
        
        // Check cache first
        const cachedData = orgRepoCache[org];
        const now = Date.now();
        
        if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
          setState({
            repositories: cachedData.repositories,
            isLoading: false,
            error: null,
          });
          return;
        }

        // Fetch from GitHub API
        const octokit = new Octokit({
          auth: env.GITHUB_TOKEN,
        });
        
        const { data: repos } = await octokit.rest.repos.listForOrg({
          org,
          sort: 'pushed',
          direction: 'desc',
          per_page: 30, // Fetch a few more than we need in case some are filtered out
          type: 'public',
        });

        if (signal.aborted) return;

        // Filter out archived and disabled repos, and limit to reasonable amount
        const activeRepos = repos
          .filter(repo => !repo.archived && !repo.disabled)
          .slice(0, 25); // Max 25 as per requirements

        // Check tracking status for each repository
        const repoFullNames = activeRepos.map(repo => repo.full_name);
        
        const { data: trackedRepos } = await supabase
          .from('repositories')
          .select('full_name, last_updated')
          .in('full_name', repoFullNames);

        if (signal.aborted) return;

        // Combine GitHub data with tracking status
        const repositoriesWithTracking: RepositoryWithTracking[] = activeRepos.map(repo => {
          const trackedRepo = trackedRepos?.find(tr => tr.full_name === repo.full_name);
          
          return {
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            stargazers_count: repo.stargazers_count || 0,
            forks_count: repo.forks_count || 0,
            language: repo.language,
            html_url: repo.html_url,
            updated_at: repo.updated_at,
            archived: repo.archived || false,
            disabled: repo.disabled || false,
            is_tracked: Boolean(trackedRepo),
            is_processing: trackedRepo ? isRecentlyUpdated(trackedRepo.last_updated) : false,
          };
        });

        // Cache the results
        orgRepoCache[org] = {
          repositories: repositoriesWithTracking,
          timestamp: now,
        };

        setState({
          repositories: repositoriesWithTracking,
          isLoading: false,
          error: null,
        });
        
      } catch (error) {
        if (signal.aborted) return;
        
        console.error('Error fetching org repositories:', error);
        
        // Handle specific error cases
        let errorMessage = 'Failed to fetch repositories';
        if (error instanceof Error) {
          if (error.message.includes('404')) {
            errorMessage = `Organization "${org}" not found or not public`;
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

    fetchOrgRepos();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [org]);

  return state;
}

/**
 * Helper function to determine if a repository is currently being processed
 * (updated within the last hour)
 */
function isRecentlyUpdated(lastUpdated: string | null): boolean {
  if (!lastUpdated) return false;
  
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const updateTime = new Date(lastUpdated).getTime();
  
  return updateTime > oneHourAgo;
}