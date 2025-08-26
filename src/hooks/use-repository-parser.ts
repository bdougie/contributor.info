/**
 * Hook for parsing repository strings into owner and repo components
 */
export function useRepositoryParser() {
  /**
   * Parses a repository string (URL or owner/repo format) and returns the owner and repo
   * @param repoString - Repository string to parse
   * @returns Object containing owner and repo or null if invalid
   */
  const parseRepository = (repoString: string) => {
    const match = repoString.match(/(?:github\.com/)?([^/]+)/([^/]+)/);

    if (match) {
      const [, owner, repo] = match;
      return { owner, repo };
    }

    return null;
  };

  /**
   * Validates if a string is a valid repository format
   * @param repoString - Repository string to validate
   * @returns Boolean indicating if string is valid repository format
   */
  const isValidRepository = (repoString: string): boolean => {
    return !!repoString.match(/(?:github\.com/)?([^/]+)/([^/]+)/);
  };

  /**
   * Constructs a GitHub repository URL from owner and repo
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Full GitHub URL
   */
  const constructRepoUrl = (owner: string, repo: string): string => {
    return `https://github.com/${owner}/${repo}`;
  };

  return {
    parseRepository,
    isValidRepository,
    constructRepoUrl,
  };
}
