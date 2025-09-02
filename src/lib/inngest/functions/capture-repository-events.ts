import { inngest } from '../client';
import { supabase } from '../../supabase';
import { SyncLogger } from '../sync-logger';
import { NonRetriableError } from 'inngest';

// GitHub Event type for WatchEvent and ForkEvent
interface GitHubEvent {
  id: string;
  type: 'WatchEvent' | 'ForkEvent';
  actor: {
    id: number;
    login: string;
    avatar_url: string;
  };
  repo: {
    id: number;
    name: string;
  };
  payload: {
    action?: string; // 'started' for WatchEvent
  };
  created_at: string;
}

/**
 * Captures repository stars and forks from GitHub Events API
 *
 * This function fetches WatchEvent (stars) and ForkEvent data from the
 * GitHub REST API Events endpoint and stores them in the github_events_cache table.
 * It follows the same patterns as other capture functions for consistency.
 */
export const captureRepositoryEvents = inngest.createFunction(
  {
    id: 'capture-repository-events',
    name: 'Capture Repository Star and Fork Events',
    concurrency: {
      limit: 3,
      key: 'event.data.repositoryId',
    },
    retries: 2,
    throttle: {
      limit: 30,
      period: '1m',
    },
  },
  { event: 'capture/repository.events' },
  async ({ event, step }) => {
    const { repositoryId } = event.data;
    const syncLogger = new SyncLogger();
    let apiCallsUsed = 0;

    // Step 0: Initialize sync log
    await step.run('init-sync-log', async () => {
      return await syncLogger.start('repository_events', repositoryId, {
        source: 'inngest',
        event_types: ['WatchEvent', 'ForkEvent'],
      });
    });

    // Step 1: Get repository details
    const repository = await step.run('get-repository', async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .maybeSingle();

      if (error || !data) {
        throw new NonRetriableError(`Repository not found: ${repositoryId}`);
      }
      return data;
    });

    // Step 2: Fetch events from GitHub
    const events = await step.run('fetch-events', async () => {
      try {
        console.log(
          'Fetching events for repository %s/%s',
          repository.owner,
          repository.name
        );
        apiCallsUsed++;

        // Fetch events from GitHub Events API
        // This endpoint returns the last 90 days of events (max 300 events)
        const response = await fetch(
          `https://api.github.com/repos/${repository.owner}/${repository.name}/events`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'Authorization': `token ${process.env.GITHUB_TOKEN}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            console.warn(`Repository ${repository.owner}/${repository.name} not found, skipping events`);
            return { events: [], failedContributorCreations: 0 };
          }
          if (response.status === 403) {
            throw new Error(
              `Rate limit exceeded while fetching events for ${repository.owner}/${repository.name}. Will retry later.`
            );
          }
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const eventsData = await response.json() as GitHubEvent[];

        // Filter for WatchEvent and ForkEvent only
        const relevantEvents = eventsData.filter(event => 
          event.type === 'WatchEvent' || event.type === 'ForkEvent'
        );

        // Process each event and ensure actors exist in contributors table
        const processedEvents = [];
        let failedContributorCreations = 0;

        for (const event of relevantEvents) {
          if (!event.actor) continue; // Skip events without actor data

          // Find or create the actor in contributors table
          const { data: existingContributor } = await supabase
            .from('contributors')
            .select('id')
            .eq('github_id', event.actor.id)
            .maybeSingle();

          if (!existingContributor) {
            // Create new contributor
            const { data: newContributor, error: contributorError } = await supabase
              .from('contributors')
              .insert({
                github_id: event.actor.id,
                username: event.actor.login,
                avatar_url: event.actor.avatar_url,
                is_bot: event.actor.login.includes('[bot]'),
              })
              .select('id')
              .maybeSingle();

            if (contributorError || !newContributor) {
              console.warn(
                'Failed to create actor %s: %s',
                event.actor.login,
                contributorError?.message || 'Unknown error'
              );
              failedContributorCreations++;
              continue;
            }
          }

          // Prepare event data for storage
          processedEvents.push({
            event_id: event.id,
            event_type: event.type,
            actor_login: event.actor.login,
            repository_owner: repository.owner,
            repository_name: repository.name,
            payload: event.payload,
            created_at: event.created_at,
            processed: false,
          });
        }

        console.log(
          'Found %s total events, %s relevant events (stars/forks) for repository %s/%s',
          eventsData.length,
          relevantEvents.length,
          repository.owner,
          repository.name
        );

        await syncLogger.update({
          github_api_calls_used: apiCallsUsed,
          metadata: {
            totalEventsFound: eventsData.length,
            relevantEventsFound: relevantEvents.length,
            eventsToProcess: processedEvents.length,
            failedContributorCreations: failedContributorCreations,
          },
        });

        return { events: processedEvents, failedContributorCreations };
      } catch (error: unknown) {
        console.error('Error fetching events for repository %s/%s:', repository.owner, repository.name, error);
        throw error;
      }
    });

    // Step 3: Store events in database
    const storedCount = await step.run('store-events', async () => {
      if (events.events.length === 0) {
        return 0;
      }

      // Batch insert events with upsert to handle duplicates
      const { error } = await supabase
        .from('github_events_cache')
        .upsert(events.events, {
          onConflict: 'event_id',
          ignoreDuplicates: false,
        });

      if (error) {
        await syncLogger.fail(`Failed to store events: ${error.message}`, {
          records_processed: events.events.length,
          records_failed: events.events.length,
          github_api_calls_used: apiCallsUsed,
        });
        throw new Error(`Failed to store events: ${error.message}`);
      }

      return events.events.length;
    });

    // Complete sync log
    await step.run('complete-sync-log', async () => {
      await syncLogger.complete({
        records_processed: storedCount,
        records_inserted: storedCount,
        github_api_calls_used: apiCallsUsed,
        metadata: {
          eventsCount: storedCount,
          failedContributorCreations: events.failedContributorCreations,
          watchEvents: events.events.filter(e => e.event_type === 'WatchEvent').length,
          forkEvents: events.events.filter(e => e.event_type === 'ForkEvent').length,
        },
      });
    });

    return {
      success: true,
      repositoryId,
      repository: `${repository.owner}/${repository.name}`,
      eventsCount: storedCount,
      watchEvents: events.events.filter(e => e.event_type === 'WatchEvent').length,
      forkEvents: events.events.filter(e => e.event_type === 'ForkEvent').length,
    };
  }
);