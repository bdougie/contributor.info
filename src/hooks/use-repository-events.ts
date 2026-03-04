import { useState, useEffect, useRef } from 'react';
import { getSupabase } from '@/lib/supabase-lazy';
import { abbreviateBios } from '@/lib/llm/abbreviate-bios';

export interface RepositoryEvent {
  id: string;
  event_id: string;
  event_type: 'WatchEvent' | 'ForkEvent';
  actor_login: string;
  actor_bio?: string;
  actor_full_bio?: string;
  repository_owner: string;
  repository_name: string;
  created_at: string;
  payload: {
    action?: string;
    actor?: {
      id: number;
      login: string;
      avatar_url: string;
    };
  };
}

interface UseRepositoryEventsResult {
  events: RepositoryEvent[];
  loading: boolean;
  error: Error | null;
}

const STALENESS_HOURS = 4;

export function useRepositoryEvents(
  owner?: string,
  repo?: string,
  limit: number = 100,
  isLoggedIn: boolean = false
): UseRepositoryEventsResult {
  const [events, setEvents] = useState<RepositoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasTriggeredBackfill = useRef(false);
  const isLoggedInRef = useRef(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;

  // Reset backfill guard only when owner/repo changes
  useEffect(() => {
    hasTriggeredBackfill.current = false;
  }, [owner, repo]);

  useEffect(() => {
    if (!owner || !repo) {
      setLoading(false);
      return;
    }

    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);

        const supabase = await getSupabase();
        const { data, error: fetchError } = await supabase
          .from('github_events_cache')
          .select('*')
          .eq('repository_owner', owner)
          .eq('repository_name', repo)
          .in('event_type', ['WatchEvent', 'ForkEvent'])
          .order('created_at', { ascending: false })
          .limit(limit);

        if (fetchError) {
          throw new Error(`Failed to fetch repository events: ${fetchError.message}`);
        }

        // Enrich events with bios from contributors table
        const enrichedEvents = data || [];
        if (enrichedEvents.length > 0) {
          const actorLogins = [
            ...new Set(enrichedEvents.map((e) => e.actor_login).filter(Boolean)),
          ];
          const { data: contributors } = await supabase
            .from('contributors')
            .select('username, bio')
            .in('username', actorLogins);
          if (contributors) {
            const fullBioMap = new Map<string, string>();
            for (const c of contributors) {
              if (c.bio) fullBioMap.set(c.username, c.bio);
            }
            if (fullBioMap.size > 0) {
              const bioMap = await abbreviateBios(fullBioMap);
              for (const event of enrichedEvents) {
                event.actor_bio = bioMap.get(event.actor_login);
                event.actor_full_bio = fullBioMap.get(event.actor_login);
              }
            }
          }
        }

        setEvents(enrichedEvents);

        // Trigger on-demand backfill if data is empty or stale
        if (isLoggedInRef.current && !hasTriggeredBackfill.current) {
          const isStale =
            enrichedEvents.length === 0 ||
            (Date.now() - Date.parse(enrichedEvents[0].created_at)) / (1000 * 60 * 60) >
              STALENESS_HOURS;

          if (isStale) {
            hasTriggeredBackfill.current = true;
            triggerEventBackfill(owner, repo);
          }
        }
      } catch (err) {
        console.error('Error fetching repository events:', err);
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [owner, repo, limit]);

  return { events, loading, error };
}

async function triggerEventBackfill(owner: string, repo: string) {
  try {
    const response = await fetch('/.netlify/functions/trigger-event-backfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, repo }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.warn('Event backfill returned %s: %s', response.status, data.error || '');
      return;
    }

    console.log('Triggered star/fork event backfill for %s/%s', owner, repo);
  } catch (err) {
    // Non-critical — don't surface to user
    console.warn('Failed to trigger event backfill:', err);
  }
}
