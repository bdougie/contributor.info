import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import RepoNotFound from '../repo-not-found';

// Mock the hooks
vi.mock('@/hooks/use-repo-search', () => ({
  useRepoSearch: () => ({
    searchInput: '',
    setSearchInput: vi.fn(),
    handleSearch: vi.fn(),
    handleSelectExample: vi.fn(),
  }),
}));

// Mock react-router-dom params
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ owner: 'nonexistent', repo: 'repository' }),
    useNavigate: () => vi.fn(),
  };
});

// Mock ExampleRepos component since it's not the focus of this test
vi.mock('../example-repos', () => ({
  ExampleRepos: () => (
    <div data-testid="example-repos">Example Repos</div>
  ),
}));

function renderWithProviders(component: React.ReactElement) {
  return render(
    <HelmetProvider>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </HelmetProvider>
  );
}

describe('RepoNotFound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the terminal-style 404 page', () => {
    renderWithProviders(<RepoNotFound />);
    
    expect(screen.getByText('contributor.info - Repository Terminal')).toBeInTheDocument();
    expect(screen.getByText('fatal: repository not found')).toBeInTheDocument();
    expect(screen.getByText("The repository 'nonexistent/repository' does not exist or is not accessible.")).toBeInTheDocument();
  });

  it('shows the git clone command with the repo path', () => {
    renderWithProviders(<RepoNotFound />);
    
    expect(screen.getByText('git clone https://github.com/nonexistent/repository.git')).toBeInTheDocument();
  });

  it('displays helpful error explanations', () => {
    renderWithProviders(<RepoNotFound />);
    
    expect(screen.getByText('This could mean:')).toBeInTheDocument();
    expect(screen.getByText('• The repository name is misspelled')).toBeInTheDocument();
    expect(screen.getByText('• The repository is private')).toBeInTheDocument();
    expect(screen.getByText('• The repository has been moved or deleted')).toBeInTheDocument();
    expect(screen.getByText('• The owner name is incorrect')).toBeInTheDocument();
  });

  it('renders search input and example repos', () => {
    renderWithProviders(<RepoNotFound />);
    
    expect(screen.getByPlaceholderText('Search for a repository (e.g., facebook/react)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByTestId('example-repos')).toBeInTheDocument();
  });

  it('shows help text after delay', async () => {
    renderWithProviders(<RepoNotFound />);
    
    await waitFor(() => {
      expect(screen.getByText('Try searching for the repository above, or explore some other examples.')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('has proper accessibility attributes', () => {
    renderWithProviders(<RepoNotFound />);
    
    const terminalRegion = screen.getByRole('region', { name: 'Repository Not Found Terminal' });
    expect(terminalRegion).toBeInTheDocument();
    expect(terminalRegion).toHaveAttribute('tabIndex', '0');
  });

  it('renders core 404 elements', () => {
    renderWithProviders(<RepoNotFound />);
    
    // The component should render key elements without throwing errors
    expect(screen.getByText('fatal: repository not found')).toBeInTheDocument();
    expect(screen.getByText('contributor.info - Repository Terminal')).toBeInTheDocument();
  });
});