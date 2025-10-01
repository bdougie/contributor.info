import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Regression tests for permission bugs
 * These tests ALWAYS run and verify code structure to prevent regressions
 */

describe('Permission Bug Regression Tests', () => {
  describe('Service Role Key Usage', () => {
    it('should verify supabase-server.ts exists and exports admin client', () => {
      const serverPath = join(process.cwd(), 'src/lib/inngest/supabase-server.ts');
      const content = readFileSync(serverPath, 'utf-8');

      // Verify it imports from supabase-admin
      expect(content).toContain("from '../supabase-admin'");

      // Verify it exports the admin client
      expect(content).toContain('export const supabase = supabaseAdmin');

      // Verify it has guard clause
      expect(content).toContain('if (!supabaseAdmin)');
      expect(content).toContain('throw new Error');
    });

    it('should verify ALL Inngest functions import from supabase-server', () => {
      const functionsToCheck = [
        'capture-repository-sync-graphql.ts',
        'capture-repository-sync-enhanced.ts',
        'capture-repository-sync.ts',
        'capture-pr-details-graphql.ts',
        'capture-pr-details.ts',
        'capture-pr-reviews.ts',
        'capture-pr-comments.ts',
        'capture-issue-comments.ts',
        'capture-repository-events.ts',
        'capture-repository-issues.ts',
        'update-pr-activity.ts',
        'compute-embeddings.ts',
        'classify-repository-size.ts',
        'factory.ts',
      ];

      const failures: string[] = [];

      for (const functionFile of functionsToCheck) {
        const filePath = join(process.cwd(), 'src/lib/inngest/functions', functionFile);
        const content = readFileSync(filePath, 'utf-8');

        // Check it imports from supabase-server (not direct supabase)
        if (
          !content.includes("from '../supabase-server'") &&
          !content.includes('from "../supabase-server"')
        ) {
          failures.push(`${functionFile} does not import from supabase-server`);
        }

        // Make sure it's NOT importing from wrong place
        if (
          content.includes("from '../../supabase'") ||
          content.includes('from "../../supabase"')
        ) {
          failures.push(`${functionFile} imports from WRONG client (anon key)`);
        }
      }

      expect(failures).toEqual([]);
    });

    it('should verify ensureContributorExists throws errors instead of returning null', () => {
      const filePath = join(
        process.cwd(),
        'src/lib/inngest/functions/capture-repository-sync-graphql.ts'
      );
      const content = readFileSync(filePath, 'utf-8');

      // Find ensureContributorExists function
      expect(content).toContain('async function ensureContributorExists');

      // Verify it throws on error (not returns null)
      expect(content).toContain('throw new Error');

      // Should have error handling with throw
      const errorHandlingPattern = /if \(error\)[\s\S]*?throw new Error/;
      expect(content).toMatch(errorHandlingPattern);
    });
  });

  describe('GraphQL Query Ordering Fix', () => {
    it('should verify GraphQL query uses CREATED_AT ordering (not UPDATED_AT)', () => {
      const filePath = join(process.cwd(), 'src/lib/inngest/graphql-client.ts');
      const content = readFileSync(filePath, 'utf-8');

      // Find GET_RECENT_PRS_QUERY
      expect(content).toContain('GET_RECENT_PRS_QUERY');

      // Verify it uses CREATED_AT ordering
      expect(content).toContain('field: CREATED_AT, direction: DESC');

      // Make sure it's NOT using UPDATED_AT
      const querySection = content.substring(
        content.indexOf('GET_RECENT_PRS_QUERY'),
        content.indexOf('export interface RateLimitInfo')
      );
      expect(querySection).not.toContain('field: UPDATED_AT');
    });

    it('should verify client-side filtering uses createdAt (not updatedAt)', () => {
      const filePath = join(process.cwd(), 'src/lib/inngest/graphql-client.ts');
      const content = readFileSync(filePath, 'utf-8');

      // Find getRecentPRs function
      const funcStart = content.indexOf('async getRecentPRs(');
      const funcEnd = content.indexOf('} catch (error: unknown) {', funcStart);
      const funcBody = content.substring(funcStart, funcEnd);

      // Verify filtering uses createdAt
      expect(funcBody).toContain('const createdAt = new Date(pr.createdAt');
      expect(funcBody).toContain('return createdAt >= sinceDate');

      // Should NOT use updatedAt for filtering
      expect(funcBody).not.toContain('const updatedAt = new Date(pr.updatedAt');
    });

    it('should have explanatory comment about the fix', () => {
      const filePath = join(process.cwd(), 'src/lib/inngest/graphql-client.ts');
      const content = readFileSync(filePath, 'utf-8');

      // Should have comment explaining why we use createdAt
      expect(content).toContain('Changed from updatedAt to createdAt');
      expect(content).toContain("don't miss newly created PRs");
    });
  });

  describe('Concurrency Configuration', () => {
    it('should verify concurrency limit is 10 (not 5)', () => {
      const filePath = join(
        process.cwd(),
        'src/lib/inngest/functions/capture-repository-sync-graphql.ts'
      );
      const content = readFileSync(filePath, 'utf-8');

      // Find concurrency config
      const configStart = content.indexOf('concurrency: {');
      const configEnd = content.indexOf('},', configStart);
      const configSection = content.substring(configStart, configEnd);

      // Verify limit is 10
      expect(configSection).toContain('limit: 10');

      // Make sure it's not the old value
      expect(configSection).not.toContain('limit: 5');
    });
  });

  describe('Error Handling Patterns', () => {
    it('should verify confidence scoring throws errors (not silent fails)', () => {
      const filePath = join(process.cwd(), 'supabase/functions/_shared/confidence-scoring.ts');
      const content = readFileSync(filePath, 'utf-8');

      // Find batchUpdateConfidenceScores
      const funcStart = content.indexOf('export async function batchUpdateConfidenceScores');
      const funcEnd = content.indexOf('\n}\n', funcStart);
      const funcBody = content.substring(funcStart, funcEnd);

      // Should check for errors
      expect(funcBody).toContain('if (error)');

      // Should throw errors instead of returning
      expect(funcBody).toContain('throw new Error');

      // Should have error logging
      expect(funcBody).toContain('console.error');
    });

    it('should verify getContributorMetrics throws on error', () => {
      const filePath = join(process.cwd(), 'supabase/functions/_shared/confidence-scoring.ts');
      const content = readFileSync(filePath, 'utf-8');

      // Find getContributorMetrics
      const funcStart = content.indexOf('export async function getContributorMetrics');
      const funcEnd = content.indexOf('\n}\n', funcStart);
      const funcBody = content.substring(funcStart, funcEnd);

      // Should throw on error
      expect(funcBody).toContain('if (error)');
      expect(funcBody).toContain('throw new Error');
    });
  });

  describe('Type Safety', () => {
    it('should verify no "any" types in critical functions', () => {
      const filePath = join(process.cwd(), 'src/lib/inngest/supabase-server.ts');
      const content = readFileSync(filePath, 'utf-8');

      // Count "any" occurrences (should be minimal or none)
      const anyCount = (content.match(/: any/g) || []).length;
      expect(anyCount).toBe(0);
    });

    it('should verify proper TypeScript interfaces for contributors', () => {
      const filePath = join(
        process.cwd(),
        'src/lib/inngest/functions/capture-repository-sync-graphql.ts'
      );
      const content = readFileSync(filePath, 'utf-8');

      // Should have GitHubUser interface
      expect(content).toContain('interface GitHubUser');
      expect(content).toContain('databaseId?: number');
      expect(content).toContain('login?: string');
    });
  });
});
