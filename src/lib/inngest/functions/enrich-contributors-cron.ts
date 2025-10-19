import { inngest } from '../client';
import { enrichAllWorkspaces } from '@/services/contributor-enrichment';

/**
 * Cron job to periodically enrich contributor data with AI-powered insights
 *
 * Processes:
 * - Persona detection (enterprise, security, performance, etc.)
 * - Quality scoring (discussion impact, code review depth, etc.)
 * - Topic clustering (identifies technical expertise areas)
 * - Trend analysis (velocity, topic shifts, engagement patterns)
 *
 * Runs daily at 3 AM UTC to process all workspaces
 */
export const enrichContributorsCron = inngest.createFunction(
  {
    id: 'enrich-contributors-cron',
    name: 'Enrich Contributors (Cron)',
    retries: 1,
  },
  { cron: '0 3 * * *' }, // Run daily at 3 AM UTC
  async ({ step }) => {
    console.log('[Enrichment Cron] Starting contributor enrichment job');

    // Step 1: Run enrichment for all workspaces
    const result = await step.run('enrich-all-workspaces', async () => {
      try {
        await enrichAllWorkspaces();

        return {
          success: true,
          message: 'Successfully enriched all workspaces',
        };
      } catch (error) {
        console.error('[Enrichment Cron] Error enriching workspaces: %s', error);
        throw error;
      }
    });

    console.log('[Enrichment Cron] ✅ Enrichment job completed');

    return {
      success: result.success,
      completedAt: new Date().toISOString(),
      message: result.message,
    };
  }
);
