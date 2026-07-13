/**
 * Utility functions for contribution visualization processing
 * These are the pure functions used by the useContributionVisualization hook
 */

export interface ContributionDataPoint {
  x: number;
  y: number;
  id: string;
  author: string;
  avatar: string;
  prNumber: number;
  prTitle: string;
  zIndex: number;
  showAsAvatar?: boolean; // Optional since it's set by processContributionVisualization
  isFirstOccurrence?: boolean;
}

export interface VisualizationOptions {
  maxUniqueAvatars: number;
  avatarSize: number;
  graySquareSize: number;
  graySquareOpacity: number;
}

/**
 * Process contributions to determine which should show as avatars vs gray squares
 * This is a pure function that can be used anywhere (not just in React components)
 *
 * Each contributor gets exactly one avatar, placed on their LARGEST PR in the
 * window (ties broken by recency); their other PRs render as gray squares.
 * Anchoring identity to the largest contribution disperses avatars across the
 * plot — the input is sorted newest-first, so keying off the first occurrence
 * piled every avatar onto the most recent few days — and it labels the points
 * that visually dominate the chart. When contributors outnumber avatar slots,
 * the ones with the biggest PRs are identified and the rest stay gray.
 */
export function processContributionVisualization(
  contributions: ContributionDataPoint[],
  options: VisualizationOptions
) {
  const { maxUniqueAvatars } = options;

  // Pick each contributor's representative point: largest y, then most recent
  // (smaller x = fewer days ago)
  const representativeByAuthor = new Map<string, ContributionDataPoint>();
  for (const contribution of contributions) {
    const current = representativeByAuthor.get(contribution.author);
    if (
      !current ||
      contribution.y > current.y ||
      (contribution.y === current.y && contribution.x < current.x)
    ) {
      representativeByAuthor.set(contribution.author, contribution);
    }
  }

  const avatarPointIds = new Set(
    [...representativeByAuthor.values()]
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .slice(0, Math.max(0, maxUniqueAvatars))
      .map((point) => point.id)
  );

  const uniqueContributors = new Set<string>();

  const processedContributions = contributions.map((contribution) => {
    const isFirstOccurrence = !uniqueContributors.has(contribution.author);

    if (isFirstOccurrence) {
      uniqueContributors.add(contribution.author);
    }

    const shouldShowAsAvatar = avatarPointIds.has(contribution.id);

    return {
      ...contribution,
      showAsAvatar: shouldShowAsAvatar,
      isFirstOccurrence,
      // Adjust z-index so avatars render on top
      zIndex: shouldShowAsAvatar ? contribution.zIndex + 1000 : contribution.zIndex,
    };
  });

  // Sort to ensure proper rendering order: gray squares first, then avatars
  // This guarantees avatars always render above gray squares regardless of zIndex
  const sortedContributions = processedContributions.sort((a, b) => {
    // First priority: showAsAvatar (avatars render on top)
    if (a.showAsAvatar !== b.showAsAvatar) {
      return a.showAsAvatar ? 1 : -1; // Avatars (true) come after gray squares (false)
    }
    // Second priority: z-index for items of the same type
    return a.zIndex - b.zIndex;
  });

  return {
    processedData: sortedContributions,
    uniqueContributorCount: uniqueContributors.size,
    totalContributions: contributions.length,
    uniqueContributors: Array.from(uniqueContributors),
  };
}

/**
 * Helper function to create gray square style
 */
export function getGraySquareStyle(size: number, opacity: number) {
  return {
    width: size,
    height: size,
    backgroundColor: 'hsl(var(--muted))',
    opacity,
    borderRadius: '4px',
  };
}

/**
 * Helper function to create avatar style
 */
export function getAvatarStyle(size: number, borderColor: string) {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    border: `2px solid ${borderColor}`,
    cursor: 'pointer',
  };
}
