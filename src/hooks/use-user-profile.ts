import { useState, useEffect } from 'react';
import { fetchAndCacheUserProfile } from '@/services/github-profile';

interface UserProfile {
  login: string;
  name: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  websiteUrl: string | null;
  organizations: Array<{
    login: string;
    avatarUrl: string;
    name: string | null;
  }>;
}

interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Custom hook to fetch user profile information from GitHub
 * @param username - GitHub username to fetch profile for
 * @param enabled - Whether to fetch the profile (default: true)
 * @returns Profile data, loading state, and error
 */
export function useUserProfile(username: string, enabled: boolean = true): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!username || !enabled || username.trim() === '') {
      return;
    }

    let isMounted = true;

    async function fetchProfile() {
      setLoading(true);
      setError(null);

      try {
        const profileData = await fetchAndCacheUserProfile(username);
        
        if (isMounted) {
          setProfile(profileData);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [username, enabled]);

  return { profile, loading, error };
}
