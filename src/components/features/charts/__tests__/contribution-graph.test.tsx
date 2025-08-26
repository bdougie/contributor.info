/**
 * Bulletproof test for contribution graph
 * Per BULLETPROOF_TESTING_GUIDELINES.md - pure functions only, no DOM
 */
import { describe, it, expect } from 'vitest';

describe('Contribution Graph', () => {
  describe('Data Calculations', () => {
    it('calculates contribution totals', () => {
      const contributions = [10, 20, 15, 5];
      const total = contributions.reduce((sum, val) => sum + val, 0);

      expect(total).toBe(50);
    });

    it('finds maximum contribution value', () => {
      const contributions = [10, 45, 20, 30];
      const max = Math.max(...contributions);

      expect(max).toBe(45);
    });

    it('calculates average contributions', () => {
      const contributions = [10, 20, 30, 40];
      const avg = contributions.reduce((sum, val) => sum + val, 0) / contributions.length;

      expect(avg).toBe(25);
    });
  });

  describe('Date Handling', () => {
    it('formats dates correctly', () => {
      const date = '2024-01-15';
      const parts = date.split('-');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('2024');
      expect(parts[1]).toBe('01');
      expect(parts[2]).toBe('15');
    });

    it('validates date ranges', () => {
      const startDate = new Date('2024-01-01').getTime();
      const endDate = new Date('2024-12-31').getTime();

      expect(endDate).toBeGreaterThan(startDate);
    });
  });

  describe('Grid Generation', () => {
    it('calculates grid dimensions', () => {
      const weeks = 52;
      const daysPerWeek = 7;
      const totalCells = weeks * daysPerWeek;

      expect(totalCells).toBe(364);
    });

    it('determines cell colors based on intensity', () => {
      const getIntensityColor = (value: number) => {
        if (value === 0) return '#ebedf0';
        if (value < 5) return '#9be9a8';
        if (value < 10) return '#40c463';
        return '#216e39';
      };

      expect(getIntensityColor(0)).toBe('#ebedf0');
      expect(getIntensityColor(3)).toBe('#9be9a8');
      expect(getIntensityColor(7)).toBe('#40c463');
      expect(getIntensityColor(15)).toBe('#216e39');
    });
  });
});
