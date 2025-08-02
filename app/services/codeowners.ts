import { Octokit } from '@octokit/rest';
import { minimatch } from 'minimatch';

export interface CodeOwner {
  pattern: string;
  owners: string[];
  isTeam: boolean[];
}

export interface ParsedCodeOwners {
  owners: CodeOwner[];
  source: 'github' | 'root' | null;
}

/**
 * Parse CODEOWNERS file content into structured format
 */
export function parseCodeOwners(content: string): CodeOwner[] {
  const lines = content.split('\n');
  const owners: CodeOwner[] = [];

  for (const line of lines) {
    // Skip empty lines and comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Split pattern and owners
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
      continue;
    }

    const pattern = parts[0];
    const ownersList = parts.slice(1);
    const isTeam = ownersList.map(owner => owner.includes('/'));

    owners.push({
      pattern,
      owners: ownersList,
      isTeam,
    });
  }

  return owners;
}

/**
 * Fetch CODEOWNERS file from repository
 */
export async function fetchCodeOwners(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<ParsedCodeOwners> {
  // Try .github/CODEOWNERS first
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: '.github/CODEOWNERS',
    });

    if ('content' in data && data.type === 'file') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return {
        owners: parseCodeOwners(content),
        source: 'github',
      };
    }
  } catch (error) {
    // File not found, continue to check root
  }

  // Try CODEOWNERS in root
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: 'CODEOWNERS',
    });

    if ('content' in data && data.type === 'file') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return {
        owners: parseCodeOwners(content),
        source: 'root',
      };
    }
  } catch (error) {
    // File not found
  }

  return {
    owners: [],
    source: null,
  };
}

/**
 * Match files against CODEOWNERS patterns
 */
export function matchFilesToOwners(
  files: string[],
  codeOwners: CodeOwner[]
): Map<string, Set<string>> {
  const fileOwners = new Map<string, Set<string>>();

  for (const file of files) {
    const owners = new Set<string>();

    // Process patterns in reverse order (later patterns override earlier ones)
    for (let i = codeOwners.length - 1; i >= 0; i--) {
      const { pattern, owners: patternOwners } = codeOwners[i];

      // Check if file matches pattern
      if (matchesPattern(file, pattern)) {
        // Add all owners for this pattern
        for (const owner of patternOwners) {
          owners.add(owner);
        }
        // In CODEOWNERS, the last matching pattern wins
        break;
      }
    }

    if (owners.size > 0) {
      fileOwners.set(file, owners);
    }
  }

  return fileOwners;
}

/**
 * Check if a file path matches a CODEOWNERS pattern
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Handle directory ownership (pattern ending with /)
  if (pattern.endsWith('/')) {
    const dir = pattern.slice(0, -1);
    return filePath.startsWith(dir + '/') || filePath === dir;
  }

  // Handle patterns starting with /
  if (pattern.startsWith('/')) {
    // Exact path from root
    const patternWithoutSlash = pattern.slice(1);
    return minimatch(filePath, patternWithoutSlash, { matchBase: false });
  }

  // Handle wildcards and general patterns
  return minimatch(filePath, pattern, { matchBase: true });
}

/**
 * Calculate ownership percentage for each owner based on changed files
 */
export function calculateOwnershipPercentage(
  fileOwners: Map<string, Set<string>>
): Map<string, number> {
  const ownerCounts = new Map<string, number>();
  const totalFiles = fileOwners.size;

  if (totalFiles === 0) {
    return ownerCounts;
  }

  // Count files owned by each owner
  for (const owners of fileOwners.values()) {
    for (const owner of owners) {
      ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
    }
  }

  // Convert to percentages
  const ownerPercentages = new Map<string, number>();
  for (const [owner, count] of ownerCounts) {
    const percentage = Math.round((count / totalFiles) * 100);
    ownerPercentages.set(owner, percentage);
  }

  return ownerPercentages;
}

/**
 * Extract GitHub username from CODEOWNERS entry
 */
export function extractUsername(owner: string): string | null {
  // Remove @ prefix if present
  const cleaned = owner.startsWith('@') ? owner.slice(1) : owner;

  // Handle team mentions (org/team)
  if (cleaned.includes('/')) {
    return null; // Skip teams for now
  }

  // Handle email addresses
  if (cleaned.includes('@') && cleaned.includes('.')) {
    return null; // Skip emails for now
  }

  return cleaned;
}

/**
 * Get suggested reviewers from CODEOWNERS
 */
export interface CodeOwnerSuggestion {
  username: string;
  ownershipPercentage: number;
  matchedFiles: number;
}

export function getSuggestedReviewersFromCodeOwners(
  changedFiles: string[],
  codeOwners: CodeOwner[],
  excludeUsername?: string
): CodeOwnerSuggestion[] {
  const fileOwners = matchFilesToOwners(changedFiles, codeOwners);
  const ownerPercentages = calculateOwnershipPercentage(fileOwners);

  const suggestions: CodeOwnerSuggestion[] = [];

  for (const [owner, percentage] of ownerPercentages) {
    const username = extractUsername(owner);
    
    // Skip if not a valid username or if it's the PR author
    if (!username || username === excludeUsername) {
      continue;
    }

    // Count matched files for this owner
    let matchedFiles = 0;
    for (const owners of fileOwners.values()) {
      if (owners.has(owner)) {
        matchedFiles++;
      }
    }

    suggestions.push({
      username,
      ownershipPercentage: percentage,
      matchedFiles,
    });
  }

  // Sort by ownership percentage (descending)
  return suggestions.sort((a, b) => b.ownershipPercentage - a.ownershipPercentage);
}