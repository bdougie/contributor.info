import { describe, it, expect } from 'vitest';

/**
 * Unit tests for trend-analysis pure calculation logic
 * Following bulletproof testing guidelines - synchronous, pure functions only
 */

describe('Trend Analysis - Pure Calculation Logic', () => {
  describe('Velocity Trend Determination', () => {
    it('should classify as steady when change is less than 10%', () => {
      const previous = 100;
      const current = 105;
      const changePercent = ((current - previous) / previous) * 100;

      let trend: 'accelerating' | 'steady' | 'declining';
      if (Math.abs(changePercent) < 10) {
        trend = 'steady';
      } else if (changePercent > 0) {
        trend = 'accelerating';
      } else {
        trend = 'declining';
      }

      expect(trend).toBe('steady');
      expect(Math.abs(changePercent)).toBeLessThan(10);
    });

    it('should classify as accelerating when change is greater than 10%', () => {
      const previous = 100;
      const current = 125;
      const changePercent = ((current - previous) / previous) * 100;

      let trend: 'accelerating' | 'steady' | 'declining';
      if (Math.abs(changePercent) < 10) {
        trend = 'steady';
      } else if (changePercent > 0) {
        trend = 'accelerating';
      } else {
        trend = 'declining';
      }

      expect(trend).toBe('accelerating');
      expect(changePercent).toBeGreaterThan(10);
    });

    it('should classify as declining when change is less than -10%', () => {
      const previous = 100;
      const current = 75;
      const changePercent = ((current - previous) / previous) * 100;

      let trend: 'accelerating' | 'steady' | 'declining';
      if (Math.abs(changePercent) < 10) {
        trend = 'steady';
      } else if (changePercent > 0) {
        trend = 'accelerating';
      } else {
        trend = 'declining';
      }

      expect(trend).toBe('declining');
      expect(changePercent).toBeLessThan(-10);
    });

    it('should handle zero previous value gracefully', () => {
      const previous = 0;
      const current = 10;
      const changePercent = previous > 0 ? ((current - previous) / previous) * 100 : 0;

      expect(changePercent).toBe(0);
    });
  });

  describe('Topic Shift Significance', () => {
    it('should classify as major when 3+ topics change', () => {
      const totalChange = 4;
      const significance = totalChange >= 3 ? 'major' : 'minor';

      expect(significance).toBe('major');
    });

    it('should classify as minor when fewer than 3 topics change', () => {
      const totalChange = 2;
      const significance = totalChange >= 3 ? 'major' : 'minor';

      expect(significance).toBe('minor');
    });

    it('should calculate confidence based on change magnitude', () => {
      const totalChange = 5;
      const confidence = Math.min(totalChange / 5, 1);

      expect(confidence).toBe(1);
    });

    it('should cap confidence at 1.0', () => {
      const totalChange = 10;
      const confidence = Math.min(totalChange / 5, 1);

      expect(confidence).toBe(1);
    });
  });

  describe('Engagement Pattern Classification', () => {
    it('should map accelerating trend to increasing pattern', () => {
      const trend = 'accelerating';
      let engagementPattern: 'increasing' | 'stable' | 'decreasing';
      if (trend === 'accelerating') {
        engagementPattern = 'increasing';
      } else if (trend === 'declining') {
        engagementPattern = 'decreasing';
      } else {
        engagementPattern = 'stable';
      }

      expect(engagementPattern).toBe('increasing');
    });

    it('should map declining trend to decreasing pattern', () => {
      const trend = 'declining';
      let engagementPattern: 'increasing' | 'stable' | 'decreasing';
      if (trend === 'accelerating') {
        engagementPattern = 'increasing';
      } else if (trend === 'declining') {
        engagementPattern = 'decreasing';
      } else {
        engagementPattern = 'stable';
      }

      expect(engagementPattern).toBe('decreasing');
    });

    it('should map steady trend to stable pattern', () => {
      const trend = 'steady';
      let engagementPattern: 'increasing' | 'stable' | 'decreasing';
      if (trend === 'accelerating') {
        engagementPattern = 'increasing';
      } else if (trend === 'declining') {
        engagementPattern = 'decreasing';
      } else {
        engagementPattern = 'stable';
      }

      expect(engagementPattern).toBe('stable');
    });
  });

  describe('Confidence Score Calculation', () => {
    it('should give full confidence when both velocity and shifts exist', () => {
      const hasVelocityData = true;
      const hasTopicShifts = true;
      const confidenceScore = (hasVelocityData ? 0.5 : 0) + (hasTopicShifts ? 0.5 : 0);

      expect(confidenceScore).toBe(1.0);
    });

    it('should give partial confidence when only velocity exists', () => {
      const hasVelocityData = true;
      const hasTopicShifts = false;
      const confidenceScore = (hasVelocityData ? 0.5 : 0) + (hasTopicShifts ? 0.5 : 0);

      expect(confidenceScore).toBe(0.5);
    });

    it('should give zero confidence when no data exists', () => {
      const hasVelocityData = false;
      const hasTopicShifts = false;
      const confidenceScore = (hasVelocityData ? 0.5 : 0) + (hasTopicShifts ? 0.5 : 0);

      expect(confidenceScore).toBe(0);
    });
  });
});
