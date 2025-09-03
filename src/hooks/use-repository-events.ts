import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface RepositoryEvent {
  id: string;
  event_id: string;
  event_type: 'WatchEvent' | 'ForkEvent';
  actor_login: string;
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

export function useRepositoryEvents(
  owner?: string,
  repo?: string,
  limit: number = 100
): UseRepositoryEventsResult {
  const [events, setEvents] = useState<RepositoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!owner || !repo) {
      setLoading(false);
      return;
    }

    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);

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

        setEvents(data || []);
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
