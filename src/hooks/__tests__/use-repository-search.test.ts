import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRepositorySearch } from '../use-repository-search';
import { searchRepositories } from '@/lib/github';
import { useNavigate } from 'react-router-dom';
import { useGitHubAuth } from '../use-github-auth';

// Mock dependencies
vi.mock('@/lib/github', () => ({
  searchRepositories: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

vi.mock('../use-github-auth', () => ({
  useGitHubAuth: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useRepositorySearch', () => {
  const mockNavigate = vi.fn();
  const mockSearchResults = [
    {
      id: 1,
      name: 'react',
      full_name: 'facebook/react',
      owner: {
        login: 'facebook',
        avatar_url: 'https://avatars.githubusercontent.com/u/69631?v=4',
      },
      description: 'A JavaScript library for building user interfaces',
      html_url: 'https://github.com/facebook/react',
      stargazers_count: 200000,
      forks_count: 40000,
      language: 'JavaScript',
      updated_at: '2023-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(mockNavigate);
    (useGitHubAuth as any).mockReturnValue({ isLoggedIn: true });
    (searchRepositories as any).mockResolvedValue(mockSearchResults);
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useRepositorySearch());
    
    expect(result.current.searchInput).toBe('');
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should update search input when setSearchInput is called', () => {
    const { result } = renderHook(() => useRepositorySearch());
    
    act(() => {
      result.current.setSearchInput('react');
    });
    
    expect(result.current.searchInput).toBe('react');
  });

  it('should search repositories when input changes', async () => {
    const { result } = renderHook(() => useRepositorySearch({ debounceMs: 0 }));
    
    act(() => {
      result.current.setSearchInput('react');
    });
    
    await waitFor(() => {
      expect(searchRepositories).toHaveBeenCalledWith('react');
      expect(result.current.searchResults).toEqual(mockSearchResults);
    });
  });

  it('should handle search errors', async () => {
    (searchRepositories as any).mockRejectedValue(new Error('API error'));
    
    const { result } = renderHook(() => useRepositorySearch({ debounceMs: 0 }));
    
    act(() => {
      result.current.setSearchInput('react');
    });
    
    await waitFor(() => {
      expect(result.current.error).toBe('API error');
      expect(result.current.searchResults).toEqual([]);
    });
  });

  it('should navigate to repository when handleSelectRepository is called', () => {
    const { result } = renderHook(() => useRepositorySearch());
    
    act(() => {
      result.current.handleSelectRepository(mockSearchResults[0]);
    });
    
    expect(mockNavigate).toHaveBeenCalledWith('/facebook/react');
  });

  it('should redirect to login if not logged in on repo view', () => {
    (useGitHubAuth as any).mockReturnValue({ isLoggedIn: false });
    
    const { result } = renderHook(() => useRepositorySearch({ isHomeView: false }));
    
    act(() => {
      result.current.handleSelectRepository(mockSearchResults[0]);
    });
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith('redirectAfterLogin', '/facebook/react');
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('should allow navigation on home view even if not logged in', () => {
    (useGitHubAuth as any).mockReturnValue({ isLoggedIn: false });
    
    const { result } = renderHook(() => useRepositorySearch({ isHomeView: true }));
    
    act(() => {
      result.current.handleSelectRepository(mockSearchResults[0]);
    });
    
    expect(mockNavigate).toHaveBeenCalledWith('/facebook/react');
  });

  it('should handle form submission with owner/repo format', () => {
    const { result } = renderHook(() => useRepositorySearch());
    const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    
    // First set the search input
    act(() => {
      result.current.setSearchInput('facebook/react');
    });
    
    // Then handle the search
    act(() => {
      result.current.handleSearch(mockEvent);
    });
    
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/facebook/react');
  });

  it('should handle example repository selection', () => {
    const { result } = renderHook(() => useRepositorySearch());
    
    act(() => {
      result.current.handleSelectExample('facebook/react');
    });
    
    expect(result.current.searchInput).toBe('facebook/react');
    expect(mockNavigate).toHaveBeenCalledWith('/facebook/react');
  });
});