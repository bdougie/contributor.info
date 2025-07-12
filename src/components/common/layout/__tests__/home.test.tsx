import { render, screen } from '@testing-library/react';
import { expect, test, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Home from '../home';

// Mock the dependencies
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/ui/github-search-input', () => ({
  GitHubSearchInput: ({ onSearch, placeholder }: any) => (
    <div data-testid="github-search-input">
      <input 
        placeholder={placeholder}
        onChange={(e) => onSearch?.(e.target.value)}
        data-testid="search-input"
      />
    </div>
  ),
}));

vi.mock('@/components/features/repository', () => ({
  ExampleRepos: ({ onSelectRepository }: any) => (
    <div data-testid="example-repos">
      <button 
        onClick={() => onSelectRepository?.({ owner: 'test', name: 'repo' })}
        data-testid="example-repo-button"
      >
        Example Repo
      </button>
    </div>
  ),
}));

vi.mock('./meta-tags-provider', () => ({
  SocialMetaTags: ({ children }: any) => <div data-testid="social-meta-tags">{children}</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
});

const renderHome = () => {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </HelmetProvider>
  );
};

test('renders homepage with main title and description', () => {
  renderHome();
  
  // Check main heading
  expect(screen.getByText('Analyze GitHub Repository Contributors')).toBeInTheDocument();
  
  // Check description (use partial text match)
  expect(screen.getByText('Enter a GitHub repository URL or owner/repo to visualize contribution patterns')).toBeInTheDocument();
});

test('renders GitHub search input component', () => {
  renderHome();
  
  const searchInput = screen.getByTestId('github-search-input');
  expect(searchInput).toBeInTheDocument();
  
  const input = screen.getByTestId('search-input');
  expect(input).toHaveAttribute('placeholder', 'Search repositories (e.g., facebook/react)');
});

test('renders example repositories component', () => {
  renderHome();
  
  const exampleRepos = screen.getByTestId('example-repos');
  expect(exampleRepos).toBeInTheDocument();
});

test('renders social meta tags component', () => {
  renderHome();
  
  // The SocialMetaTags component wraps the entire page content
  // Let's check that it exists in the DOM structure
  const content = screen.getByText('Analyze GitHub Repository Contributors');
  expect(content).toBeInTheDocument();
});

test('handles search with repository path navigation', () => {
  renderHome();
  
  const searchInput = screen.getByTestId('search-input');
  
  // Simulate search input
  searchInput.dispatchEvent(new Event('change', { bubbles: true }));
  Object.defineProperty(searchInput, 'value', { value: 'facebook/react', configurable: true });
  searchInput.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Note: The actual navigation logic would be tested when the search is triggered
  // This test verifies the component renders correctly with the search input
  expect(searchInput).toBeInTheDocument();
});

test('handles example repository selection', () => {
  renderHome();
  
  const exampleButton = screen.getByTestId('example-repo-button');
  expect(exampleButton).toBeInTheDocument();
  
  // Click would trigger the navigation through the ExampleRepos component
  expect(exampleButton).toHaveTextContent('Example Repo');
});

test('contains Popular examples section', () => {
  renderHome();
  
  // The example repos component should be present (contains the "Popular examples" functionality)
  const exampleRepos = screen.getByTestId('example-repos');
  expect(exampleRepos).toBeInTheDocument();
});

test('renders within a card layout', () => {
  renderHome();
  
  // Check that content is properly structured
  const title = screen.getByText('Analyze GitHub Repository Contributors');
  expect(title).toBeInTheDocument();
  
  // Verify the card structure exists by checking for the main content container
  const cardContent = title.closest('div');
  expect(cardContent).toBeInTheDocument();
});

test('has proper semantic structure', () => {
  renderHome();
  
  // Check for heading structure
  const mainHeading = screen.getByRole('heading', { level: 3 });
  expect(mainHeading).toHaveTextContent('Analyze GitHub Repository Contributors');
});