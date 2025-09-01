import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  useContributionVisualization,
  getGraySquareStyle,
  getAvatarStyle,
  type ContributionDataPoint,
} from '../use-contribution-visualization';

describe('useContributionVisualization', () => {
  const mockContributions: ContributionDataPoint[] = [
    {
      x: 1,
      y: 10,
      id: 'pr-1',
      author: 'user1',
      avatar: 'https://example.com/user1.jpg',
      prNumber: 1,
      prTitle: 'First PR',
      zIndex: 1,
      showAsAvatar: false,
    },
    {
      x: 2,
      y: 20,
      id: 'pr-2',
      author: 'user2',
      avatar: 'https://example.com/user2.jpg',
      prNumber: 2,
      prTitle: 'Second PR',
      zIndex: 2,
      showAsAvatar: false,
    },
    {
      x: 3,
      y: 15,
      id: 'pr-3',
      author: 'user1', // Duplicate contributor
      avatar: 'https://example.com/user1.jpg',
      prNumber: 3,
      prTitle: 'Third PR',
      zIndex: 3,
      showAsAvatar: false,
    },
    {
      x: 4,
      y: 25,
      id: 'pr-4',
      author: 'user3',
      avatar: 'https://example.com/user3.jpg',
      prNumber: 4,
      prTitle: 'Fourth PR',
      zIndex: 4,
      showAsAvatar: false,
    },
  ];

  const defaultOptions = {
    maxUniqueAvatars: 2,
    avatarSize: 35,
    graySquareSize: 21,
    graySquareOpacity: 0.6,
  };

  it('should identify unique contributors correctly', () => {
    const { result } = renderHook(() =>
      useContributionVisualization(mockContributions, defaultOptions)
    );

    expect(result.current.uniqueContributorCount).toBe(3); // user1, user2, user3
    expect(result.current.uniqueContributors).toEqual(['user1', 'user2', 'user3']);
  });

  it('should limit avatars to maxUniqueAvatars', () => {
    const { result } = renderHook(() =>
      useContributionVisualization(mockContributions, defaultOptions)
    );

    const avatarCount = result.current.processedData.filter((c) => c.showAsAvatar).length;
    expect(avatarCount).toBe(2); // Limited to maxUniqueAvatars
  });

  it('should mark first occurrence of each contributor', () => {
    const { result } = renderHook(() =>
      useContributionVisualization(mockContributions, defaultOptions)
    );

    // Find contributions by their IDs to check isFirstOccurrence regardless of sort order
    const firstUser1 = result.current.processedData.find((c) => c.id === 'pr-1');
    const secondUser1 = result.current.processedData.find((c) => c.id === 'pr-3');

    expect(firstUser1?.isFirstOccurrence).toBe(true);
    expect(secondUser1?.isFirstOccurrence).toBe(false);
  });

  it('should show duplicates as gray squares', () => {
    const { result } = renderHook(() =>
      useContributionVisualization(mockContributions, defaultOptions)
    );

    // Third contribution is from user1 (duplicate)
    const duplicateContribution = result.current.processedData.find((c) => c.id === 'pr-3');
    expect(duplicateContribution?.showAsAvatar).toBe(false);
  });

  it('should adjust z-index for avatars to render on top', () => {
    const { result } = renderHook(() =>
      useContributionVisualization(mockContributions, defaultOptions)
    );

    const avatars = result.current.processedData.filter((c) => c.showAsAvatar);
    const graySquares = result.current.processedData.filter((c) => !c.showAsAvatar);

    // All avatars should have higher z-index than gray squares
    const minAvatarZIndex = Math.min(...avatars.map((a) => a.zIndex));
    const maxGraySquareZIndex = Math.max(...graySquares.map((g) => g.zIndex));

    expect(minAvatarZIndex).toBeGreaterThan(maxGraySquareZIndex);
  });

  it('should sort contributions by z-index', () => {
    const { result } = renderHook(() =>
      useContributionVisualization(mockContributions, defaultOptions)
    );

    const zIndexes = result.current.processedData.map((c) => c.zIndex);
    const sortedZIndexes = [...zIndexes].sort((a, b) => a - b);
    expect(zIndexes).toEqual(sortedZIndexes);
  });

  it('should apply correct sizes and opacity in visualizationData', () => {
    const { result } = renderHook(() =>
      useContributionVisualization(mockContributions, defaultOptions)
    );

    result.current.visualizationData.forEach((item) => {
      if (item.isUnique) {
        expect(item.size).toBe(defaultOptions.avatarSize);
        expect(item.opacity).toBe(1);
      } else {
        expect(item.size).toBe(defaultOptions.graySquareSize);
        expect(item.opacity).toBe(defaultOptions.graySquareOpacity);
      }
    });
  });

  it('should handle empty contributions array', () => {
    const { result } = renderHook(() => useContributionVisualization([], defaultOptions));

    expect(result.current.processedData).toEqual([]);
    expect(result.current.uniqueContributorCount).toBe(0);
    expect(result.current.totalContributions).toBe(0);
    expect(result.current.uniqueContributors).toEqual([]);
  });

  it('should handle all unique contributors within limit', () => {
    const uniqueContributions: ContributionDataPoint[] = [
      {
        x: 1,
        y: 10,
        id: 'pr-1',
        author: 'user1',
        avatar: 'https://example.com/user1.jpg',
        prNumber: 1,
        prTitle: 'PR 1',
        zIndex: 1,
        showAsAvatar: false,
      },
      {
        x: 2,
        y: 20,
        id: 'pr-2',
        author: 'user2',
        avatar: 'https://example.com/user2.jpg',
        prNumber: 2,
        prTitle: 'PR 2',
        zIndex: 2,
        showAsAvatar: false,
      },
    ];

    const { result } = renderHook(() =>
      useContributionVisualization(uniqueContributions, defaultOptions)
    );

    // All should be avatars since we have 2 unique contributors and limit is 2
    const avatarCount = result.current.processedData.filter((c) => c.showAsAvatar).length;
    expect(avatarCount).toBe(2);
  });

  it('should handle maxUniqueAvatars of 0', () => {
    const { result } = renderHook(() =>
      useContributionVisualization(mockContributions, { ...defaultOptions, maxUniqueAvatars: 0 })
    );

    // No avatars should be shown
    const avatarCount = result.current.processedData.filter((c) => c.showAsAvatar).length;
    expect(avatarCount).toBe(0);
  });

  it('should preserve original contribution data', () => {
    const { result } = renderHook(() =>
      useContributionVisualization(mockContributions, defaultOptions)
    );

    result.current.processedData.forEach((processed) => {
      const original = mockContributions.find((c) => c.id === processed.id);
      expect(processed.x).toBe(original?.x);
      expect(processed.y).toBe(original?.y);
      expect(processed.author).toBe(original?.author);
      expect(processed.avatar).toBe(original?.avatar);
      expect(processed.prNumber).toBe(original?.prNumber);
      expect(processed.prTitle).toBe(original?.prTitle);
    });
  });
});

describe('getGraySquareStyle', () => {
  it('should return correct gray square styles', () => {
    const style = getGraySquareStyle(20, 0.5);

    expect(style).toEqual({
      width: 20,
      height: 20,
      backgroundColor: 'hsl(var(--muted))',
      opacity: 0.5,
      borderRadius: '4px',
    });
  });

  it('should handle different sizes and opacities', () => {
    const style = getGraySquareStyle(30, 0.8);

    expect(style.width).toBe(30);
    expect(style.height).toBe(30);
    expect(style.opacity).toBe(0.8);
  });
});

describe('getAvatarStyle', () => {
  it('should return correct avatar styles', () => {
    const style = getAvatarStyle(35, '#ffffff');

    expect(style).toEqual({
      width: 35,
      height: 35,
      borderRadius: '50%',
      border: '2px solid #ffffff',
      cursor: 'pointer',
    });
  });

  it('should handle different sizes and border colors', () => {
    const style = getAvatarStyle(40, 'hsl(var(--foreground))');

    expect(style.width).toBe(40);
    expect(style.height).toBe(40);
    expect(style.border).toBe('2px solid hsl(var(--foreground))');
  });
});
