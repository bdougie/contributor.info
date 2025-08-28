import { describe, it, expect } from 'vitest';
import {
  getScoreBgColor,
  getScoreTextColor,
  getHitRateColor,
  getScoreStatusColor,
} from '../score-styling';

describe('score-styling utilities', () => {
  describe('getScoreBgColor', () => {
    it('returns green for scores >= 80', () => {
      expect(getScoreBgColor(80)).toBe('bg-green-500');
      expect(getScoreBgColor(90)).toBe('bg-green-500');
      expect(getScoreBgColor(100)).toBe('bg-green-500');
    });

    it('returns yellow for scores >= 60 and < 80', () => {
      expect(getScoreBgColor(60)).toBe('bg-yellow-500');
      expect(getScoreBgColor(70)).toBe('bg-yellow-500');
      expect(getScoreBgColor(79)).toBe('bg-yellow-500');
    });

    it('returns red for scores < 60', () => {
      expect(getScoreBgColor(0)).toBe('bg-red-500');
      expect(getScoreBgColor(30)).toBe('bg-red-500');
      expect(getScoreBgColor(59)).toBe('bg-red-500');
    });

    it('handles edge cases', () => {
      expect(getScoreBgColor(-1)).toBe('bg-red-500');
      expect(getScoreBgColor(101)).toBe('bg-green-500');
    });
  });

  describe('getScoreTextColor', () => {
    it('returns green text for scores >= 80', () => {
      expect(getScoreTextColor(80)).toBe('text-green-600');
      expect(getScoreTextColor(95)).toBe('text-green-600');
    });

    it('returns yellow text for scores >= 60 and < 80', () => {
      expect(getScoreTextColor(60)).toBe('text-yellow-600');
      expect(getScoreTextColor(75)).toBe('text-yellow-600');
    });

    it('returns red text for scores < 60', () => {
      expect(getScoreTextColor(25)).toBe('text-red-600');
      expect(getScoreTextColor(59)).toBe('text-red-600');
    });
  });

  describe('getHitRateColor', () => {
    it('returns correct colors based on hit rate thresholds', () => {
      expect(getHitRateColor(85)).toBe('text-green-600');
      expect(getHitRateColor(65)).toBe('text-yellow-600');
      expect(getHitRateColor(45)).toBe('text-red-600');
    });

    it('handles boundary values correctly', () => {
      expect(getHitRateColor(80)).toBe('text-green-600');
      expect(getHitRateColor(60)).toBe('text-yellow-600');
      expect(getHitRateColor(59.9)).toBe('text-red-600');
    });
  });

  describe('getScoreStatusColor', () => {
    it('returns dark mode compatible colors', () => {
      expect(getScoreStatusColor(85)).toBe('text-green-800 dark:text-green-200');
      expect(getScoreStatusColor(65)).toBe('text-yellow-800 dark:text-yellow-200');
      expect(getScoreStatusColor(45)).toBe('text-red-800 dark:text-red-200');
    });
  });
});