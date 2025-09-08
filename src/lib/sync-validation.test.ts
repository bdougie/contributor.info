import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/lib/supabase';

describe('Sync Process Validation', () => {
  describe('Repository Sync Integrity', () => {
    it('should maintain PR count consistency during sync operations', async () => {
      // Get a sample repository that has been synced
      const { data: sampleRepo, error: repoError } = await supabase
        .from('repositories')
        .select('id, full_name, pull_request_count, total_pull_requests, last_synced_at')
        .not('last_synced_at', 'is', null)
        .not('pull_request_count', 'is', null)
        .limit(1)
        .single();

      expect(repoError).toBeNull();
      
      if (sampleRepo) {
        // Verify counts are consistent
        expect(sampleRepo.pull_request_count).toBe(sampleRepo.total_pull_requests);
        
        // Verify actual count matches stored count
        const { data: actualCount, error: countError } = await supabase
          .from('pull_requests')
          .select('*', { count: 'exact', head: true })
          .eq('repository_id', sampleRepo.id);

        expect(countError).toBeNull();
        
        if (actualCount) {
          expect(actualCount.count).toBe(sampleRepo.pull_request_count);
        }
      }
    });

    it('should have proper sync logging for recent operations', async () => {
      // Check that sync operations are being logged
      const { data: recentLogs, error: logsError } = await supabase
        .from('sync_logs')
        .select('*')
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('started_at', { ascending: false })
        .limit(10);

      expect(logsError).toBeNull();
      expect(recentLogs).toBeDefined();
      
      if (recentLogs && recentLogs.length > 0) {
        for (const log of recentLogs) {
          // Validate log structure
          expect(log).toHaveProperty('sync_type');
          expect(log).toHaveProperty('status');
          expect(log).toHaveProperty('started_at');
          
          // Status should be valid
          expect(['started', 'completed', 'failed', 'cancelled']).toContain(log.status);
        }
      }
    });

    it('should track sync progress properly', async () => {
      // Check sync progress tracking
      const { data: progressRecords, error: progressError } = await supabase
        .from('sync_progress')
        .select('*')
        .order('last_sync_at', { ascending: false })
        .limit(5);

      expect(progressError).toBeNull();
      expect(progressRecords).toBeDefined();
      
      if (progressRecords && progressRecords.length > 0) {
        for (const progress of progressRecords) {
          // Validate progress record structure
          expect(progress).toHaveProperty('repository_id');
          expect(progress).toHaveProperty('status');
          expect(progress).toHaveProperty('prs_processed');
          
          // Status should be valid
          expect(['partial', 'in_progress', 'completed', 'failed']).toContain(progress.status);
          
          // Processed count should be reasonable
          if (progress.prs_processed !== null) {
            expect(progress.prs_processed).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    it('should handle sync failures gracefully', async () => {
      // Check for failed syncs and ensure they're properly logged
      const { data: failedSyncs, error: failedError } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('status', 'failed')
        .gte('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .limit(5);

      expect(failedError).toBeNull();
      
      if (failedSyncs && failedSyncs.length > 0) {
        for (const failedSync of failedSyncs) {
          // Failed syncs should have error messages
          expect(failedSync.error_message).toBeDefined();
          expect(failedSync.error_message).not.toBe('');
          
          // Should have proper metadata for debugging
          expect(failedSync.metadata).toBeDefined();
        }
      }
    });
  });

  describe('Trigger Function Validation', () => {
    it('should have working PR count monitoring functions', async () => {
      // Test that our monitoring functions are properly installed and accessible
      const { error } = await supabase
        .rpc('check_repository_pr_count_consistency')
        .limit(0);

      expect(error).toBeNull();
    });

    it('should have triggers attached to pull_requests table', async () => {
      // Verify that the necessary triggers exist
      const triggerNames = [
        'update_repository_pr_count_on_insert',
        'update_repository_pr_count_on_delete', 
        'update_repository_pr_count_on_update'
      ];

      for (const triggerName of triggerNames) {
        const { data: triggerExists, error: triggerError } = await supabase
          .from('information_schema.triggers')
          .select('trigger_name')
          .eq('trigger_name', triggerName)
          .eq('event_object_table', 'pull_requests')
          .single();

        expect(triggerError).toBeNull();
        expect(triggerExists).toBeDefined();
        expect(triggerExists?.trigger_name).toBe(triggerName);
      }
    });
  });

  describe('Data Quality Validation', () => {
    it('should not have repositories with negative PR counts', async () => {
      const { data: negativeCountRepos, error } = await supabase
        .from('repositories')
        .select('full_name, pull_request_count, total_pull_requests')
        .or('pull_request_count.lt.0,total_pull_requests.lt.0');

      expect(error).toBeNull();
      expect(negativeCountRepos).toHaveLength(0);
    });

    it('should have proper foreign key constraints', async () => {
      // Test that pull requests properly reference existing repositories
      const { data: prWithoutRepos, error } = await supabase
        .from('pull_requests')
        .select('id, repository_id')
        .is('repository_id', null)
        .limit(5);

      expect(error).toBeNull();
      
      // Should not have PRs without repository references
      if (prWithoutRepos) {
        expect(prWithoutRepos).toHaveLength(0);
      }
    });

    it('should have proper referential integrity', async () => {
      // Check that all pull requests have valid author references
      const { data: invalidAuthors, error } = await supabase
        .from('pull_requests')
        .select('id, github_id')
        .is('author_id', null)
        .limit(5);

      expect(error).toBeNull();
      
      // Should not have PRs without valid authors
      if (invalidAuthors) {
        expect(invalidAuthors).toHaveLength(0);
      }
    });
  });

  describe('Performance Validation', () => {
    it('should have proper indexes for common queries', async () => {
      // Check for critical indexes that affect chart performance
      const criticalIndexes = [
        'idx_pull_requests_repository',
        'idx_pull_requests_author',
        'idx_pull_requests_created',
        'idx_repositories_pull_request_count'
      ];

      for (const indexName of criticalIndexes) {
        const { data: indexExists, error } = await supabase
          .from('pg_indexes')
          .select('indexname')
          .eq('indexname', indexName)
          .single();

        expect(error).toBeNull();
        expect(indexExists).toBeDefined();
        expect(indexExists?.indexname).toBe(indexName);
      }
    });

    it('should complete consistency checks in reasonable time', async () => {
      const startTime = Date.now();
      
      const { data, error } = await supabase
        .rpc('check_repository_pr_count_consistency')
        .limit(10);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(error).toBeNull();
      // Should complete within 30 seconds for small datasets
      expect(executionTime).toBeLessThan(30000);
    });
  });

  describe('Monitoring and Alerting', () => {
    it('should track data consistency checks', async () => {
      // Verify that consistency monitoring is working
      const { data: consistencyChecks, error } = await supabase
        .from('data_consistency_checks')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(5);

      expect(error).toBeNull();
      expect(consistencyChecks).toBeDefined();
      
      if (consistencyChecks && consistencyChecks.length > 0) {
        for (const check of consistencyChecks) {
          expect(check).toHaveProperty('check_type');
          expect(check).toHaveProperty('status');
          expect(['consistent', 'inconsistent', 'fixed', 'failed']).toContain(check.status);
        }
      }
    });

    it('should have monitoring functions accessible', async () => {
      const monitoringFunctions = [
        'check_repository_pr_count_consistency',
        'fix_repository_pr_count_inconsistencies',
        'run_data_consistency_checks'
      ];

      for (const funcName of monitoringFunctions) {
        const { error } = await supabase.rpc(funcName).limit(0);
        
        // Functions should exist and be callable (even if they return no data)
        expect(error).toBeNull();
      }
    });
  });

  describe('Chart Function Validation', () => {
    it('should handle self selection calculations without errors', async () => {
      // Test with a few different repositories
      const { data: testRepos, error: reposError } = await supabase
        .from('repositories')
        .select('owner, name')
        .not('pull_request_count', 'is', null)
        .gte('pull_request_count', 5)
        .limit(3);

      expect(reposError).toBeNull();
      
      if (testRepos && testRepos.length > 0) {
        for (const repo of testRepos) {
          const { error: calcError } = await supabase
            .rpc('calculate_self_selection_rate', {
              p_repository_owner: repo.owner,
              p_repository_name: repo.name,
              p_days_back: 30
            });

          // Should not error for valid repositories
          expect(calcError).toBeNull();
        }
      }
    });

    it('should handle confidence calculations without errors', async () => {
      // Test confidence calculation functions
      const { data: testRepos, error: reposError } = await supabase
        .from('repositories')
        .select('owner, name')
        .not('pull_request_count', 'is', null)
        .gte('pull_request_count', 10)
        .limit(2);

      expect(reposError).toBeNull();
      
      if (testRepos && testRepos.length > 0) {
        for (const repo of testRepos) {
          const { error: confidenceError } = await supabase
            .rpc('get_repository_confidence_summary_simple')
            .eq('repository_owner', repo.owner)
            .eq('repository_name', repo.name);

          // Should not error for valid repositories
          expect(confidenceError).toBeNull();
        }
      }
    });
  });
});

// Helper function to create test for orphaned PRs (would need to be implemented as a SQL function)
// This would be added to the migration as well
/*
CREATE OR REPLACE FUNCTION find_orphaned_pull_requests()
RETURNS TABLE(pr_id UUID, pr_number INTEGER, repository_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT pr.id, pr.number, pr.repository_id
  FROM pull_requests pr
  LEFT JOIN repositories r ON pr.repository_id = r.id
  WHERE r.id IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;
*/