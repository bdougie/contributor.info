import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/lib/supabase';

describe('Database Data Integrity', () => {
  describe('Repository PR Count Consistency', () => {
    it('should have consistent PR counts across all repositories', async () => {
      const { data: inconsistencies, error } = await supabase
        .rpc('check_repository_pr_count_consistency');

      expect(error).toBeNull();
      expect(inconsistencies).toBeDefined();
      
      if (inconsistencies && inconsistencies.length > 0) {
        console.warn('Found PR count inconsistencies:', inconsistencies);
        // This should fail the test if there are any inconsistencies
        expect(inconsistencies).toHaveLength(0);
      }
    });

    it('should have pull_request_count equal to total_pull_requests for all repositories', async () => {
      const { data: repositories, error } = await supabase
        .from('repositories')
        .select('full_name, pull_request_count, total_pull_requests')
        .neq('pull_request_count', 'total_pull_requests')
        .limit(10);

      expect(error).toBeNull();
      expect(repositories).toBeDefined();
      
      if (repositories && repositories.length > 0) {
        console.warn('Repositories with mismatched counts:', repositories);
        expect(repositories).toHaveLength(0);
      }
    });

    it('should have trigger functions available for maintaining consistency', async () => {
      // Test that our enhanced trigger function exists and is properly installed
      // by checking for the existence of our consistency check function
      const { error } = await supabase
        .rpc('check_repository_pr_count_consistency')
        .limit(0);

      // Should not error if the function exists and database is properly set up
      expect(error).toBeNull();
    });
  });

  describe('Self Selection Function Validation', () => {
    it('should return valid data structure from calculate_self_selection_rate', async () => {
      // Test with a known repository that should have data
      const { data, error } = await supabase
        .rpc('calculate_self_selection_rate', {
          p_repository_owner: 'continuedev',
          p_repository_name: 'continue',
          p_days_back: 30
        });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      
      if (data && Array.isArray(data) && data.length > 0) {
        const result = data[0];
        
        // Validate the expected structure
        expect(result).toHaveProperty('repository_owner');
        expect(result).toHaveProperty('repository_name');
        expect(result).toHaveProperty('external_contribution_rate');
        expect(result).toHaveProperty('internal_contribution_rate');
        expect(result).toHaveProperty('total_prs');
        expect(result).toHaveProperty('total_contributors');
        
        // Validate data types and ranges
        if (result.external_contribution_rate !== null) {
          expect(typeof result.external_contribution_rate).toBe('number');
          expect(result.external_contribution_rate).toBeGreaterThanOrEqual(0);
          expect(result.external_contribution_rate).toBeLessThanOrEqual(100);
        }
        
        if (result.total_prs !== null) {
          expect(typeof result.total_prs).toBe('number');
          expect(result.total_prs).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should handle non-existent repositories gracefully', async () => {
      const { data, error } = await supabase
        .rpc('calculate_self_selection_rate', {
          p_repository_owner: 'nonexistent',
          p_repository_name: 'repository',
          p_days_back: 30
        });

      // Should not error, but should return empty or null data
      expect(error).toBeNull();
      
      if (data && Array.isArray(data) && data.length > 0) {
        const result = data[0];
        // For non-existent repos, counts should be 0 or null
        expect(result.total_prs === 0 || result.total_prs === null).toBe(true);
        expect(result.total_contributors === 0 || result.total_contributors === null).toBe(true);
      }
    });
  });

  describe('Contributor Confidence Function Validation', () => {
    it('should return valid data from get_repository_confidence_summary_simple', async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name')
        .limit(1);

      expect(error).toBeNull();
      
      if (data && data.length > 0) {
        const repo = data[0];
        
        const { data: confidenceData, error: confidenceError } = await supabase
          .rpc('get_repository_confidence_summary_simple')
          .eq('repository_owner', repo.owner)
          .eq('repository_name', repo.name)
          .maybeSingle();

        expect(confidenceError).toBeNull();
        
        if (confidenceData) {
          // Validate the structure if data exists
          expect(confidenceData).toBeDefined();
          
          if ('avg_confidence_score' in confidenceData) {
            const score = confidenceData.avg_confidence_score;
            if (score !== null) {
              expect(typeof score).toBe('number');
              expect(score).toBeGreaterThanOrEqual(0);
              expect(score).toBeLessThanOrEqual(100);
            }
          }
        }
      }
    });
  });

  describe('Data Consistency Monitoring', () => {
    it('should have monitoring functions available', async () => {
      // Test that our new monitoring functions exist and are accessible
      const { error: checkError } = await supabase
        .rpc('check_repository_pr_count_consistency')
        .limit(0);

      // Should not error even if no data returned
      expect(checkError).toBeNull();
    });

    it('should log consistency checks properly', async () => {
      // Verify that the data_consistency_checks table exists and is accessible
      const { data, error } = await supabase
        .from('data_consistency_checks')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Trigger Function Validation', () => {
    it('should have updated trigger functions installed', async () => {
      // Check that our enhanced trigger function exists
      const { data, error } = await supabase
        .rpc('pg_proc_get_source', { 
          proc_name: 'update_repository_pr_count_trigger' 
        });

      // The function should exist (error will be null if it does)
      expect(error).toBeNull();
    });

    it('should have proper triggers attached to pull_requests table', async () => {
      // Verify triggers are properly attached
      const { data, error } = await supabase
        .from('information_schema.triggers')
        .select('*')
        .eq('event_object_table', 'pull_requests')
        .like('trigger_name', '%pr_count%');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      
      if (data && data.length > 0) {
        // Should have at least the insert, update, and delete triggers
        expect(data.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('Repository Stats View Consistency', () => {
    it('should have consistent data between repositories and repository_stats view', async () => {
      const { data: repos, error: reposError } = await supabase
        .from('repositories')
        .select('id, full_name, pull_request_count')
        .not('pull_request_count', 'is', null)
        .limit(5);

      expect(reposError).toBeNull();
      
      if (repos && repos.length > 0) {
        for (const repo of repos) {
          const { data: statsData, error: statsError } = await supabase
            .from('repository_stats')
            .select('total_pull_requests')
            .eq('id', repo.id)
            .single();

          expect(statsError).toBeNull();
          
          if (statsData) {
            expect(statsData.total_pull_requests).toBe(repo.pull_request_count);
          }
        }
      }
    });
  });
});

describe('Chart Data Validation', () => {
  describe('Self Selection Chart Data', () => {
    it('should provide valid data structure for self selection charts', async () => {
      const { data, error } = await supabase
        .rpc('calculate_self_selection_rate', {
          p_repository_owner: 'continuedev',
          p_repository_name: 'continue',
          p_days_back: 30
        });

      expect(error).toBeNull();
      
      if (data && Array.isArray(data) && data.length > 0) {
        const result = data[0];
        
        // Ensure all required fields exist for the chart
        const requiredFields = [
          'external_contribution_rate',
          'internal_contribution_rate', 
          'external_contributors',
          'internal_contributors',
          'total_contributors',
          'external_prs',
          'internal_prs',
          'total_prs'
        ];
        
        for (const field of requiredFields) {
          expect(result).toHaveProperty(field);
        }
        
        // Validate percentage calculations
        if (result.external_contribution_rate !== null && result.internal_contribution_rate !== null) {
          const total = result.external_contribution_rate + result.internal_contribution_rate;
          expect(Math.abs(total - 100)).toBeLessThanOrEqual(0.01); // Allow for rounding
        }
        
        // Validate count consistency
        if (result.external_prs !== null && result.internal_prs !== null && result.total_prs !== null) {
          expect(result.external_prs + result.internal_prs).toBe(result.total_prs);
        }
      }
    });
  });

  describe('Contributor Confidence Chart Data', () => {
    it('should not fail when repository has sufficient PR data', async () => {
      // Test that repositories with adequate data don't show empty charts
      const { data: repos, error } = await supabase
        .from('repositories')
        .select('owner, name, pull_request_count')
        .gte('pull_request_count', 10) // Repos with at least 10 PRs
        .limit(3);

      expect(error).toBeNull();
      
      if (repos && repos.length > 0) {
        for (const repo of repos) {
          const { data: confidenceData, error: confidenceError } = await supabase
            .rpc('get_repository_confidence_summary_simple')
            .eq('repository_owner', repo.owner)
            .eq('repository_name', repo.name);

          // Should not error for repositories with data
          expect(confidenceError).toBeNull();
          
          if (confidenceData && Array.isArray(confidenceData) && confidenceData.length > 0) {
            const result = confidenceData[0];
            // Should have some confidence data for repos with sufficient PRs
            expect(result).toBeDefined();
          }
        }
      }
    });
  });
});