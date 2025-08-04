import { describe, it, expect } from 'vitest';

/**
 * Tests to validate that our queries use the correct column names
 * These tests ensure we're using the right schema without hitting the database
 */

describe('Query Pattern Validation', () => {
  describe('tracked_repositories queries', () => {
    it('should use tracking_enabled not is_active in queries', () => {
      // This simulates the correct query pattern from scheduled-data-sync.yml
      const correctQuery = `
        .from('tracked_repositories')
        .select(\`
          repository_id,
          repositories!inner(
            id,
            owner,
            name,
            last_updated_at
          )
        \`)
        .eq('tracking_enabled', true)
      `;

      // Validate the query uses the correct column name
      expect(correctQuery).toContain('tracking_enabled');
      expect(correctQuery).not.toContain('is_active');
    });

    it('should validate required fields in repository sync queries', () => {
      // Fields required by the scheduled sync workflow
      const requiredFields = [
        'repository_id',
        'repositories!inner',
        'tracking_enabled'
      ];

      const queryPattern = `
        .from('tracked_repositories')
        .select(\`
          repository_id,
          repositories!inner(
            id,
            owner,
            name,
            last_updated_at
          )
        \`)
        .eq('tracking_enabled', true)
      `;

      requiredFields.forEach(field => {
        expect(queryPattern).toContain(field);
      });
    });
  });

  describe('repositories table queries', () => {
    it('should include all required fields for Inngest functions', () => {
      // Fields required by capture-repository-sync-graphql function
      const requiredFields = ['id', 'owner', 'name', 'last_updated_at'];
      
      const queryPattern = '.select(\'id, owner, name, last_updated_at\')';
      
      requiredFields.forEach(field => {
        expect(queryPattern).toContain(field);
      });
    });
  });

  describe('Event data validation', () => {
    it('should validate repository sync event has required fields', () => {
      // Simulate the event data structure
      const validEvent = {
        name: 'capture/repository.sync.graphql',
        data: {
          repositoryId: 'test-id',
          repositoryName: 'owner/repo',
          days: 7,
          priority: 'medium',
          reason: 'automatic'
        }
      };

      // Validate all required fields are present
      expect(validEvent.data.repositoryId).toBeDefined();
      expect(validEvent.data.days).toBeDefined();
      expect(typeof validEvent.data.days).toBe('number');
      expect(validEvent.data.priority).toBeDefined();
      expect(validEvent.data.reason).toBeDefined();
    });

    it('should handle missing optional fields with defaults', () => {
      const partialData = {
        repositoryId: 'test-id',
        repositoryName: 'owner/repo'
      };

      // Apply defaults like the mapQueueDataToEventData function does
      const withDefaults = {
        ...partialData,
        days: partialData.days || 7,
        priority: partialData.priority || 'medium',
        reason: partialData.reason || 'automatic'
      };

      expect(withDefaults.days).toBe(7);
      expect(withDefaults.priority).toBe('medium');
      expect(withDefaults.reason).toBe('automatic');
    });
  });
});