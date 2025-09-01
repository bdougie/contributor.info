import { useMemo } from 'react';
import {
  processContributionVisualization,
  type ContributionDataPoint,
  type VisualizationOptions,
} from '@/lib/utils/contribution-visualization';

// Re-export types and utilities for convenience
export type { ContributionDataPoint } from '@/lib/utils/contribution-visualization';
export { getGraySquareStyle, getAvatarStyle } from '@/lib/utils/contribution-visualization';

export type UseContributionVisualizationOptions = VisualizationOptions;

export interface ProcessedContribution {
  data: ContributionDataPoint;
  isUnique: boolean;
}

/**
 * Hook to process contribution data for visualization with unique contributor tracking
 * This is a React hook wrapper around the pure utility function
 *
 * @param contributions - Array of contribution data points
 * @param options - Configuration options for visualization
 * @returns Processed contributions with unique contributor tracking
 */
export function useContributionVisualization(
  contributions: ContributionDataPoint[],
  options: UseContributionVisualizationOptions
) {
  const { avatarSize, graySquareSize, graySquareOpacity } = options;

  return useMemo(() => {
    const result = processContributionVisualization(contributions, options);

    // Calculate sizes for rendering
    const visualizationData = result.processedData.map((contribution) => ({
      data: contribution,
      isUnique: contribution.showAsAvatar,
      size: contribution.showAsAvatar ? avatarSize : graySquareSize,
      opacity: contribution.showAsAvatar ? 1 : graySquareOpacity,
    }));

    return {
      ...result,
      visualizationData,
    };
  }, [contributions, options, avatarSize, graySquareSize, graySquareOpacity]);
}
