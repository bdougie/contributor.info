import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationDropdown } from './notification-dropdown';
import type { WorkInboxItem } from '@/lib/notifications/work-inbox';
const mocks = vi.hoisted(() => ({
  work: vi.fn(),
  activity: vi.fn(),
  read: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/hooks/use-work-inbox', () => ({ useWorkInbox: mocks.work }));
vi.mock('@/hooks/use-notifications', () => ({ useNotifications: mocks.activity }));
vi.mock('@/components/ui/organization-avatar', () => ({
  OrganizationAvatar: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
const item: WorkInboxItem = {
  id: 'alert-1',
  repository_id: 'repo',
  repository: { full_name: 'papercomputeco/tapes' },
  category: 'awaiting_reply',
  subject_key: 'thread:1',
  source_version: 'comment:1',
  revision: 1,
  title: 'Fix event capture',
  url: 'https://github.com/papercomputeco/tapes/pull/341#discussion_r1',
  actor: 'reviewer',
  preview: 'Could you add a test?',
  occurred_at: '2026-09-05T00:00:00Z',
  is_read: false,
};
const work = () => ({
  eligible: true,
  signedIn: true,
  items: [item],
  unreadCount: 1,
  loading: false,
  refreshing: false,
  unavailable: false,
  errors: [],
  incomplete: false,
  markAsRead: mocks.read,
  refresh: mocks.refresh,
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue(undefined);
  mocks.work.mockReturnValue(work());
  mocks.activity.mockReturnValue({
    notifications: [
      {
        id: 'tracking',
        operation_type: 'repository_tracking',
        status: 'completed',
        title: 'Repository tracking complete',
        read: true,
        metadata: {},
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    unreadCount: 0,
    loading: false,
  });
});
afterEach(cleanup);
function openInbox() {
  render(<NotificationDropdown />);
  fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
}
describe('Workspace-first inbox design', () => {
  it('defaults to work, keeps tracking in Activity, and gives comments real links', () => {
    openInbox();
    expect(screen.getByRole('tab', { name: /Needs attention/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByText('Repository tracking complete')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: item.title })).toHaveAttribute('href', item.url);
    expect(screen.getByRole('img', { name: 'papercomputeco logo' })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Activity/ }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByText('Repository tracking complete')).toBeInTheDocument();
  });
  it('marks read without removing or resolving work', async () => {
    openInbox();
    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith(item));
    expect(screen.getByRole('link', { name: item.title })).toBeInTheDocument();
  });
  it('shows unavailable notifications as a neutral empty state with a working Activity action', () => {
    mocks.work.mockReturnValue({
      ...work(),
      eligible: false,
      items: [],
      unreadCount: 0,
      unavailable: true,
    });
    openInbox();
    expect(screen.getByRole('status')).toHaveTextContent('Workspace inbox coming soon');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing needs attention right now')).not.toBeInTheDocument();
    expect(screen.queryByText(/Create or join a workspace/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View activity' }));
    expect(screen.getByRole('tab', { name: /Activity/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Activity/ })).toHaveFocus();
    expect(screen.getByText('Repository tracking complete')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    expect(screen.getByRole('tab', { name: /Needs attention/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
  it('keeps actual loading failures visible instead of showing an empty state', () => {
    mocks.work.mockReturnValue({
      ...work(),
      eligible: false,
      items: [],
      errors: ['Could not load workspace notifications'],
    });
    openInbox();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load workspace notifications');
    expect(screen.queryByText('Workspace inbox coming soon')).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing needs attention right now')).not.toBeInTheDocument();
  });
  it('explains eligibility for accounts with no workspace', () => {
    mocks.work.mockReturnValue({ ...work(), eligible: false, items: [], unreadCount: 0 });
    openInbox();
    expect(screen.getByText('A work inbox for your workspaces')).toBeInTheDocument();
  });
  it('rejects links outside the referenced GitHub repository', () => {
    mocks.work.mockReturnValue({ ...work(), items: [{ ...item, url: 'https://evil.example' }] });
    openInbox();
    expect(screen.queryByRole('link', { name: item.title })).not.toBeInTheDocument();
  });
});
