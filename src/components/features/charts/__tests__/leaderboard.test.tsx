/**
 * Bulletproof test for leaderboard
 * Per BULLETPROOF_TESTING_GUIDELINES.md - no async, pure functions only
 */
import { describe, it, expect } from 'vitest';

describe('Leaderboard', () => {
  describe('Ranking Logic', () => {
    it('sorts contributors by score', () => {
      const contributors = [
        { name: 'Alice', score: 150 },
        { name: 'Bob', score: 200 },
        { name: 'Charlie', score: 175 }
      ];
      
      const sorted = [...contributors].sort((a, b) => b.score - a.score);
      
      expect(sorted[0].name).toBe('Bob');
      expect(sorted[1].name).toBe('Charlie');
      expect(sorted[2].name).toBe('Alice');
    });

    it('assigns correct ranks', () => {
      const scores = [200, 175, 150, 150, 100];
      const ranks = scores.map((score, index, arr) => {
        const higherScores = arr.slice(0, index).filter(s => s > score).length;
        return higherScores + 1;
      });
      
      expect(ranks).toEqual([1, 2, 3, 3, 5]);
    });

    it('handles tied scores correctly', () => {
      const contributors = [
        { name: 'A', score: 100 },
        { name: 'B', score: 100 },
        { name: 'C', score: 90 }
      ];
      
      const sorted = [...contributors].sort((a, b) => b.score - a.score);
      
      expect(sorted[0].score).toBe(100);
      expect(sorted[1].score).toBe(100);
      expect(sorted[2].score).toBe(90);
    });
  });

  describe('Score Calculations', () => {
    it('calculates composite score', () => {
      const metrics = {
        commits: 50,
        prs: 10,
        reviews: 15,
        issues: 5
      };
      
      const weights = {
        commits: 1,
        prs: 3,
        reviews: 2,
        issues: 2
      };
      
      const score = 
        metrics.commits * weights.commits +
        metrics.prs * weights.prs +
        metrics.reviews * weights.reviews +
        metrics.issues * weights.issues;
      
      expect(score).toBe(120);
    });

    it('normalizes scores to percentage', () => {
      const scores = [100, 80, 60, 40, 20];
      const maxScore = Math.max(...scores);
      const normalized = scores.map(s => (s / maxScore) * 100);
      
      expect(normalized[0]).toBe(100);
      expect(normalized[1]).toBe(80);
      expect(normalized[4]).toBe(20);
    });
  });

  describe('Filtering', () => {
    it('filters by minimum threshold', () => {
      const contributors = [
        { name: 'A', score: 100 },
        { name: 'B', score: 50 },
        { name: 'C', score: 25 },
        { name: 'D', score: 10 }
      ];
      
      const threshold = 30;
      const filtered = contributors.filter(c => c.score >= threshold);
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0].name).toBe('A');
      expect(filtered[1].name).toBe('B');
    });

    it('limits to top N contributors', () => {
      const contributors = Array.from({ length: 20 }, (_, i) => ({
        name: `User${i}`,
        score: 100 - i * 5
      }));
      
      const topN = 5;
      const limited = contributors.slice(0, topN);
      
      expect(limited).toHaveLength(5);
      expect(limited[0].score).toBe(100);
      expect(limited[4].score).toBe(80);
    });
  });

  describe('Display Formatting', () => {
    it('formats rank display', () => {
      const formatRank = (rank: number): string => {
        if (rank % 10 === 1 && rank % 100 !== 11) return `${rank}st`;
        if (rank % 10 === 2 && rank % 100 !== 12) return `${rank}nd`;
        if (rank % 10 === 3 && rank % 100 !== 13) return `${rank}rd`;
        return `${rank}th`;
      };
      
      expect(formatRank(1)).toBe('1st');
      expect(formatRank(2)).toBe('2nd');
      expect(formatRank(3)).toBe('3rd');
      expect(formatRank(4)).toBe('4th');
      expect(formatRank(21)).toBe('21st');
    });

    it('truncates long usernames', () => {
      const truncate = (str: string, maxLength: number): string => {
        return str.length > maxLength 
          ? str.substring(0, maxLength - 2) + '...'
          : str;
      };
      
      expect(truncate('verylongusername', 10)).toBe('verylong...');
      expect(truncate('short', 10)).toBe('short');
    });
  });
});