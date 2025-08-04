import { describe, it, expect } from 'vitest';
import { supabase } from '../../supabase';

describe('Database Schema Validation', () => {
  describe('tracked_repositories table', () => {
    it('should have tracking_enabled column, not is_active', async () => {
      // This test verifies the correct column name exists
      const { data, error } = await supabase
        .from('tracked_repositories')
        .select('tracking_enabled')
        .limit(1);

      // The query should not error if the column exists
      expect(error).toBeNull();
      
      // If there's data, it should have the tracking_enabled field
      if (data && data.length > 0) {
        expect(data[0]).toHaveProperty('tracking_enabled');
      }
    });

    it('should fail when querying non-existent is_active column', async () => {
      // This test ensures we're not using the wrong column name
      const { error } = await supabase
        .from('tracked_repositories')
        .select('is_active')
        .limit(1);

      // This query should fail because is_active doesn't exist
      expect(error).toBeTruthy();
      expect(error?.code).toBe('42703'); // PostgreSQL error code for undefined column
    });

    it('should have all required columns for repository sync queries', async () => {
      // Test the actual query pattern used in scheduled-data-sync workflow
      const { data, error } = await supabase
        .from('tracked_repositories')
        .select(`
          repository_id,
          repositories!inner(
            id,
            owner,
            name,
            last_updated_at
          )
        `)
        .eq('tracking_enabled', true)
        .limit(1);

      // Query should succeed
      expect(error).toBeNull();
      
      // Verify the structure if data exists
      if (data && data.length > 0) {
        const item = data[0];
        expect(item).toHaveProperty('repository_id');
        expect(item).toHaveProperty('repositories');
        
        if (item.repositories) {
          expect(item.repositories).toHaveProperty('id');
          expect(item.repositories).toHaveProperty('owner');
          expect(item.repositories).toHaveProperty('name');
          expect(item.repositories).toHaveProperty('last_updated_at');
        }
      }
    });
  });

  describe('repositories table', () => {
    it('should have all required columns for Inngest functions', async () => {
      // Test columns used by capture-repository-sync-graphql function
      const { data, error } = await supabase
        .from('repositories')
        .select('id, owner, name, last_updated_at')
        .limit(1);

      expect(error).toBeNull();
      
      if (data && data.length > 0) {
        const repo = data[0];
        expect(repo).toHaveProperty('id');
        expect(repo).toHaveProperty('owner');
        expect(repo).toHaveProperty('name');
        expect(repo).toHaveProperty('last_updated_at');
      }
    });
  });
});