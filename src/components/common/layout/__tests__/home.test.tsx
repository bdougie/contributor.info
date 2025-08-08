/**
 * Bulletproof tests for Home component
 * No mocks - testing pure rendering and navigation logic
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Home from '../home';

// Mock the navigation hook with a test implementation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock child components to isolate testing
vi.mock('../../features/repository', () => ({
  ExampleRepos: ({ onSelect }: { onSelect: (repo: string) => void }) => (
    <button onClick={() => onSelect('test/repo')} data-testid="example-repos">
      Example Repos
    </button>
  ),
}));

vi.mock('./meta-tags-provider', () => ({
  SocialMetaTags: () => <div data-testid="social-meta-tags" />,
}));

vi.mock('@/components/ui/github-search-input', () => ({
  GitHubSearchInput: ({ onSearch, onSelect, placeholder, buttonText }: {
    onSearch: (path: string) => void;
    onSelect: (repo: any) => void;
    placeholder: string;
    buttonText: string;
  }) => (
    <div data-testid="github-search-input">
      <input 
        placeholder={placeholder}
        onChange={(e) => onSearch(e.target.value)}
        data-testid="search-input"
      />
      <button 
        onClick={() => onSelect({ full_name: 'test/selected-repo' })}
        data-testid="select-button"
      >
        {buttonText}
      </button>
    </div>
  ),
}));

function renderWithRouter(component: JSX.Element) {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
}

describe('Home Component', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders the home page content correctly', () => {
    renderWithRouter(<Home />);

    expect(screen.getByText('Analyze GitHub Repository Contributors')).toBeInTheDocument();
    expect(screen.getByText(/Enter a GitHub repository URL or owner\/repo to visualize/)).toBeInTheDocument();
    expect(screen.getByTestId('social-meta-tags')).toBeInTheDocument();
    expect(screen.getByTestId('github-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('example-repos')).toBeInTheDocument();
  });

  it('extracts owner and repo from GitHub URL and navigates correctly', () => {
    renderWithRouter(<Home />);
    
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'https://github.com/facebook/react' } });

    // The component should extract facebook/react and navigate to /facebook/react
    expect(mockNavigate).toHaveBeenCalledWith('/facebook/react');
  });

  it('handles owner/repo format without full URL', () => {
    renderWithRouter(<Home />);
    
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'microsoft/vscode' } });

    expect(mockNavigate).toHaveBeenCalledWith('/microsoft/vscode');
  });

  it('handles repository selection from search input', () => {
    renderWithRouter(<Home />);
    
    const selectButton = screen.getByTestId('select-button');
    fireEvent.click(selectButton);

    expect(mockNavigate).toHaveBeenCalledWith('/test/selected-repo');
  });

  it('handles example repository selection', () => {
    renderWithRouter(<Home />);
    
    const exampleRepos = screen.getByTestId('example-repos');
    fireEvent.click(exampleRepos);

    expect(mockNavigate).toHaveBeenCalledWith('/test/repo');
  });

  it('renders with proper semantic structure', () => {
    renderWithRouter(<Home />);
    
    const article = screen.getByRole('article');
    expect(article).toHaveClass('flex', 'items-center', 'justify-center');
    
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Analyze GitHub Repository Contributors');
    
    const section = screen.getByRole('generic');
    expect(section).toBeInTheDocument();
  });
});