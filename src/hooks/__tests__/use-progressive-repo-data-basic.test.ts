import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

// Minimal mocking - only what's absolutely necessary
vi.mock('@/lib/supabase-direct-commits', () => ({
  fetchDirectCommitsWithDatabaseFallback: vi.fn(),
}));

vi.mock('@/lib/supabase-pr-_data-smart-deduped', () => ({
  fetchPRDataSmart: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  calculateLotteryFactor: vi.fn(),
}));

vi.mock('@/lib/simple-logging', () => ({
  setApplicationContext: vi.fn(),
  startSpan: vi.fn((options, fn) => fn({ setStatus: vi.fn() })),
}));

import { useProgressiveRepoData } from '../use-progressive-repo-data';
import { setupBasicMocks, cleanupMocks, mockPRData } from './test-utils';
import { fetchDirectCommitsWithDatabaseFallback } from '@/lib/supabase-direct-commits';
import { fetchPRDataSmart } from '@/lib/supabase-pr-data-smart-deduped';
import { calculateLotteryFactor } from '@/lib/utils';

describe('useProgressiveRepoData - Basic Tests', () => {
  const fetchDirectCommitsMock = fetchDirectCommitsWithDatabaseFallback as ReturnType<typeof vi.fn>;
  const fetchPRDataMock = fetchPRDataSmart as ReturnType<typeof vi.fn>;
  const calculateLotteryFactorMock = calculateLotteryFactor as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setupBasicMocks();
    vi.clearAllMocks();
    
    // Set up default mock return values
    fetchDirectCommitsMock.mockResolvedValue({ commits: [], totalCommits: 0 });
    fetchPRDataMock.mockResolvedValue({ 
      data: mockPRData, 
      status: 'success', 
      message: 'Data loaded' 
    });
    calculateLotteryFactorMock.mockReturnValue({ 
      factor: 0.5, 
      description: 'Test', 
      category: 'balanced' 
    });
  });

  afterEach(() => {
    cleanup();
    cleanupMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      expect(result.current.basicInfo).toBe(null);
      expect(result.current.stats.loading).toBe(true);
      expect(result.current.stats._error).toBe(null);
      expect(result.current.stats.pullRequests).toEqual([]);
      expect(result.current.currentStage).toBe('initial');
    });

    it('should not start loading without owner', () => {
      const { result } = renderHook(() => 
        useProgressiveRepoData(undefined, 'repo', '90d', false)
      );
      
      // When no owner, loading should be true initially but no API calls
      expect(result.current.currentStage).toBe('initial');
      expect(fetchPRDataMock).not.toHaveBeenCalled();
    });

    it('should not start loading without repo', () => {
      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', undefined, '90d', false)
      );
      
      // When no repo, loading should be true initially but no API calls
      expect(result.current.currentStage).toBe('initial');
      expect(fetchPRDataMock).not.toHaveBeenCalled();
    });
  });

  describe('Data Status', () => {
    it('should initialize with pending status', () => {
      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      expect(result.current._dataStatus.status).toBe('pending');
    });

    it('should have initial stage progress as false except critical which starts', () => {
      const { result } = renderHook(() => 
        useProgressiveRepoData('owner', 'repo', '90d', false)
      );

      // Initial and critical may be true since loading starts immediately
      // Other stages should be false
      expect(result.current.stageProgress.full).toBe(false);
      expect(result.current.stageProgress.enhancement).toBe(false);
      expect(result.current.stageProgress.complete).toBe(false);
    });
  });
});