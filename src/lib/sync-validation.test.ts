import { describe, it, expect } from 'vitest';

// Simple sync validation utilities
export const validateSyncLogEntry = (log: {
  sync_type?: string;
  status?: string;
  started_at?: string;
  records_processed?: number;
}) => {
  if (!log.sync_type) {
    return { isValid: false, error: 'Missing sync_type' };
  }

  const validStatuses = ['started', 'completed', 'failed', 'cancelled'];
  if (!log.status || !validStatuses.includes(log.status)) {
    return { isValid: false, error: 'Invalid status' };
  }

  if (!log.started_at) {
    return { isValid: false, error: 'Missing started_at timestamp' };
  }

  if (log.records_processed !== undefined && log.records_processed < 0) {
    return { isValid: false, error: 'Records processed cannot be negative' };
  }

  return { isValid: true, error: null };
};

export const validateSyncProgress = (progress: {
  repository_id?: string;
  status?: string;
  prs_processed?: number;
}) => {
  if (!progress.repository_id) {
    return { isValid: false, error: 'Missing repository_id' };
  }

  const validStatuses = ['partial', 'in_progress', 'completed', 'failed'];
  if (!progress.status || !validStatuses.includes(progress.status)) {
    return { isValid: false, error: 'Invalid progress status' };
  }

  if (progress.prs_processed !== undefined && progress.prs_processed < 0) {
    return { isValid: false, error: 'PRs processed cannot be negative' };
  }

  return { isValid: true, error: null };
};

export const calculateSyncSuccessRate = (logs: { status: string }[]) => {
  if (logs.length === 0) return 0;

  const successful = logs.filter((log) => log.status === 'completed').length;
  return Math.round((successful / logs.length) * 100);
};

describe('Sync Validation Utilities', () => {
  describe('validateSyncLogEntry', () => {
    it('should validate correct sync log', () => {
      const log = {
        sync_type: 'repository_sync',
        status: 'completed',
        started_at: '2024-01-01T00:00:00Z',
        records_processed: 10,
      };

      const result = validateSyncLogEntry(log);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject missing sync_type', () => {
      const log = {
        status: 'completed',
        started_at: '2024-01-01T00:00:00Z',
      };

      const result = validateSyncLogEntry(log);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing sync_type');
    });

    it('should reject invalid status', () => {
      const log = {
        sync_type: 'repository_sync',
        status: 'invalid_status',
        started_at: '2024-01-01T00:00:00Z',
      };

      const result = validateSyncLogEntry(log);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid status');
    });
  });

  describe('validateSyncProgress', () => {
    it('should validate correct progress entry', () => {
      const progress = {
        repository_id: 'test-id',
        status: 'completed',
        prs_processed: 25,
      };

      const result = validateSyncProgress(progress);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject negative processed count', () => {
      const progress = {
        repository_id: 'test-id',
        status: 'completed',
        prs_processed: -5,
      };

      const result = validateSyncProgress(progress);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('PRs processed cannot be negative');
    });
  });

  describe('calculateSyncSuccessRate', () => {
    it('should calculate 100% success rate', () => {
      const logs = [{ status: 'completed' }, { status: 'completed' }, { status: 'completed' }];

      const rate = calculateSyncSuccessRate(logs);
      expect(rate).toBe(100);
    });

    it('should calculate partial success rate', () => {
      const logs = [
        { status: 'completed' },
        { status: 'failed' },
        { status: 'completed' },
        { status: 'completed' },
      ];

      const rate = calculateSyncSuccessRate(logs);
      expect(rate).toBe(75);
    });

    it('should handle empty logs', () => {
      const rate = calculateSyncSuccessRate([]);
      expect(rate).toBe(0);
    });
  });
});
