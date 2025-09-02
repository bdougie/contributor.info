import { useMemo } from 'react';
import { PullRequestActivity } from '@/lib/types';
import { useRepositoryEvents, RepositoryEvent } from './use-repository-events';

export interface CombinedActivity extends PullRequestActivity {
  eventData?: RepositoryEvent;
}

interface UseCombinedActivityProps {
  pullRequestActivities: PullRequestActivity[];
  owner?: string;
  repo?: string;
  includeStars?: boolean;
  includeForks?: boolean;
}

interface UseCombinedActivityResult {
  activities: CombinedActivity[];
  loading: boolean;
  error: Error | null;
}

function convertEventToActivity(event: RepositoryEvent): CombinedActivity {
  const actorInfo = event.payload?.actor || {
    login: event.actor_login,
    avatar_url: `https://github.com/${event.actor_login}.png`,
  };

  return {
    id: event.event_id,
    type: event.event_type === 'WatchEvent' ? 'starred' : 'forked',
    user: {
      id: event.actor_login,
      name: actorInfo.login,
      avatar: actorInfo.avatar_url,
      isBot: false,
    },
    pullRequest: {
      id: event.event_id,
      number: 0,
      title:
        event.event_type === 'WatchEvent'
          ? `${event.actor_login} starred the repository`
          : `${event.actor_login} forked the repository`,
      state: 'event',
      url: `https://github.com/${event.repository_owner}/${event.repository_name}`,
    },
    repository: {
      id: `${event.repository_owner}/${event.repository_name}`,
      name: event.repository_name,
      owner: event.repository_owner,
      url: `https://github.com/${event.repository_owner}/${event.repository_name}`,
    },
    timestamp: event.created_at,
    eventData: event,
  };
}

export function useCombinedActivity({
  pullRequestActivities,
  owner,
  repo,
  includeStars = true,
  includeForks = true,
}: UseCombinedActivityProps): UseCombinedActivityResult {
  const { events, loading, error } = useRepositoryEvents(owner, repo);

  const combinedActivities = useMemo(() => {
    const activities: CombinedActivity[] = [...pullRequestActivities];

    if (events.length > 0) {
      const filteredEvents = events.filter((event) => {
        if (event.event_type === 'WatchEvent' && !includeStars) return false;
        if (event.event_type === 'ForkEvent' && !includeForks) return false;
        return true;
      });

      const eventActivities = filteredEvents.map(convertEventToActivity);
      activities.push(...eventActivities);
    }

    // Sort by timestamp, most recent first
    activities.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA;
    });

    return activities;
  }, [pullRequestActivities, events, includeStars, includeForks]);

  return {
    activities: combinedActivities,
    loading,
    error,
  };
}
