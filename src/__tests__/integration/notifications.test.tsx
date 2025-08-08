import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

// Mock WebSocket for real-time notifications
class MockWebSocket {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readyState: number = WebSocket.CONNECTING;
  
  constructor(public url: string) {
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 100);
  }
  
  send(data: string) {
    // Mock send - can be monitored in tests
    console.log('WebSocket send:', data);
  }
  
  close() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

global.WebSocket = MockWebSocket as any;

// Mock Server-Sent Events
class MockEventSource {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState: number = EventSource.CONNECTING;
  
  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = EventSource.OPEN;
      this.onopen?.(new Event('open'));
    }, 100);
  }
  
  close() {
    this.readyState = EventSource.CLOSED;
  }
}

global.EventSource = MockEventSource as any;

// Mock Notification API
const mockNotification = {
  permission: 'default' as NotificationPermission,
  requestPermission: vi.fn(() => Promise.resolve('granted' as NotificationPermission)),
};

class MockNotificationConstructor {
  constructor(public title: string, public options?: NotificationOptions) {
    // Mock notification instance
  }
  
  close() {
    // Mock close
  }
}

global.Notification = Object.assign(MockNotificationConstructor, mockNotification) as any;

// Mock React hooks
const mockReactHooks = {
  useState: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useRef: vi.fn(),
};

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: mockReactHooks.useState,
    useEffect: mockReactHooks.useEffect,
    useCallback: mockReactHooks.useCallback,
    useRef: mockReactHooks.useRef,
  };
});

// Mock notification service
const mockNotificationService = {
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  sendNotification: vi.fn(),
  getNotificationHistory: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  updateSettings: vi.fn(),
};

vi.mock('@/lib/notification-service', () => ({
  notificationService: mockNotificationService,
}));

// Mock Supabase real-time
const mockSupabaseRealtime = {
  channel: vi.fn(() => ({
    on: vi.fn(() => ({
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
  })),
  removeChannel: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({
    channel: mockSupabaseRealtime.channel,
    removeChannel: mockSupabaseRealtime.removeChannel,
  })),
}));

// Mock push notification service worker
const mockServiceWorkerRegistration = {
  showNotification: vi.fn(),
  getNotifications: vi.fn(() => Promise.resolve([])),
};

Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: vi.fn(() => Promise.resolve(mockServiceWorkerRegistration)),
    ready: Promise.resolve(mockServiceWorkerRegistration),
  },
  writable: true,
});

// Mock logging
vi.mock('@/lib/simple-logging', () => ({
  setApplicationContext: vi.fn(),
  startSpan: vi.fn((options, fn) => fn({ setStatus: vi.fn() })),
}));

interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  userId?: string;
  repositoryId?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

interface NotificationSettings {
  browserNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  categories: {
    pullRequests: boolean;
    issues: boolean;
    mentions: boolean;
    releases: boolean;
    security: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

describe('Real-time Notifications Integration Tests', () => {
  const mockNotifications: NotificationData[] = [
    {
      id: 'notif1',
      type: 'info',
      title: 'New Pull Request',
      message: 'Alice opened a new pull request in awesome-project',
      timestamp: '2024-06-21T10:00:00Z',
      read: false,
      userId: 'user1',
      repositoryId: 'repo1',
      actionUrl: '/repos/awesome-project/pulls/123',
      metadata: {
        prNumber: 123,
        author: 'alice',
      },
    },
    {
      id: 'notif2',
      type: 'success',
      title: 'Pull Request Merged',
      message: 'Your pull request #456 has been merged',
      timestamp: '2024-06-21T09:30:00Z',
      read: false,
      userId: 'user1',
      repositoryId: 'repo2',
      actionUrl: '/repos/useful-tool/pulls/456',
      metadata: {
        prNumber: 456,
        merger: 'bob',
      },
    },
    {
      id: 'notif3',
      type: 'warning',
      title: 'Review Requested',
      message: 'Charlie requested your review on pull request #789',
      timestamp: '2024-06-21T08:15:00Z',
      read: true,
      userId: 'user1',
      repositoryId: 'repo1',
      actionUrl: '/repos/awesome-project/pulls/789',
      metadata: {
        prNumber: 789,
        reviewer: 'charlie',
      },
    },
  ];

  const mockSettings: NotificationSettings = {
    browserNotifications: true,
    emailNotifications: false,
    pushNotifications: true,
    categories: {
      pullRequests: true,
      issues: true,
      mentions: true,
      releases: false,
      security: true,
    },
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '08:00',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default notification service responses
    mockNotificationService.getNotificationHistory.mockResolvedValue(mockNotifications);
    mockNotificationService.subscribe.mockResolvedValue({ success: true });
    mockNotificationService.sendNotification.mockResolvedValue({ success: true });
    mockNotificationService.markAsRead.mockResolvedValue({ success: true });
    
    // Setup React hooks
    mockReactHooks.useState.mockImplementation((initial) => {
      let state = initial;
      const setState = (newState: any) => {
        state = typeof newState === 'function' ? newState(state) : newState;
      };
      return [state, setState];
    });
    
    mockReactHooks.useEffect.mockImplementation((effect, deps) => {
      effect();
    });
    
    mockReactHooks.useCallback.mockImplementation((callback) => callback);
    
    mockReactHooks.useRef.mockImplementation((initial) => ({ current: initial }));
    
    // Setup Supabase realtime
    mockSupabaseRealtime.channel.mockReturnValue({
      on: vi.fn(() => ({
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('Real-time Notification Delivery', () => {
    it('should establish WebSocket connection for real-time updates', async () => {
      const establishConnection = async () => {
        return new Promise<WebSocket>((resolve, reject) => {
          const ws = new WebSocket('wss://api.example.com/notifications');
          
          ws.onopen = () => resolve(ws);
          ws.onerror = () => reject(new Error('Connection failed'));
          
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
      };

      const connection = await establishConnection();
      
      expect(connection).toBeInstanceOf(MockWebSocket);
      expect(connection.readyState).toBe(WebSocket.OPEN);
    });

    it('should handle incoming WebSocket messages', async () => {
      const messageHandler = vi.fn();
      
      const setupWebSocketHandler = () => {
        const ws = new WebSocket('wss://api.example.com/notifications');
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          messageHandler(data);
        };
        
        return ws;
      };

      const ws = setupWebSocketHandler();
      
      // Wait for connection
      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Simulate incoming message
      const mockMessage = new MessageEvent('message', {
        data: JSON.stringify(mockNotifications[0]),
      });
      
      ws.onmessage?.(mockMessage);
      
      expect(messageHandler).toHaveBeenCalledWith(mockNotifications[0]);
    });

    it('should handle WebSocket connection failures and reconnection', async () => {
      let connectionAttempts = 0;
      const maxRetries = 3;
      
      const connectWithRetry = async (): Promise<WebSocket> => {
        return new Promise((resolve, reject) => {
          const attemptConnection = () => {
            connectionAttempts++;
            const ws = new WebSocket('wss://api.example.com/notifications');
            
            ws.onopen = () => resolve(ws);
            
            ws.onerror = () => {
              if (connectionAttempts < maxRetries) {
                setTimeout(attemptConnection, 1000 * connectionAttempts);
              } else {
                reject(new Error('Max retries exceeded'));
              }
            };
          };
          
          attemptConnection();
        });
      };

      // Mock the first two attempts to fail
      const originalWebSocket = global.WebSocket;
      let callCount = 0;
      
      global.WebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          callCount++;
          if (callCount <= 2) {
            setTimeout(() => {
              this.readyState = WebSocket.CLOSED;
              this.onerror?.(new Event('error'));
            }, 50);
          }
        }
      } as any;

      try {
        const connection = await connectWithRetry();
        expect(connection).toBeInstanceOf(MockWebSocket);
        expect(connectionAttempts).toBe(3);
      } finally {
        global.WebSocket = originalWebSocket;
      }
    });

    it('should use Server-Sent Events as WebSocket fallback', async () => {
      const fallbackToSSE = () => {
        const eventSource = new EventSource('/api/notifications/stream');
        
        const handler = vi.fn();
        eventSource.onmessage = handler;
        
        return { eventSource, handler };
      };

      const { eventSource, handler } = fallbackToSSE();
      
      await waitFor(() => {
        expect(eventSource.readyState).toBe(EventSource.OPEN);
      });

      // Simulate incoming message
      const mockMessage = new MessageEvent('message', {
        data: JSON.stringify(mockNotifications[0]),
      });
      
      eventSource.onmessage?.(mockMessage);
      
      expect(handler).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle Supabase realtime subscriptions', async () => {
      const subscribeToNotifications = async (userId: string) => {
        const channel = mockSupabaseRealtime.channel(`notifications:${userId}`);
        
        const subscription = channel
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          }, (payload: any) => {
            mockNotificationService.sendNotification(payload.new);
          })
          .subscribe();

        return { channel, subscription };
      };

      const result = await subscribeToNotifications('user1');
      
      expect(mockSupabaseRealtime.channel).toHaveBeenCalledWith('notifications:user1');
      expect(result.channel).toBeDefined();
      expect(result.subscription).toBeDefined();
    });
  });

  describe('Browser Notifications', () => {
    it('should request notification permission from browser', async () => {
      const requestPermission = async () => {
        if (!('Notification' in window)) {
          throw new Error('Browser does not support notifications');
        }
        
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          return permission;
        }
        
        return Notification.permission;
      };

      const permission = await requestPermission();
      
      expect(Notification.requestPermission).toHaveBeenCalled();
      expect(permission).toBe('granted');
    });

    it('should show browser notification when permission granted', async () => {
      const showBrowserNotification = async (notification: NotificationData) => {
        if (Notification.permission !== 'granted') {
          throw new Error('Notification permission not granted');
        }
        
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          tag: notification.id,
          data: notification.metadata,
        });
        
        return browserNotification;
      };

      // Mock permission as granted
      mockNotification.permission = 'granted';
      
      const browserNotification = await showBrowserNotification(mockNotifications[0]);
      
      expect(browserNotification).toBeInstanceOf(MockNotificationConstructor);
      expect(browserNotification.title).toBe('New Pull Request');
    });

    it('should handle notification click events', async () => {
      const handleNotificationClick = (notification: NotificationData) => {
        return new Promise<string>((resolve) => {
          const browserNotification = new Notification(notification.title, {
            body: notification.message,
            data: { actionUrl: notification.actionUrl },
          });
          
          // Mock click handler
          setTimeout(() => {
            if (notification.actionUrl) {
              resolve(notification.actionUrl);
            }
          }, 100);
        });
      };

      const actionUrl = await handleNotificationClick(mockNotifications[0]);
      
      expect(actionUrl).toBe('/repos/awesome-project/pulls/123');
    });

    it('should group similar notifications', async () => {
      const groupNotifications = (notifications: NotificationData[]) => {
        const groups = new Map<string, NotificationData[]>();
        
        notifications.forEach(notification => {
          const groupKey = `${notification.type}:${notification.repositoryId}`;
          if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
          }
          groups.get(groupKey)!.push(notification);
        });
        
        return groups;
      };

      const multipleNotifications = [
        ...mockNotifications,
        {
          id: 'notif4',
          type: 'info' as const,
          title: 'Another Pull Request',
          message: 'Bob opened another pull request in awesome-project',
          timestamp: '2024-06-21T11:00:00Z',
          read: false,
          repositoryId: 'repo1',
        },
      ];

      const groups = groupNotifications(multipleNotifications);
      
      expect(groups.size).toBe(3); // Different type/repo combinations
      expect(groups.get('info:repo1')?.length).toBe(2);
    });
  });

  describe('Push Notifications', () => {
    it('should register service worker for push notifications', async () => {
      const registerServiceWorker = async () => {
        if (!('serviceWorker' in navigator)) {
          throw new Error('Service workers not supported');
        }
        
        const registration = await navigator.serviceWorker.register('/sw.js');
        return registration;
      };

      const registration = await registerServiceWorker();
      
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
      expect(registration).toBe(mockServiceWorkerRegistration);
    });

    it('should handle push notification subscription', async () => {
      const subscribeToPush = async (registration: ServiceWorkerRegistration) => {
        // Mock push manager
        const pushManager = {
          subscribe: vi.fn(() => 
            Promise.resolve({
              endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
              keys: {
                p256dh: 'key1',
                auth: 'key2',
              },
            })
          ),
        };
        
        (registration as any).pushManager = pushManager;
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 'server-key',
        });
        
        return subscription;
      };

      const subscription = await subscribeToPush(mockServiceWorkerRegistration as any);
      
      expect(subscription).toBeDefined();
      expect(subscription.endpoint).toContain('fcm.googleapis.com');
    });

    it('should handle push message reception in service worker', async () => {
      const handlePushMessage = (event: any) => {
        const data = event.data ? event.data.json() : {};
        
        const notificationOptions = {
          body: data.message,
          icon: data.icon || '/icon-192x192.png',
          badge: '/badge-72x72.png',
          data: data.metadata,
          actions: data.actions || [],
        };
        
        return mockServiceWorkerRegistration.showNotification(data.title, notificationOptions);
      };

      const mockPushEvent = {
        data: {
          json: () => ({
            title: 'Push Notification',
            message: 'You have a new notification',
            icon: '/icon.png',
            metadata: { id: 'push1' },
          }),
        },
      };

      await handlePushMessage(mockPushEvent);
      
      expect(mockServiceWorkerRegistration.showNotification).toHaveBeenCalledWith(
        'Push Notification',
        expect.objectContaining({
          body: 'You have a new notification',
          icon: '/icon.png',
        })
      );
    });
  });

  describe('Notification Management', () => {
    it('should retrieve notification history', async () => {
      const getNotifications = async (userId: string, options?: {
        unreadOnly?: boolean;
        limit?: number;
        offset?: number;
      }) => {
        let notifications = await mockNotificationService.getNotificationHistory(userId);
        
        if (options?.unreadOnly) {
          notifications = notifications.filter(n => !n.read);
        }
        
        if (options?.limit) {
          notifications = notifications.slice(options.offset || 0, (options.offset || 0) + options.limit);
        }
        
        return notifications;
      };

      const allNotifications = await getNotifications('user1');
      const unreadNotifications = await getNotifications('user1', { unreadOnly: true });
      
      expect(mockNotificationService.getNotificationHistory).toHaveBeenCalledWith('user1');
      expect(allNotifications).toHaveLength(3);
      expect(unreadNotifications.length).toBeLessThan(allNotifications.length);
    });

    it('should mark notifications as read', async () => {
      const markAsRead = async (notificationId: string) => {
        const result = await mockNotificationService.markAsRead(notificationId);
        return result;
      };

      const result = await markAsRead('notif1');
      
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith('notif1');
      expect(result.success).toBe(true);
    });

    it('should mark all notifications as read', async () => {
      const markAllAsRead = async (userId: string) => {
        const result = await mockNotificationService.markAllAsRead(userId);
        return result;
      };

      const result = await markAllAsRead('user1');
      
      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith('user1');
      expect(result.success).toBe(true);
    });

    it('should delete notifications', async () => {
      const deleteNotification = async (notificationId: string) => {
        const result = await mockNotificationService.deleteNotification(notificationId);
        return result;
      };

      const result = await deleteNotification('notif1');
      
      expect(mockNotificationService.deleteNotification).toHaveBeenCalledWith('notif1');
      expect(result.success).toBe(true);
    });

    it('should handle notification settings updates', async () => {
      const updateSettings = async (userId: string, settings: Partial<NotificationSettings>) => {
        const result = await mockNotificationService.updateSettings(userId, settings);
        return result;
      };

      const newSettings = { 
        browserNotifications: false,
        categories: { pullRequests: false } 
      };
      
      const result = await updateSettings('user1', newSettings);
      
      expect(mockNotificationService.updateSettings).toHaveBeenCalledWith('user1', newSettings);
      expect(result.success).toBe(true);
    });
  });

  describe('Notification Filtering and Preferences', () => {
    it('should respect quiet hours settings', async () => {
      const isInQuietHours = (settings: NotificationSettings) => {
        if (!settings.quietHours.enabled) return false;
        
        const now = new Date();
        const currentHour = now.getHours();
        const startHour = parseInt(settings.quietHours.start.split(':')[0]);
        const endHour = parseInt(settings.quietHours.end.split(':')[0]);
        
        if (startHour > endHour) {
          // Quiet hours cross midnight
          return currentHour >= startHour || currentHour < endHour;
        } else {
          return currentHour >= startHour && currentHour < endHour;
        }
      };

      // Mock current time to be in quiet hours (23:00)
      const mockDate = new Date('2024-06-21T23:00:00Z');
      vi.setSystemTime(mockDate);

      const inQuietHours = isInQuietHours(mockSettings);
      
      expect(inQuietHours).toBe(true);
      
      vi.useRealTimers();
    });

    it('should filter notifications by category preferences', async () => {
      const shouldShowNotification = (
        notification: NotificationData,
        settings: NotificationSettings
      ) => {
        const categoryMap: Record<string, keyof NotificationSettings['categories']> = {
          'pullRequests': 'pullRequests',
          'issues': 'issues',
          'mentions': 'mentions',
          'releases': 'releases',
          'security': 'security',
        };
        
        const category = categoryMap[notification.metadata?.category || 'pullRequests'];
        return settings.categories[category] ?? true;
      };

      const prNotification = {
        ...mockNotifications[0],
        metadata: { category: 'pullRequests' },
      };
      
      const securityNotification = {
        ...mockNotifications[0],
        metadata: { category: 'security' },
      };

      expect(shouldShowNotification(prNotification, mockSettings)).toBe(true);
      expect(shouldShowNotification(securityNotification, mockSettings)).toBe(true);
    });

    it('should handle notification deduplication', async () => {
      const deduplicateNotifications = (notifications: NotificationData[]) => {
        const seen = new Set();
        const deduplicated = [];
        
        for (const notification of notifications) {
          const key = `${notification.type}:${notification.title}:${notification.repositoryId}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduplicated.push(notification);
          }
        }
        
        return deduplicated;
      };

      const duplicateNotifications = [
        mockNotifications[0],
        { ...mockNotifications[0], id: 'duplicate1' },
        mockNotifications[1],
        { ...mockNotifications[0], id: 'duplicate2' },
      ];

      const deduplicated = deduplicateNotifications(duplicateNotifications);
      
      expect(deduplicated).toHaveLength(2);
      expect(deduplicated[0].id).toBe('notif1');
      expect(deduplicated[1].id).toBe('notif2');
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle notification service failures gracefully', async () => {
      mockNotificationService.getNotificationHistory.mockRejectedValue(
        new Error('Service temporarily unavailable')
      );

      const getNotificationsWithFallback = async (userId: string) => {
        try {
          return await mockNotificationService.getNotificationHistory(userId);
        } catch (error) {
          // Return cached notifications or empty array
          return [];
        }
      };

      const result = await getNotificationsWithFallback('user1');
      
      expect(result).toEqual([]);
      expect(mockNotificationService.getNotificationHistory).toHaveBeenCalledWith('user1');
    });

    it('should handle browser notification permission denied', async () => {
      mockNotification.permission = 'denied';
      mockNotification.requestPermission.mockResolvedValue('denied');

      const handlePermissionDenied = async () => {
        const permission = await Notification.requestPermission();
        
        if (permission === 'denied') {
          // Fall back to in-app notifications
          return { 
            browserNotifications: false,
            fallbackMethod: 'in-app',
            message: 'Browser notifications disabled, using in-app notifications',
          };
        }
        
        return { browserNotifications: true };
      };

      const result = await handlePermissionDenied();
      
      expect(result.browserNotifications).toBe(false);
      expect(result.fallbackMethod).toBe('in-app');
    });

    it('should handle WebSocket connection drops', async () => {
      const connectionManager = {
        ws: null as WebSocket | null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        reconnectDelay: 1000,
        
        connect() {
          this.ws = new WebSocket('wss://api.example.com/notifications');
          
          this.ws.onclose = () => {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              setTimeout(() => this.connect(), this.reconnectDelay);
            }
          };
          
          this.ws.onopen = () => {
            this.reconnectAttempts = 0;
          };
        },
        
        disconnect() {
          if (this.ws) {
            this.ws.close();
            this.ws = null;
          }
        },
      };

      connectionManager.connect();
      
      // Wait for initial connection
      await waitFor(() => {
        expect(connectionManager.ws?.readyState).toBe(WebSocket.OPEN);
      });

      // Simulate connection drop
      connectionManager.ws?.close();
      
      expect(connectionManager.reconnectAttempts).toBeGreaterThan(0);
    });

    it('should handle malformed notification data', async () => {
      const malformedNotifications = [
        { id: 'bad1', title: null, message: 'Valid message' }, // Invalid title
        { id: 'bad2', title: 'Valid title' }, // Missing message
        { id: 'bad3', title: 'Valid', message: 'Valid', timestamp: 'invalid-date' }, // Invalid timestamp
      ];

      const sanitizeNotifications = (notifications: any[]): NotificationData[] => {
        return notifications
          .filter(n => n.id && n.title && n.message)
          .map(n => ({
            ...n,
            type: n.type || 'info',
            timestamp: isNaN(Date.parse(n.timestamp)) ? new Date().toISOString() : n.timestamp,
            read: Boolean(n.read),
          }));
      };

      const sanitized = sanitizeNotifications(malformedNotifications);
      
      expect(sanitized).toHaveLength(1);
      expect(sanitized[0].id).toBe('bad3');
      expect(sanitized[0].type).toBe('info');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency notifications efficiently', async () => {
      const notificationBuffer: NotificationData[] = [];
      const batchSize = 50;
      const batchDelay = 1000;

      const batchNotifications = (notification: NotificationData) => {
        notificationBuffer.push(notification);
        
        if (notificationBuffer.length >= batchSize) {
          processBatch();
        }
      };

      const processBatch = () => {
        if (notificationBuffer.length === 0) return;
        
        const batch = notificationBuffer.splice(0, batchSize);
        mockNotificationService.sendNotification(batch);
      };

      // Simulate high-frequency notifications
      for (let i = 0; i < 100; i++) {
        batchNotifications({
          ...mockNotifications[0],
          id: `high-freq-${i}`,
          timestamp: new Date(Date.now() + i * 100).toISOString(),
        });
      }

      expect(notificationBuffer.length).toBe(0); // Should be processed in batches
      expect(mockNotificationService.sendNotification).toHaveBeenCalledTimes(2); // 2 batches of 50
    });

    it('should limit notification storage and implement cleanup', async () => {
      const maxStoredNotifications = 100;
      
      const cleanupOldNotifications = async (notifications: NotificationData[]) => {
        if (notifications.length <= maxStoredNotifications) {
          return notifications;
        }
        
        // Keep only the most recent notifications
        const sorted = notifications.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        const toKeep = sorted.slice(0, maxStoredNotifications);
        const toDelete = sorted.slice(maxStoredNotifications);
        
        // Delete old notifications
        for (const notification of toDelete) {
          await mockNotificationService.deleteNotification(notification.id);
        }
        
        return toKeep;
      };

      const manyNotifications = Array.from({ length: 150 }, (_, i) => ({
        ...mockNotifications[0],
        id: `notif-${i}`,
        timestamp: new Date(Date.now() - i * 60000).toISOString(), // Spread over time
      }));

      const cleaned = await cleanupOldNotifications(manyNotifications);
      
      expect(cleaned).toHaveLength(100);
      expect(mockNotificationService.deleteNotification).toHaveBeenCalledTimes(50);
    });
  });
});