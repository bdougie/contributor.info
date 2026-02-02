import { render, screen } from '@testing-library/react';
import { WorkspaceIssuesTable, type Issue } from '../WorkspaceIssuesTable';
import { vi, describe, it, expect } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock useWorkspaceFiltersStore
vi.mock('@/lib/workspace-filters-store', () => ({
  useWorkspaceFiltersStore: () => ({
    issueStates: ['open', 'closed'],
    issueIncludeBots: true,
    issueAssignmentFilter: 'all',
    toggleIssueState: vi.fn(),
    setIssueIncludeBots: vi.fn(),
    setIssueAssignmentFilter: vi.fn(),
    resetIssueFilters: vi.fn(),
  }),
}));

// Mock useSimilarIssues
vi.mock('@/hooks/useSimilarIssues', () => ({
  useSimilarIssues: () => ({
    similarIssues: [],
    loading: false,
  }),
}));

// Mock supabase-lazy
vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: () =>
    Promise.resolve({
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  setSupabaseInstance: vi.fn(),
}));

// Mock bot detection
vi.mock('@/lib/utils/bot-detection', () => ({
  isBot: () => false,
  hasBotAuthors: () => false,
}));

describe('WorkspaceIssuesTable', () => {
  const mockIssue: Issue = {
    id: '1',
    number: 101,
    title: 'Test Issue',
    state: 'open',
    repository: { name: 'repo', owner: 'owner', avatar_url: '' },
    author: { username: 'user', avatar_url: '' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    comments_count: 0,
    labels: [],
    linked_pull_requests: [
      { number: 201, url: 'http://pr/201', state: 'merged' },
      { number: 202, url: 'http://pr/202', state: 'open' },
      { number: 203, url: 'http://pr/203', state: 'closed' },
    ],
    url: 'http://issue/101',
  };

  it('renders linked PRs with tooltips and correct aria-labels', () => {
    render(
      <TooltipProvider>
        <WorkspaceIssuesTable issues={[mockIssue]} />
      </TooltipProvider>
    );

    // Check visible PRs (slice(0, 2))
    const pr201 = screen.getByText('#201');
    expect(pr201).toBeInTheDocument();

    // Check aria-label
    const link201 = pr201.closest('a');
    expect(link201).toHaveAttribute('aria-label', 'Pull request #201 (merged)');

    // Check color class based on state
    expect(link201).toHaveClass('text-purple-600');

    const pr202 = screen.getByText('#202');
    expect(pr202).toBeInTheDocument();
    const link202 = pr202.closest('a');
    expect(link202).toHaveAttribute('aria-label', 'Pull request #202 (open)');
    expect(link202).toHaveClass('text-green-600');

    // Check overflow
    const overflow = screen.getByText('+1');
    expect(overflow).toBeInTheDocument();
  });

  it('renders action buttons with correct aria-labels', () => {
    const onRespondClick = vi.fn();
    render(
      <TooltipProvider>
        <WorkspaceIssuesTable issues={[mockIssue]} onRespondClick={onRespondClick} />
      </TooltipProvider>
    );

    // Check "Open issue in GitHub" link
    const externalLinks = screen.getAllByLabelText('Open issue in GitHub');
    expect(externalLinks.length).toBeGreaterThan(0);
    expect(externalLinks[0]).toHaveAttribute('href', 'http://issue/101');

    // Check "Mark as responded" button
    const respondButton = screen.getByLabelText('Mark as responded');
    expect(respondButton).toBeInTheDocument();
  });
});
