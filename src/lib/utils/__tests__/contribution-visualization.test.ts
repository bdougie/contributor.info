import { describe, it, expect } from 'vitest';
import {
  processContributionVisualization,
  getGraySquareStyle,
  getAvatarStyle,
  type ContributionDataPoint,
} from '../contribution-visualization';

describe('processContributionVisualization', () => {
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
    {
      x: 5,
      y: 30,
      id: 'pr-5',
      author: 'user4',
      avatar: 'https://example.com/user4.jpg',
      prNumber: 5,
      prTitle: 'Fifth PR',
      zIndex: 5,
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
    const result = processContributionVisualization(mockContributions, defaultOptions);

    expect(result.uniqueContributorCount).toBe(4); // user1, user2, user3, user4
    expect(result.uniqueContributors).toEqual(['user1', 'user2', 'user3', 'user4']);
  });

  it('should limit avatars to maxUniqueAvatars', () => {
    const result = processContributionVisualization(mockContributions, defaultOptions);

    const avatarCount = result.processedData.filter((c) => c.showAsAvatar).length;
    expect(avatarCount).toBe(2); // Limited to maxUniqueAvatars
  });

  it('should mark first occurrence of each contributor', () => {
    const result = processContributionVisualization(mockContributions, defaultOptions);

    // Find contributions by their IDs to check isFirstOccurrence regardless of sort order
    const firstUser1 = result.processedData.find((c) => c.id === 'pr-1');
    const secondUser1 = result.processedData.find((c) => c.id === 'pr-3');

    expect(firstUser1?.isFirstOccurrence).toBe(true);
    expect(secondUser1?.isFirstOccurrence).toBe(false);
  });

  it('should show duplicates as gray squares', () => {
    const result = processContributionVisualization(mockContributions, defaultOptions);

    // Third contribution is from user1 (duplicate)
    const duplicateContribution = result.processedData.find((c) => c.id === 'pr-3');
    expect(duplicateContribution?.showAsAvatar).toBe(false);
  });

  it('should adjust z-index for avatars to render on top', () => {
    const result = processContributionVisualization(mockContributions, defaultOptions);

    const avatars = result.processedData.filter((c) => c.showAsAvatar);
    const graySquares = result.processedData.filter((c) => !c.showAsAvatar);

    // All avatars should have higher z-index than original
    avatars.forEach((avatar) => {
      const original = mockContributions.find((c) => c.id === avatar.id);
      expect(avatar.zIndex).toBeGreaterThan(original!.zIndex);
    });

    // Gray squares should keep their original z-index
    graySquares.forEach((square) => {
      const original = mockContributions.find((c) => c.id === square.id);
      expect(square.zIndex).toBe(original!.zIndex);
    });
  });

  it('should sort contributions by z-index', () => {
    const result = processContributionVisualization(mockContributions, defaultOptions);

    const zIndexes = result.processedData.map((c) => c.zIndex);
    const sortedZIndexes = [...zIndexes].sort((a, b) => a - b);
    expect(zIndexes).toEqual(sortedZIndexes);
  });

  it('should handle empty contributions array', () => {
    const result = processContributionVisualization([], defaultOptions);

    expect(result.processedData).toEqual([]);
    expect(result.uniqueContributorCount).toBe(0);
    expect(result.totalContributions).toBe(0);
    expect(result.uniqueContributors).toEqual([]);
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

    const result = processContributionVisualization(uniqueContributions, defaultOptions);

    // All should be avatars since we have 2 unique contributors and limit is 2
    const avatarCount = result.processedData.filter((c) => c.showAsAvatar).length;
    expect(avatarCount).toBe(2);
  });

  it('should handle maxUniqueAvatars of 0', () => {
    const result = processContributionVisualization(mockContributions, {
      ...defaultOptions,
      maxUniqueAvatars: 0,
    });

    // No avatars should be shown
    const avatarCount = result.processedData.filter((c) => c.showAsAvatar).length;
    expect(avatarCount).toBe(0);
  });

  it('should preserve original contribution data', () => {
    const result = processContributionVisualization(mockContributions, defaultOptions);

    result.processedData.forEach((processed) => {
      const original = mockContributions.find((c) => c.id === processed.id);
      expect(processed.x).toBe(original?.x);
      expect(processed.y).toBe(original?.y);
      expect(processed.author).toBe(original?.author);
      expect(processed.avatar).toBe(original?.avatar);
      expect(processed.prNumber).toBe(original?.prNumber);
      expect(processed.prTitle).toBe(original?.prTitle);
    });
  });

  it('should correctly order avatars and gray squares', () => {
    const result = processContributionVisualization(mockContributions, {
      ...defaultOptions,
      maxUniqueAvatars: 3,
    });

    // First 3 unique contributors should be avatars
    const firstThreeUnique = ['user1', 'user2', 'user3'];

    result.processedData.forEach((item) => {
      const isFirstThreeUnique = firstThreeUnique.includes(item.author) && item.isFirstOccurrence;

      if (isFirstThreeUnique) {
        expect(item.showAsAvatar).toBe(true);
      } else {
        expect(item.showAsAvatar).toBe(false);
      }
    });
  });

  it('should track total contributions correctly', () => {
    const result = processContributionVisualization(mockContributions, defaultOptions);

    expect(result.totalContributions).toBe(mockContributions.length);
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

  it('should handle zero values', () => {
    const style = getGraySquareStyle(0, 0);

    expect(style.width).toBe(0);
    expect(style.height).toBe(0);
    expect(style.opacity).toBe(0);
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

  it('should handle CSS variable colors', () => {
    const style = getAvatarStyle(25, 'var(--primary)');

    expect(style.border).toBe('2px solid var(--primary)');
  });
});
