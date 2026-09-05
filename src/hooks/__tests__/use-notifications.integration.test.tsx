import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotifications } from '../use-notifications';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
  count: vi.fn(),
  subscribe: vi.fn(),
  read: vi.fn(),
}));
vi.mock('../use-current-user', () => ({ useCurrentUser: mocks.auth }));
vi.mock('@/lib/notifications', () => ({
  NotificationService: {
    getNotifications: mocks.list,
    getUnreadCount: mocks.count,
    subscribeToNotifications: mocks.subscribe,
    markAsRead: mocks.read,
  },
}));
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient();
  mocks.auth.mockReturnValue({ user: { id: 'first' } });
  mocks.list.mockResolvedValue([{ id: 'notification', read: false }]);
  mocks.count.mockResolvedValue(1);
  mocks.subscribe.mockReturnValue(vi.fn());
  mocks.read.mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  client.clear();
});
describe('Notification state isolation', () => {
  it('does not duplicate notifications or inflate counts on repeated realtime deliveries', async () => {
    const { result } = renderHook(() => useNotifications({ limit: 20 }), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    act(() => {
      mocks.subscribe.mock.calls[0][1]();
      mocks.subscribe.mock.calls[0][1]();
    });
    await waitFor(() => expect(mocks.list.mock.calls.length).toBeGreaterThan(1));
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
  });
  it('clears old notifications on account switch and sign-out', async () => {
    const { result, rerender } = renderHook(useNotifications, { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    mocks.auth.mockReturnValue({ user: { id: 'second' } });
    mocks.list.mockResolvedValue([]);
    rerender();
    expect(result.current.notifications).toEqual([]);
    mocks.auth.mockReturnValue({ user: null });
    rerender();
    expect(result.current.unreadCount).toBe(0);
  });
});
