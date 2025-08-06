import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import * as GitHubApiService from '@/lib/github/api-service';
import type { RateLimitInfo, GitHubApiConfig } from '@/lib/github/api-service';

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
    try {
      const sessionData = await supabase.auth.getSession();
      
      if (!sessionData?.data?.session) {
        return null;
      }
      
      // For GitHub OAuth, we should be able to get a token from the provider token
      const token = sessionData.data.session.provider_token;
      return token || null;
    } catch (err) {
      console.error('Failed to get auth token:', err);
      return null;
    }
  }, []);
  
  /**
   * Create API config with current auth token
   */
  const createApiConfig = useCallback(async (): Promise<GitHubApiConfig> => {
    const token = await getAuthToken();
    return { token };
  }, [getAuthToken]);
  
  /**
   * Make a GET request to the GitHub API
   */
  const fetchFromGitHub = useCallback(async <T>(endpoint: string): Promise<T> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const config = await createApiConfig();
      const result = await GitHubApiService.fetchFromGitHub<T>(endpoint, config);
      
      // Update rate limit info
      if (result.rateLimit) {
        setRateLimit(result.rateLimit);
      }
      
      return result.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [createApiConfig]);
  
  /**
   * Fetch repository information
   */
  const fetchRepository = useCallback(async (owner: string, repo: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const config = await createApiConfig();
      const result = await GitHubApiService.fetchRepository(owner, repo, config);
      
      if (result.rateLimit) {
        setRateLimit(result.rateLimit);
      }
      
      return result.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [createApiConfig]);
  
  /**
   * Fetch user information
   */
  const fetchUser = useCallback(async (username: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const config = await createApiConfig();
      const result = await GitHubApiService.fetchUser(username, config);
      
      if (result.rateLimit) {
        setRateLimit(result.rateLimit);
      }
      
      return result.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [createApiConfig]);
  
  /**
   * Fetch user organizations
   */
  const fetchUserOrganizations = useCallback(async (username: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const config = await createApiConfig();
      const result = await GitHubApiService.fetchUserOrganizations(username, config);
      
      if (result.rateLimit) {
        setRateLimit(result.rateLimit);
      }
      
      return result.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [createApiConfig]);
  
  /**
   * Fetch pull requests for a repository
   */
  const fetchPullRequests = useCallback(async (
    owner: string, 
    repo: string, 
    state: 'open' | 'closed' | 'all' = 'all'
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const config = await createApiConfig();
      const result = await GitHubApiService.fetchPullRequests(owner, repo, state, config);
      
      if (result.rateLimit) {
        setRateLimit(result.rateLimit);
      }
      
      return result.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [createApiConfig]);
  
  /**
   * Check if user is rate limited
   */
  const isRateLimited = useCallback((): boolean => {
    return GitHubApiService.isRateLimited(rateLimit);
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