import { useState, useCallback } from 'react';
import { supabase } from '@/services/supabase-client';

// Base URL for GitHub API
const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Rate limit information returned from GitHub API
 */
interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

/**
 * Hook for interacting with the GitHub API
 */
export function useGitHubApi() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  
  /**
   * Get GitHub auth token from Supabase session
   */
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return null;
    }
    
    // For GitHub OAuth, we should be able to get a token from the provider token
    const token = session.provider_token;
    return token || null;
  }, []);
  
  /**
   * Create headers for GitHub API requests
   */
  const createHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAuthToken();
    
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };
    
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }
    
    return headers;
  }, [getAuthToken]);
  
  /**
   * Make a GET request to the GitHub API
   */
  const fetchFromGitHub = useCallback(async <T>(endpoint: string): Promise<T> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const headers = await createHeaders();
      const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, { headers });
      
      // Update rate limit info from headers
      if (response.headers.get('x-ratelimit-limit')) {
        setRateLimit({
          limit: parseInt(response.headers.get('x-ratelimit-limit') || '0'),
          remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '0'),
          reset: new Date(parseInt(response.headers.get('x-ratelimit-reset') || '0') * 1000),
          used: parseInt(response.headers.get('x-ratelimit-used') || '0'),
        });
      }
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data as T;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [createHeaders]);
  
  /**
   * Fetch repository information
   */
  const fetchRepository = useCallback(async (owner: string, repo: string) => {
    return fetchFromGitHub<any>(`/repos/${owner}/${repo}`);
  }, [fetchFromGitHub]);
  
  /**
   * Fetch user information
   */
  const fetchUser = useCallback(async (username: string) => {
    return fetchFromGitHub<any>(`/users/${username}`);
  }, [fetchFromGitHub]);
  
  /**
   * Fetch user organizations
   */
  const fetchUserOrganizations = useCallback(async (username: string) => {
    return fetchFromGitHub<any[]>(`/users/${username}/orgs`);
  }, [fetchFromGitHub]);
  
  /**
   * Fetch pull requests for a repository
   */
  const fetchPullRequests = useCallback(async (
    owner: string, 
    repo: string, 
    state: 'open' | 'closed' | 'all' = 'all'
  ) => {
    return fetchFromGitHub<any[]>(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=100`);
  }, [fetchFromGitHub]);
  
  /**
   * Check if user is rate limited
   */
  const isRateLimited = useCallback((): boolean => {
    if (!rateLimit) return false;
    return rateLimit.remaining <= 0;
  }, [rateLimit]);
  
  return {
    fetchFromGitHub,
    fetchRepository,
    fetchUser,
    fetchUserOrganizations,
    fetchPullRequests,
    isLoading,
    error,
    rateLimit,
    isRateLimited,
    getAuthToken
  };
}