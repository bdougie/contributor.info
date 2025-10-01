import { describe, it, expect } from 'vitest';

/**
 * Regression tests for production bugs
 *
 * These tests verify code structure to prevent regressions of critical bugs:
 * 1. GraphQL queries use CREATED_AT ordering (not UPDATED_AT)
 * 2. Concurrency limits are set appropriately to prevent queue backlog
 */

describe('Inngest Function Regression Tests', () => {
  describe('GraphQL Query Ordering', () => {
    it('should verify query uses CREATED_AT ordering', async () => {
      // Read the GraphQL client source to verify the fix
      const fs = await import('fs');
      const path = await import('path');

      const graphqlClientPath = path.join(process.cwd(), 'src/lib/inngest/graphql-client.ts');
      const content = fs.readFileSync(graphqlClientPath, 'utf-8');

      // Verify query uses CREATED_AT ordering
      expect(content).toContain('CREATED_AT');
      expect(content).toContain('orderBy: {field: CREATED_AT, direction: DESC}');

      // Verify filtering uses createdAt
      expect(content).toContain('const createdAt = new Date(pr.createdAt');
    });
  });

  describe('Concurrency Configuration', () => {
    it('should verify concurrency limit is set appropriately', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const syncGraphqlPath = path.join(
        process.cwd(),
        'src/lib/inngest/functions/capture-repository-sync-graphql.ts'
      );
      const content = fs.readFileSync(syncGraphqlPath, 'utf-8');

      // Verify concurrency limit was increased from 5 to prevent queue backlog
      expect(content).toContain('limit: 10');
      expect(content).not.toContain('limit: 5,');
    });
  });
});
