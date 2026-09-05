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
  it('collapses a burst of realtime deliveries into one refetch without duplicating rows', async () => {
    const { result } = renderHook(() => useNotifications({ limit: 20 }), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    act(() => {
      for (let event = 0; event < 20; event++) mocks.subscribe.mock.calls[0][1]();
    });
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.count).toHaveBeenCalledTimes(2);
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
  });
  it('passes the query abort signal to Supabase reads', async () => {
    renderHook(() => useNotifications({ limit: 20 }), { wrapper });
    await waitFor(() => expect(mocks.list).toHaveBeenCalled());
    expect(mocks.list.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
    expect(mocks.count.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
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
