import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { UnifiedRepoSearch } from '../unified-repo-search';
import * as repositorySearchModule from '@/hooks/use-repository-search';
import * as githubAuthModule from '@/hooks/use-github-auth';

// Mock the hooks
vi.mock('@/hooks/use-repository-search');
vi.mock('@/hooks/use-github-auth');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const mockUseRepositorySearch = vi.mocked(repositorySearchModule.useRepositorySearch);
const mockUseGitHubAuth = vi.mocked(githubAuthModule.useGitHubAuth);

const mockSearchResults = [
  {
    id: 1,
    full_name: 'facebook/react',
    name: 'react',
    owner: {
      login: 'facebook',
      avatar_url: 'https://avatars.githubusercontent.com/u/69631?v=4',
    },
    description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
    stargazers_count: 220000,
    forks_count: 45000,
    language: 'JavaScript',
    updated_at: '2024-01-01T00:00:00Z',
    html_url: 'https://github.com/facebook/react',
  },
  {
    id: 2,
    full_name: 'vercel/next.js',
    name: 'next.js',
    owner: {
      login: 'vercel',
      avatar_url: 'https://avatars.githubusercontent.com/u/14985020?v=4',
    },
    description: 'The React Framework',
    stargazers_count: 120000,
    forks_count: 26000,
    language: 'JavaScript',
    updated_at: '2024-01-02T00:00:00Z',
    html_url: 'https://github.com/vercel/next.js',
  },
];

const defaultSearchHook = {
  query: '',
  setQuery: vi.fn(),
  results: [],
  isLoading: false,
  error: null,
  hasResults: false,
  clearResults: vi.fn(),
};

const defaultAuthHook = {
  isLoggedIn: false,
  user: null,
  login: vi.fn(),
  logout: vi.fn(),
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

describe('UnifiedRepoSearch', () => {
  beforeEach(() => {
    mockUseRepositorySearch.mockReturnValue(defaultSearchHook);
    mockUseGitHubAuth.mockReturnValue(defaultAuthHook);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render input with correct placeholder', () => {
    render(
      <TestWrapper>
        <UnifiedRepoSearch placeholder="Search repositories" />
      </TestWrapper>
    );

    expect(screen.getByPlaceholderText('Search repositories')).toBeInTheDocument();
  });

  it('should render button with correct text', () => {
    render(
      <TestWrapper>
        <UnifiedRepoSearch buttonText="Analyze" />
      </TestWrapper>
    );

    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument();
  });

  it('should update query when typing', () => {
    const setQuery = vi.fn();
    mockUseRepositorySearch.mockReturnValue({
      ...defaultSearchHook,
      setQuery,
    });

    render(
      <TestWrapper>
        <UnifiedRepoSearch />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'react' } });

    expect(setQuery).toHaveBeenCalledWith('react');
  });

  it('should show loading state', () => {
    mockUseRepositorySearch.mockReturnValue({
      ...defaultSearchHook,
      query: 'react',
      isLoading: true,
    });

    render(
      <TestWrapper>
        <UnifiedRepoSearch />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    expect(screen.getByText('Searching repositories...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    const errorMessage = 'GitHub API rate limit exceeded';
    mockUseRepositorySearch.mockReturnValue({
      ...defaultSearchHook,
      query: 'react',
      error: errorMessage,
    });

    render(
      <TestWrapper>
        <UnifiedRepoSearch />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('should show no results message', () => {
    mockUseRepositorySearch.mockReturnValue({
      ...defaultSearchHook,
      query: 'nonexistentrepo123',
      hasResults: false,
    });

    render(
      <TestWrapper>
        <UnifiedRepoSearch />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    expect(screen.getByText('No repositories found.')).toBeInTheDocument();
  });

  it('should show search results', async () => {
    mockUseRepositorySearch.mockReturnValue({
      ...defaultSearchHook,
      query: 'react',
      results: mockSearchResults,
      hasResults: true,
    });

    render(
      <TestWrapper>
        <UnifiedRepoSearch />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByText('facebook/react')).toBeInTheDocument();
      expect(screen.getByText('vercel/next.js')).toBeInTheDocument();
    });
  });

  it('should display repository information correctly', async () => {
    mockUseRepositorySearch.mockReturnValue({
      ...defaultSearchHook,
      query: 'react',
      results: mockSearchResults,
      hasResults: true,
    });

    render(
      <TestWrapper>
        <UnifiedRepoSearch />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    await waitFor(() => {
      // Check repository name
      expect(screen.getByText('facebook/react')).toBeInTheDocument();
      
      // Check description
      expect(screen.getByText(/A declarative, efficient, and flexible JavaScript library/)).toBeInTheDocument();
      
      // Check language badge
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      
      // Check stars (should show as 220k)
      expect(screen.getByText('220.0k')).toBeInTheDocument();
      
      // Check forks
      expect(screen.getByText('45000')).toBeInTheDocument();
    });
  });

  it('should handle repository selection', async () => {
    const clearResults = vi.fn();
    const onRepositorySelect = vi.fn();
    
    mockUseRepositorySearch.mockReturnValue({
      ...defaultSearchHook,
      query: 'react',
      results: mockSearchResults,
      hasResults: true,
      clearResults,
    });

    render(
      <TestWrapper>
        <UnifiedRepoSearch onRepositorySelect={onRepositorySelect} />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    await waitFor(() => {
      const reactItem = screen.getByText('facebook/react');
      fireEvent.click(reactItem);
    });

    expect(onRepositorySelect).toHaveBeenCalledWith('facebook', 'react');
    expect(clearResults).toHaveBeenCalled();
  });

  it('should handle form submission with direct input', () => {
    const mockNavigate = vi.fn();
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });

    render(
      <TestWrapper>
        <UnifiedRepoSearch isHomeView={true} />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox');
    const form = input.closest('form')!;

    fireEvent.change(input, { target: { value: 'facebook/react' } });
    fireEvent.submit(form);

    // Should navigate to the repository page
    expect(mockNavigate).toHaveBeenCalledWith('/facebook/react');
  });

  it('should handle keyboard navigation', async () => {
    mockUseRepositorySearch.mockReturnValue({
      ...defaultSearchHook,
      query: 'react',
      results: mockSearchResults,
      hasResults: true,
    });

    render(
      <TestWrapper>
        <UnifiedRepoSearch />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    // Navigate down
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    
    // Navigate up
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    
    // Close with Escape
    fireEvent.keyDown(input, { key: 'Escape' });
    
    // No errors should occur
    expect(input).toBeInTheDocument();
  });

  it('should require login for repo view when not logged in', () => {
    const mockNavigate = vi.fn();
    
    // Mock localStorage
    const mockSetItem = vi.fn();
    Object.defineProperty(window, 'localStorage', {
      value: {
        setItem: mockSetItem,
      },
      writable: true,
    });

    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });

    mockUseGitHubAuth.mockReturnValue({
      ...defaultAuthHook,
      isLoggedIn: false,
    });

    render(
      <TestWrapper>
        <UnifiedRepoSearch isHomeView={false} />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox');
    const form = input.closest('form')!;

    fireEvent.change(input, { target: { value: 'facebook/react' } });
    fireEvent.submit(form);

    expect(mockSetItem).toHaveBeenCalledWith('redirectAfterLogin', '/facebook/react');
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('should allow navigation when logged in on repo view', () => {
    const mockNavigate = vi.fn();
    
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });

    mockUseGitHubAuth.mockReturnValue({
      ...defaultAuthHook,
      isLoggedIn: true,
    });

    render(
      <TestWrapper>
        <UnifiedRepoSearch isHomeView={false} />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox');
    const form = input.closest('form')!;

    fireEvent.change(input, { target: { value: 'facebook/react' } });
    fireEvent.submit(form);

    expect(mockNavigate).toHaveBeenCalledWith('/facebook/react');
  });
});