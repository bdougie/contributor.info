import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedRepoSearch } from '../unified-repo-search';
import { useRepositorySearch } from '@/hooks/use-repository-search';

// Mock the hook
jest.mock('@/hooks/use-repository-search', () => ({
  useRepositorySearch: jest.fn(),
}));

// Mock the ExampleRepos component
jest.mock('@/components/features/repository', () => ({
  ExampleRepos: () => <div data-testid="example-repos">Example Repos</div>,
}));

describe('UnifiedRepoSearch', () => {
  const mockHandleSearch = jest.fn();
  const mockHandleSelectRepository = jest.fn();
  const mockHandleSelectExample = jest.fn();
  const mockSetSearchInput = jest.fn();
  
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
    jest.clearAllMocks();
    (useRepositorySearch as jest.Mock).mockReturnValue({
      searchInput: '',
      setSearchInput: mockSetSearchInput,
      searchResults: [],
      isLoading: false,
      error: null,
      handleSearch: mockHandleSearch,
      handleSelectRepository: mockHandleSelectRepository,
      handleSelectExample: mockHandleSelectExample,
    });
  });

  it('renders with default props', () => {
    render(<UnifiedRepoSearch />);
    
    expect(screen.getByPlaceholderText('Search GitHub repositories...')).toBeInTheDocument();
    expect(screen.getByText('Analyze')).toBeInTheDocument();
    expect(screen.getByTestId('example-repos')).toBeInTheDocument();
  });

  it('renders with custom props', () => {
    render(
      <UnifiedRepoSearch 
        isHomeView={true} 
        placeholder="Custom placeholder" 
        buttonText="Custom button" 
      />
    );
    
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    expect(screen.getByText('Custom button')).toBeInTheDocument();
  });

  it('calls handleSearch on form submission', () => {
    render(<UnifiedRepoSearch />);
    
    const form = screen.getByRole('button', { name: /analyze/i }).closest('form');
    fireEvent.submit(form!);
    
    expect(mockHandleSearch).toHaveBeenCalled();
  });

  it('updates search input when typing', () => {
    render(<UnifiedRepoSearch />);
    
    const input = screen.getByPlaceholderText('Search GitHub repositories...');
    fireEvent.change(input, { target: { value: 'react' } });
    
    expect(mockSetSearchInput).toHaveBeenCalledWith('react');
  });

  it('displays search results when available', async () => {
    (useRepositorySearch as jest.Mock).mockReturnValue({
      searchInput: 'react',
      setSearchInput: mockSetSearchInput,
      searchResults: mockSearchResults,
      isLoading: false,
      error: null,
      handleSearch: mockHandleSearch,
      handleSelectRepository: mockHandleSelectRepository,
      handleSelectExample: mockHandleSelectExample,
    });
    
    render(<UnifiedRepoSearch />);
    
    // Trigger dropdown to open
    const input = screen.getByPlaceholderText('Search GitHub repositories...');
    fireEvent.focus(input);
    
    // Wait for results to be displayed
    await waitFor(() => {
      expect(screen.getByText('facebook/react')).toBeInTheDocument();
      expect(screen.getByText('A JavaScript library for building user interfaces')).toBeInTheDocument();
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('200K')).toBeInTheDocument();
    });
  });

  it('displays loading state', async () => {
    (useRepositorySearch as jest.Mock).mockReturnValue({
      searchInput: 'react',
      setSearchInput: mockSetSearchInput,
      searchResults: [],
      isLoading: true,
      error: null,
      handleSearch: mockHandleSearch,
      handleSelectRepository: mockHandleSelectRepository,
      handleSelectExample: mockHandleSelectExample,
    });
    
    render(<UnifiedRepoSearch />);
    
    // Trigger dropdown to open
    const input = screen.getByPlaceholderText('Search GitHub repositories...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'react' } });
    
    // Wait for loading state to be displayed
    await waitFor(() => {
      expect(screen.getByText('Searching repositories...')).toBeInTheDocument();
    });
  });

  it('displays error state', async () => {
    (useRepositorySearch as jest.Mock).mockReturnValue({
      searchInput: 'react',
      setSearchInput: mockSetSearchInput,
      searchResults: [],
      isLoading: false,
      error: 'API error',
      handleSearch: mockHandleSearch,
      handleSelectRepository: mockHandleSelectExample,
      handleSelectExample: mockHandleSelectExample,
    });
    
    render(<UnifiedRepoSearch />);
    
    // Trigger dropdown to open
    const input = screen.getByPlaceholderText('Search GitHub repositories...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'react' } });
    
    // Wait for error state to be displayed
    await waitFor(() => {
      expect(screen.getByText('API error')).toBeInTheDocument();
    });
  });
});