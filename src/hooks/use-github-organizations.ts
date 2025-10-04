import { useState, useEffect } from 'react';

// We'll need to verify this constant exists or add it
const GITHUB_API_BASE = 'https://api.github.com';

interface Organization {
  login: string;
  avatar_url: string;
}

/**
 * Hook to fetch and handle a GitHub user's organizations
 * @param username - GitHub username to fetch organizations for
 * @param token - Optional GitHub access token for authenticated requests
 */
export function useGitHubOrganizations(username: string, token?: string) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchOrganizations() {
      if (!username) return;

      setLoading(true);
      setError(null);

      try {
        const headers: HeadersInit = {
          Accept: 'application/vnd.github.v3+json',
        };

        if (token) {
          headers.Authorization = `token ${token}`;
        }

        const response = await fetch(`${GITHUB_API_BASE}/users/${username}/orgs`, { headers });

        if (!response.ok) {
          throw new Error(`Failed to fetch organizations: ${response.status}`);
        }

        const orgs = (await response.json()) as Array<{
          login: string;
          avatar_url: string;
          [key: string]: unknown;
        }>;
        setOrganizations(
          orgs.slice(0, 3).map((org) => ({
            login: org.login,
            avatar_url: org.avatar_url,
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch organizations'));
      } finally {
        setLoading(false);
      }
    }

    fetchOrganizations();
  }, [username, token]);

  return { organizations, loading, error };
}
