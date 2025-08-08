#!/usr/bin/env node

// Simple test to verify the fix for the Lottery Factor basicInfo issue
// This script tests that the useProgressiveRepoData hook correctly populates basicInfo

import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Mock the dependencies
vi.mock('@/lib/supabase-direct-commits', () => ({
  fetchDirectCommitsWithDatabaseFallback: vi.fn().mockResolvedValue({
    commits: [],
    totalCommits: 0,
    yoloCoders: []
  }),
}));

vi.mock('@/lib/supabase-pr-data-smart-deduped', () => ({
  fetchPRDataSmart: vi.fn().mockResolvedValue({
    data: [
      {
        id: 1,
        title: 'Test PR',
        user: { login: 'testuser', avatar_url: 'https://example.com/avatar.jpg' },
        state: 'merged',
        merged: true,
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
    status: 'success',
    message: 'Data loaded',
  }),
}));

vi.mock('@/lib/utils', () => ({
  calculateLotteryFactor: vi.fn().mockReturnValue({
    factor: 0.5,
    description: 'Test lottery factor',
    topContributorsCount: 1,
    topContributorsPercentage: 100,
    riskLevel: 'High',
    contributors: [
      {
        login: 'testuser',
        avatar_url: 'https://example.com/avatar.jpg',
        pullRequests: 1,
        percentage: 100,
      }
    ],
    totalContributors: 1,
  }),
}));

vi.mock('@/lib/simple-logging', () => ({
  setApplicationContext: vi.fn(),
  startSpan: vi.fn((options, fn) => fn({ setStatus: vi.fn() })),
}));

vi.mock('@/lib/retry-utils', () => ({
  withRetry: vi.fn(async (fn) => fn()),
}));

// Mock requestIdleCallback
window.requestIdleCallback = vi.fn((callback) => {
  setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0);
  return 1;
});

async function testProgressiveLoading() {
  console.log('🧪 Testing Progressive Loading Fix...');
  
  try {
    // Import the hook after mocks are set up
    const { useProgressiveRepoData } = await import('./src/hooks/use-progressive-repo-data.ts');
    
    const { result } = renderHook(() => 
      useProgressiveRepoData('facebook', 'react', '90d', false)
    );

    console.log('✅ Initial state:', {
      basicInfo: result.current.basicInfo,
      currentStage: result.current.currentStage,
      stageProgress: result.current.stageProgress
    });

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.basicInfo).not.toBeNull();
    }, { timeout: 1000 });

    console.log('✅ After critical stage:', {
      basicInfo: result.current.basicInfo,
      currentStage: result.current.currentStage,
      stageProgress: result.current.stageProgress
    });

    // Wait for full stage
    await waitFor(() => {
      expect(result.current.currentStage).toBe('full');
    }, { timeout: 1000 });

    console.log('✅ After full stage:', {
      basicInfo: result.current.basicInfo,
      stats: result.current.stats,
      lotteryFactor: result.current.lotteryFactor,
      currentStage: result.current.currentStage,
    });

    // Verify basicInfo is populated correctly
    if (result.current.basicInfo) {
      console.log('✅ SUCCESS: basicInfo is properly populated!');
      console.log('  - prCount:', result.current.basicInfo.prCount);
      console.log('  - contributorCount:', result.current.basicInfo.contributorCount);
      console.log('  - topContributors:', result.current.basicInfo.topContributors);
      return true;
    } else {
      console.log('❌ FAILURE: basicInfo is still null');
      return false;
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
testProgressiveLoading()
  .then((success) => {
    if (success) {
      console.log('\n🎉 Progressive Loading Fix Test PASSED!');
      console.log('   The Lottery Factor should now work correctly.');
      process.exit(0);
    } else {
      console.log('\n💥 Progressive Loading Fix Test FAILED!');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });