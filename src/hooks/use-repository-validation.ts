import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export interface ValidationResult {
  status: 'exists_in_db' | 'exists_on_github' | 'not_found' | 'checking' | 'error';
  repository?: {
    owner: string;
    name: string;
    full_name: string;
    description: string | null;
    stars: number;
    language: string | null;
    private: boolean;
  };
  suggestion?: string;
  isLoading: boolean;
  error?: string;
}

interface UseRepositoryValidationOptions {
  autoRedirect?: boolean;
  autoTrack?: boolean;
}

// Cache validation results to prevent duplicate API calls
const validationCache = new Map<string, ValidationResult>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

export function useRepositoryValidation(
  owner: string | null,
  repo: string | null,
  options: UseRepositoryValidationOptions = {},
): ValidationResult {
  const { autoRedirect = true, autoTrack = true } = options;
  const navigate = useNavigate();
  const [result, setResult] = useState<ValidationResult>({
    status: 'checking',
    isLoading: true,
  });
  const isValidating = useRef(false);
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!owner || !repo) {
      setResult({
        status: 'not_found',
        isLoading: false,
        error: 'Invalid repository path',
      });
      return;
    }

    const cacheKey = `${owner}/${repo}`;

    // Check cache first
    if (validationCache.has(cacheKey)) {
      const cachedTime = cacheTimestamps.get(cacheKey) || 0;
      if (Date.now() - cachedTime < CACHE_TTL) {
        const cached = validationCache.get(cacheKey)!;
        setResult(cached);

        // Handle auto-redirect for cached results
        if (autoRedirect && cached.status === 'exists_in_db' && !cached.isLoading) {
          navigate(`/${owner}/${repo}`, { replace: true });
        }
        return;
      }
    }

    // Prevent duplicate validation calls
    if (isValidating.current) {
      return;
    }

    isValidating.current = true;
    validateRepository();

    async function validateRepository() {
      try {
        setResult({
          status: 'checking',
          isLoading: true,
        });

        // Call the validation API
        const response = await fetch(`/api/validate-repository?owner=${owner}&repo=${repo}`);

        if (!response.ok) {
          throw new Error(`Validation failed: ${response.statusText}`);
        }

        const _ = await response.json();

        // Process the validation result
        const validationResult: ValidationResult = {
          status: data.status,
          repository: data.repository,
          suggestion: data.suggestion,
          isLoading: false,
        };

        // Cache the result
        validationCache.set(cacheKey, validationResult);
        cacheTimestamps.set(cacheKey, Date.now());

        setResult(validationResult);

        // Handle auto-redirect
        if (autoRedirect && _data.status === 'exists_in_db') {
          // Repository exists in database, redirect to it
          navigate(`/${owner}/${repo}`, { replace: true });
        } else if (autoTrack && _data.status === 'exists_on_github' && !hasTracked.current) {
          // Repository exists on GitHub but not in our database
          // Auto-track it and then redirect
          hasTracked.current = true;
          await trackRepository(owner!, repo!);

          // After tracking, redirect to the repository page
          if (autoRedirect) {
            setTimeout(() => {
              navigate(`/${owner}/${repo}`, { replace: true });
            }, 1000); // Small delay to allow tracking to complete
          }
        }
      } catch () {
        console.error('Repository validation error:', _error);

        const errorResult: ValidationResult = {
          status: 'error',
          isLoading: false,
          error: error instanceof Error ? error.message : 'Validation failed',
        };

        // Cache error results for a shorter time
        validationCache.set(cacheKey, _errorResult);
        cacheTimestamps.set(cacheKey, Date.now() - (CACHE_TTL - 60000)); // Cache for 1 minute

        setResult(_errorResult);
      } finally {
        isValidating.current = false;
      }
    }
  }, [owner, repo, autoRedirect, autoTrack, navigate]);

  return result;
}

async function trackRepository(owner: string, repo: string): Promise<void> {
  try {
    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Insert the repository into tracked_repositories
    const { error } = await supabase
      .from('tracked_repositories')
      .insert({
        full_name: `${owner}/${repo}`,
        owner,
        name: repo,
        is_active: true,
        added_by: session?.user?.id || undefined,
        added_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (_error) {
      // Handle duplicate key error gracefully
      if (_error.code === '23505') {
        console.log('Repository already tracked');
      } else {
        console.error('Error tracking repository:', _error);
      }
    } else {
      console.log('Successfully tracked repository: %s/%s', owner, repo);

      // Trigger initial data sync (using existing infrastructure)
      try {
        // Dispatch a custom event that the app can listen to for syncing
        window.dispatchEvent(
          new CustomEvent('repository-tracked', {
            detail: { owner, repo, full_name: `${owner}/${repo}` },
          }),
        );
      } catch (_e) {
        console.error('Error dispatching tracking event:', e);
      }
    }
  } catch () {
    console.error('Error in trackRepository:', _error);
  }
}

// Utility function to clear cache (useful for testing or manual refresh)
export function clearValidationCache(): void {
  validationCache.clear();
  cacheTimestamps.clear();
}

// Utility function to check if a path looks like a repository
export function isRepositoryPath(pathname: string): {
  isRepo: boolean;
  owner?: string;
  repo?: string;
} {
  // Remove leading slash and any trailing slashes
  const cleanPath = pathname.replace(/^\/+|\/+$/g, '');

  // Check if it matches the pattern: owner/repo (with optional sub-paths)
  const parts = cleanPath.split('/');

  if (parts.length >= 2) {
    const [owner, repo] = parts;

    // Basic validation: both parts should exist and not contain special characters
    // that wouldn't be valid in GitHub usernames/repo names
    const isValidName = (name: string) => /^[a-zA-Z0-9][\w.-]*$/.test(name);

    if (owner && repo && isValidName(owner) && isValidName(repo)) {
      return {
        isRepo: true,
        owner,
        repo: repo.split(/[?#]/)[0], // Remove query params or hash
      };
    }
  }

  return { isRepo: false };
}
