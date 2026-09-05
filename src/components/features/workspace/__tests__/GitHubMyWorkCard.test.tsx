import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubMyWorkCard } from '../GitHubMyWorkCard';
import type { GitHubWorkItem } from '@/lib/workspace/github-my-work';

const mocks = vi.hoisted(() => ({ work: vi.fn(), refresh: vi.fn() }));
vi.mock('@/hooks/use-github-workspace-work', () => ({ useGitHubWorkspaceWork: mocks.work }));
vi.mock('@/components/ui/organization-avatar', () => ({
  OrganizationAvatar: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
const items: GitHubWorkItem[] = [
  {
    id: 33,
    number: 33,
    title: 'Raspberry Pi support',
    repository: 'papercomputeco/stereOS',
    type: 'pr',
    url: 'https://github.com/papercomputeco/stereOS/pull/33',
    updatedAt: '2026-05-07T16:42:58Z',
    author: 'yeazelm',
    categories: ['review_requested'],
  },
  {
    id: 341,
    number: 341,
    title: 'Remove transcripts command',
    repository: 'papercomputeco/tapes',
    type: 'pr',
    url: 'https://github.com/papercomputeco/tapes/pull/341',
    updatedAt: '2026-09-03T01:58:55Z',
    author: 'bdougie',
    categories: ['authored'],
  },
];
const state = () => ({
  items,
  signedIn: true,
  loading: false,
  refreshing: false,
  errors: [],
  incomplete: false,
  unavailableRepositories: [],
  hasCachedResults: false,
  refresh: mocks.refresh,
});
const renderCard = () =>
  render(
    <GitHubMyWorkCard
      workspaceId="workspace"
      repositories={['papercomputeco/tapes', 'papercomputeco/stereOS']}
    />
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.work.mockReturnValue(state());
});
afterEach(cleanup);

describe('GitHub My Work', () => {
  it('defaults to Priority with awaiting replies before newer review requests', () => {
    mocks.work.mockReturnValue({
      ...state(),
      items: [
        items[0],
        {
          ...items[1],
          updatedAt: '2025-01-01T00:00:00Z',
          categories: ['authored', 'awaiting_reply', 'review_requested'],
        },
        { ...items[1], id: 400, title: 'Authored only' },
      ],
    });
    renderCard();
    expect(screen.getByRole('button', { name: /^Priority 2/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Remove transcripts command',
      'Raspberry Pi support',
    ]);
    fireEvent.click(screen.getByRole('button', { name: /^All work/ }));
    expect(screen.getByRole('link', { name: 'Authored only' })).toBeInTheDocument();
  });

  it('sorts awaiting replies by the latest conversation rather than parent activity', () => {
    const reply = { author: 'reviewer', body: 'Check this?', kind: 'review' as const };
    mocks.work.mockReturnValue({
      ...state(),
      items: [
        {
          ...items[0],
          categories: ['awaiting_reply'],
          updatedAt: '2026-09-05T00:00:00Z',
          replies: [
            { ...reply, url: `${items[0].url}#discussion_r1`, createdAt: '2026-01-01T00:00:00Z' },
          ],
        },
        {
          ...items[1],
          categories: ['awaiting_reply'],
          updatedAt: '2026-02-01T00:00:00Z',
          replies: [
            { ...reply, url: `${items[1].url}#discussion_r2`, createdAt: '2026-02-01T00:00:00Z' },
          ],
        },
      ],
    });
    renderCard();
    expect(screen.getAllByRole('link')[0]).toHaveTextContent('Remove transcripts command');
  });
  it('shows the repository owner logo with an accessible label and the shared fallback', () => {
    renderCard();
    const logo = screen.getAllByRole('img', { name: 'papercomputeco logo' })[0];
    expect(logo).toHaveAttribute('src');
    expect(logo.getAttribute('src')).not.toContain('avatars.githubusercontent.com');
  });

  it('prefers the workspace repository avatar, matching names case-insensitively', () => {
    render(
      <GitHubMyWorkCard
        workspaceId="workspace"
        repositories={['papercomputeco/tapes']}
        repositoryAvatars={{
          'PaperComputeCo/Tapes': 'https://avatars.githubusercontent.com/u/123',
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^All work/ }));
    expect(screen.getAllByRole('img', { name: 'papercomputeco logo' })[1]).toHaveAttribute(
      'src',
      'https://avatars.githubusercontent.com/u/123'
    );
  });

  it('names repositories GitHub refused to search while showing the rest', () => {
    mocks.work.mockReturnValue({
      ...state(),
      unavailableRepositories: ['papercomputeco/private'],
    });
    renderCard();
    expect(screen.getByRole('status')).toHaveTextContent('papercomputeco/private');
    expect(screen.getByRole('button', { name: /^All work/ })).toHaveTextContent('2');
  });

  it('shows pending comment previews and links separately from the PR', () => {
    const url = `${items[1].url}#discussion_r123`;
    mocks.work.mockReturnValue({
      ...state(),
      items: [
        {
          ...items[1],
          categories: ['authored', 'awaiting_reply'],
          replies: [
            {
              author: 'reviewer',
              body: 'Can you add a regression test?',
              url,
              createdAt: items[1].updatedAt,
              kind: 'review',
            },
          ],
        },
      ],
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /^Awaiting your reply/ }));
    expect(screen.getByText(/Suggested follow-ups/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Can you add a regression test/ })).toHaveAttribute(
      'href',
      url
    );
    expect(screen.getByRole('link', { name: /Remove transcripts/ })).toHaveAttribute(
      'href',
      items[1].url
    );
    expect(screen.getByText('1 conversation to follow up')).toBeInTheDocument();
  });
  it('keeps filters available when a category has no work', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /^Assigned issues/ }));
    expect(screen.getByText('No matching open work in these repositories.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^All work/ }));
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('paginates work without discarding the other items', () => {
    mocks.work.mockReturnValue({
      ...state(),
      items: Array.from({ length: 11 }, (_, i) => ({ ...items[0], id: i, title: `Work ${i}` })),
    });
    renderCard();
    expect(screen.getAllByRole('link')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });
  it('shows authored PRs and team review requests together with real GitHub links', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /^All work/ }));
    expect(screen.getByRole('link', { name: /Raspberry Pi support/ })).toHaveAttribute(
      'href',
      items[0].url
    );
    expect(screen.getByRole('link', { name: /Remove transcripts/ })).toHaveAttribute(
      'href',
      items[1].url
    );
    expect(screen.queryByRole('button', { name: /Respond/ })).not.toBeInTheDocument();
  });

  it('filters authored work without fetching or displaying the review category', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /^Your open PRs/ }));
    expect(screen.queryByRole('link', { name: /Raspberry Pi support/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Remove transcripts/ })).toBeInTheDocument();
  });

  it('preserves successful categories when another API request fails', () => {
    mocks.work.mockReturnValue({ ...state(), errors: ['Assigned issues: GitHub unavailable'] });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /^All work/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Assigned issues: GitHub unavailable');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('shows session errors without inventing a second GitHub connection flow', () => {
    mocks.work.mockReturnValue({
      ...state(),
      items: [],
      errors: ['Your saved sign-in session is missing its GitHub token.'],
    });
    renderCard();
    expect(screen.queryByRole('button', { name: 'Connect GitHub' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('missing its GitHub token');
    expect(
      screen.queryByText('No matching open work in these repositories.')
    ).not.toBeInTheDocument();
  });

  it('refreshes from the header', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
