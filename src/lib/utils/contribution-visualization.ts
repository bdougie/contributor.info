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
  showAsAvatar: boolean;
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
 */
export function processContributionVisualization(
  contributions: ContributionDataPoint[],
  options: VisualizationOptions
) {
  const { maxUniqueAvatars } = options;
  const uniqueContributors = new Set<string>();
  let uniqueAvatarCount = 0;

  // Process contributions to determine which should show as avatars
  const processedContributions = contributions.map((contribution) => {
    const isFirstOccurrence = !uniqueContributors.has(contribution.author);

    if (isFirstOccurrence) {
      uniqueContributors.add(contribution.author);
    }

    // Determine if this should show as an avatar
    const shouldShowAsAvatar = isFirstOccurrence && uniqueAvatarCount < maxUniqueAvatars;

    if (shouldShowAsAvatar) {
      uniqueAvatarCount++;
    }

    return {
      ...contribution,
      showAsAvatar: shouldShowAsAvatar,
      isFirstOccurrence,
      // Adjust z-index so avatars render on top
      zIndex: shouldShowAsAvatar ? contribution.zIndex + 1000 : contribution.zIndex,
    };
  });

  // Sort by z-index to ensure proper rendering order
  const sortedContributions = processedContributions.sort((a, b) => a.zIndex - b.zIndex);

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
