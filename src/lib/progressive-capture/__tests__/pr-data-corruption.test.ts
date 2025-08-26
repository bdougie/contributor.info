import { describe, it, expect, beforeEach, vi } from 'vitest';

// Helper functions for detecting and handling PR data corruption
export function isPRDataCorrupted(pr: any): boolean {
  return pr.additions === 0 && 
         pr.deletions === 0 && 
         pr.changed_files === 0 && 
         pr.commits === 0;
}

export function calculateCorruptionRate(prs: any[]): number {
  if (prs.length === 0) return 0;
  const corruptedCount = prs.filter(isPRDataCorrupted).length;
  return (corruptedCount / prs.length) * 100;
}

export function shouldTriggerAutoFix(prs: any[], threshold: number = 10): boolean {
  const corruptionRate = calculateCorruptionRate(prs);
  return corruptionRate > threshold;
}

export function getEffectiveThrottleHours(
  baseHours: number,
  hasCompleteData: boolean,
  isAutoFix: boolean = false
): number {
  // If auto-fix and data is incomplete, use minimal throttle
  if (isAutoFix && !hasCompleteData) {
    return Math.min(baseHours, 0.083); // 5 minutes max for incomplete data
  }
  return baseHours;
}

describe('PR Data Corruption Detection', () => {
  describe('isPRDataCorrupted', () => {
    it('should detect corrupted PR data', () => {
      const corruptedPR = {
        number: 7273,
        additions: 0,
        deletions: 0,
        changed_files: 0,
        commits: 0
      };
      expect(isPRDataCorrupted(corruptedPR)).toBe(true);
    });

    it('should detect valid PR data', () => {
      const validPR = {
        number: 7273,
        additions: 6,
        deletions: 1,
        changed_files: 1,
        commits: 1
      };
      expect(isPRDataCorrupted(validPR)).toBe(false);
    });

    it('should consider PR valid if any metric is non-zero', () => {
      const prsWithSingleMetric = [
        { additions: 1, deletions: 0, changed_files: 0, commits: 0 },
        { additions: 0, deletions: 1, changed_files: 0, commits: 0 },
        { additions: 0, deletions: 0, changed_files: 1, commits: 0 },
        { additions: 0, deletions: 0, changed_files: 0, commits: 1 }
      ];

      prsWithSingleMetric.forEach(pr => {
        expect(isPRDataCorrupted(pr)).toBe(false);
      });
    });

    it('should handle edge case of legitimate zero-change PRs', () => {
      // Some PRs legitimately have no changes (e.g., closed without merge)
      // But they should still have at least 1 commit
      const legitimateZeroPR = {
        additions: 0,
        deletions: 0,
        changed_files: 0,
        commits: 1, // At least one commit
        state: 'closed',
        merged: false
      };
      expect(isPRDataCorrupted(legitimateZeroPR)).toBe(false);
    });
  });

  describe('calculateCorruptionRate', () => {
    it('should calculate 0% corruption for all valid PRs', () => {
      const validPRs = [
        { additions: 10, deletions: 5, changed_files: 2, commits: 1 },
        { additions: 20, deletions: 10, changed_files: 3, commits: 2 },
        { additions: 30, deletions: 15, changed_files: 4, commits: 3 }
      ];
      expect(calculateCorruptionRate(validPRs)).toBe(0);
    });

    it('should calculate 100% corruption for all corrupted PRs', () => {
      const corruptedPRs = [
        { additions: 0, deletions: 0, changed_files: 0, commits: 0 },
        { additions: 0, deletions: 0, changed_files: 0, commits: 0 },
        { additions: 0, deletions: 0, changed_files: 0, commits: 0 }
      ];
      expect(calculateCorruptionRate(corruptedPRs)).toBe(100);
    });

    it('should calculate partial corruption rate', () => {
      const mixedPRs = [
        { additions: 10, deletions: 5, changed_files: 2, commits: 1 }, // valid
        { additions: 0, deletions: 0, changed_files: 0, commits: 0 },  // corrupted
        { additions: 20, deletions: 10, changed_files: 3, commits: 2 }, // valid
        { additions: 0, deletions: 0, changed_files: 0, commits: 0 }   // corrupted
      ];
      expect(calculateCorruptionRate(mixedPRs)).toBe(50);
    });

    it('should handle empty array', () => {
      expect(calculateCorruptionRate([])).toBe(0);
    });
  });

  describe('shouldTriggerAutoFix', () => {
    it('should trigger auto-fix when corruption exceeds threshold', () => {
      const prsWithHighCorruption = [
        { additions: 10, deletions: 5, changed_files: 2, commits: 1 },
        { additions: 0, deletions: 0, changed_files: 0, commits: 0 },
        { additions: 0, deletions: 0, changed_files: 0, commits: 0 }
      ];
      // 2 out of 3 corrupted = 66.67% > 10% threshold
      expect(shouldTriggerAutoFix(prsWithHighCorruption, 10)).toBe(true);
    });

    it('should not trigger auto-fix when corruption is below threshold', () => {
      const prsWithLowCorruption = [
        { additions: 10, deletions: 5, changed_files: 2, commits: 1 },
        { additions: 20, deletions: 10, changed_files: 3, commits: 2 },
        { additions: 30, deletions: 15, changed_files: 4, commits: 3 },
        { additions: 0, deletions: 0, changed_files: 0, commits: 0 }
      ];
      // 1 out of 4 corrupted = 25% < 50% threshold
      expect(shouldTriggerAutoFix(prsWithLowCorruption, 50)).toBe(false);
    });

    it('should use default threshold of 10%', () => {
      const prsWithModerateCorruption = [
        { additions: 10, deletions: 5, changed_files: 2, commits: 1 },
        { additions: 10, deletions: 5, changed_files: 2, commits: 1 },
        { additions: 10, deletions: 5, changed_files: 2, commits: 1 },
        { additions: 10, deletions: 5, changed_files: 2, commits: 1 },
        { additions: 10, deletions: 5, changed_files: 2, commits: 1 },
        { additions: 10, deletions: 5, changed_files: 2, commits: 1 },
        { additions: 10, deletions: 5, changed_files: 2, commits: 1 },
        { additions: 10, deletions: 5, changed_files: 2, commits: 1 },
        { additions: 0, deletions: 0, changed_files: 0, commits: 0 },
        { additions: 0, deletions: 0, changed_files: 0, commits: 0 }
      ];
      // 2 out of 10 = 20% > 10% default
      expect(shouldTriggerAutoFix(prsWithModerateCorruption)).toBe(true);
    });
  });

  describe('getEffectiveThrottleHours', () => {
    it('should use base hours when data is complete', () => {
      expect(getEffectiveThrottleHours(12, true, false)).toBe(12);
      expect(getEffectiveThrottleHours(1, true, true)).toBe(1);
    });

    it('should reduce throttle for auto-fix with incomplete data', () => {
      expect(getEffectiveThrottleHours(12, false, true)).toBe(0.083);
      expect(getEffectiveThrottleHours(1, false, true)).toBe(0.083);
    });

    it('should use base hours for non-auto-fix even with incomplete data', () => {
      expect(getEffectiveThrottleHours(12, false, false)).toBe(12);
    });

    it('should cap at 5 minutes minimum for incomplete auto-fix', () => {
      expect(getEffectiveThrottleHours(0.01, false, true)).toBe(0.01); // Already below cap
      expect(getEffectiveThrottleHours(24, false, true)).toBe(0.083); // Capped at 5 min
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle the August 2025 corruption scenario', () => {
      // Simulate the actual corruption that occurred
      const corruptedPRs = Array(198).fill(null).map((_, i) => ({
        number: 7000 + i,
        additions: 0,
        deletions: 0,
        changed_files: 0,
        commits: 0
      }));

      expect(calculateCorruptionRate(corruptedPRs)).toBe(100);
      expect(shouldTriggerAutoFix(corruptedPRs)).toBe(true);
      
      // With auto-fix and incomplete data, throttle should be minimal
      const throttleHours = getEffectiveThrottleHours(12, false, true);
      expect(throttleHours).toBe(0.083); // 5 minutes
    });

    it('should handle partial recovery scenario', () => {
      const partiallyRecoveredPRs = [
        ...Array(99).fill(null).map(() => ({
          additions: 100,
          deletions: 50,
          changed_files: 5,
          commits: 3
        })),
        ...Array(99).fill(null).map(() => ({
          additions: 0,
          deletions: 0,
          changed_files: 0,
          commits: 0
        }))
      ];

      expect(calculateCorruptionRate(partiallyRecoveredPRs)).toBe(50);
      expect(shouldTriggerAutoFix(partiallyRecoveredPRs)).toBe(true);
    });

    it('should handle fully recovered scenario', () => {
      const recoveredPRs = Array(198).fill(null).map((_, i) => ({
        number: 7000 + i,
        additions: Math.floor(Math.random() * 100) + 1,
        deletions: Math.floor(Math.random() * 50),
        changed_files: Math.floor(Math.random() * 10) + 1,
        commits: Math.floor(Math.random() * 5) + 1
      }));

      expect(calculateCorruptionRate(recoveredPRs)).toBe(0);
      expect(shouldTriggerAutoFix(recoveredPRs)).toBe(false);
    });
  });
});