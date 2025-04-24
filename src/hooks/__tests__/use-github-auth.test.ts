import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGitHubAuth } from '../use-github-auth';

// Mock the dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/services/supabase-client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));

// Mock navigate function
const mockNavigate = vi.fn();

// Mock for localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock location and history
const originalLocation = window.location;
const mockReplaceState = vi.fn();

describe('useGitHubAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    
    // Reset mocks
    Object.defineProperty(window, 'location', {
      value: {
        hash: '',
        href: 'http://localhost:3000',
        pathname: '/',
        search: '',
      },
      writable: true,
    });
    
    window.history.replaceState = mockReplaceState;
    
    // Default mock implementations
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: {},
      error: null,
    });
    
    vi.mocked(supabase.auth.signOut).mockResolvedValue({
      error: null,
    });
  });
  
  afterEach(() => {
    window.location = originalLocation;
  });
  
  it('should initialize with loading state', async () => {
    const { result } = renderHook(() => useGitHubAuth());
    
    // Initial state should be loading
    expect(result.current.loading).toBe(true);
    expect(result.current.isLoggedIn).toBe(false);
    
    // Wait for the effect to complete
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Verify supabase was called
    expect(supabase.auth.getSession).toHaveBeenCalled();
  });
  
  it('should set isLoggedIn to true when session exists', async () => {
    // Mock a successful auth session
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'test-user-id' },
          expires_at: 123456789,
        },
      },
      error: null,
    });
    
    const { result } = renderHook(() => useGitHubAuth());
    
    await vi.waitFor(() => {
      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.loading).toBe(false);
    });
  });
  
  it('should handle auth parameters in URL', async () => {
    // Mock session and URL with auth params
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'test-user-id' },
          expires_at: 123456789,
        },
      },
      error: null,
    });
    
    // Set hash in URL
    Object.defineProperty(window, 'location', {
      value: {
        hash: '#access_token=test-token',
        href: 'http://localhost:3000/#access_token=test-token',
        pathname: '/',
        search: '',
      },
      writable: true,
    });
    
    const { result } = renderHook(() => useGitHubAuth());
    
    await vi.waitFor(() => {
      expect(result.current.isLoggedIn).toBe(true);
    });
    
    // Should clean up URL hash
    expect(mockReplaceState).toHaveBeenCalled();
  });
  
  it('should redirect to stored path after login', async () => {
    // Setup: store a redirect path
    const redirectPath = '/facebook/react';
    localStorageMock.setItem('redirectAfterLogin', redirectPath);
    
    // Mock a successful auth session
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'test-user-id' },
          expires_at: 123456789,
        },
      },
      error: null,
    });
    
    const { result } = renderHook(() => useGitHubAuth());
    
    await vi.waitFor(() => {
      expect(result.current.isLoggedIn).toBe(true);
    });
    
    // Should navigate to the redirect path
    expect(mockNavigate).toHaveBeenCalledWith(redirectPath);
    
    // Should clear the stored path
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('redirectAfterLogin');
  });
  
  it('should call supabase signInWithOAuth when login is called', async () => {
    const { result } = renderHook(() => useGitHubAuth());
    
    await act(async () => {
      await result.current.login();
    });
    
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: false,
      },
    });
  });
  
  it('should call supabase signOut when logout is called', async () => {
    const { result } = renderHook(() => useGitHubAuth());
    
    await act(async () => {
      await result.current.logout();
    });
    
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
  
  it('should handle auth state change events', async () => {
    // Setup auth change handler
    let authChangeHandler: any;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((handler) => {
      authChangeHandler = handler;
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      };
    });
    
    // Setup redirect path
    localStorageMock.setItem('redirectAfterLogin', '/test/redirect');
    
    const { result } = renderHook(() => useGitHubAuth());
    
    // Simulate auth state change to signed in
    await act(async () => {
      authChangeHandler('SIGNED_IN', { user: { id: 'test-user-id' } });
    });
    
    // Should be logged in
    expect(result.current.isLoggedIn).toBe(true);
    
    // Should navigate and clear localStorage
    expect(mockNavigate).toHaveBeenCalledWith('/test/redirect');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('redirectAfterLogin');
  });
  
  it('should handle errors during session checking', async () => {
    // Mock an error in getSession
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: new Error('Session error'),
    });
    
    // Spy on console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const { result } = renderHook(() => useGitHubAuth());
    
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Should log the error
    expect(consoleSpy).toHaveBeenCalled();
    expect(result.current.isLoggedIn).toBe(false);
    
    // Restore console
    consoleSpy.mockRestore();
  });
});