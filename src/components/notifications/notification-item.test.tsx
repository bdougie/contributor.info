import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NotificationItem } from './notification-item';
import type { Notification } from '@/lib/notifications';

describe('NotificationItem', () => {
  const mockNotification: Notification = {
    id: '1',
    user_id: 'user-1',
    operation_id: 'op-1',
    operation_type: 'repository_tracking',
    repository: 'owner/repo',
    status: 'completed',
    title: 'Repository tracking complete',
    message: 'owner/repo is now being tracked',
    metadata: { repository_id: 'repo-1' },
    read: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('renders limited notification details correctly', () => {
    render(<NotificationItem notification={mockNotification} />);

    // Check title
    expect(screen.getByText('Repository tracking complete')).toBeInTheDocument();

    // Check message
    expect(screen.getByText('owner/repo is now being tracked')).toBeInTheDocument();

    // Check operation label (should NOT be present)
    expect(screen.queryByText('Repository Tracking')).not.toBeInTheDocument();

    // Check repository field (should NOT be present)
    expect(screen.queryByText('Repository:')).not.toBeInTheDocument();

    // Check timestamp (relative time)
    // Since we created it just now, it should be "less than a minute ago"
    expect(screen.getByText('less than a minute ago')).toBeInTheDocument();
  });
});
