import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkspacePreviewCard } from '../WorkspacePreviewCard';
import type { WorkspacePreviewData } from '../WorkspacePreviewCard';
import React from 'react';

// Mock react-router
vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('WorkspacePreviewCard', () => {
  const mockWorkspace: WorkspacePreviewData = {
    id: 'ws-1',
    name: 'My Workspace',
    slug: 'my-workspace',
    description: 'A test workspace',
    owner: {
      id: 'owner-1',
      avatar_url: 'https://example.com/avatar.png',
      display_name: 'Test Owner',
    },
    repository_count: 5,
    member_count: 2,
    created_at: new Date().toISOString(),
    repositories: [
      {
        id: 'repo-1',
        full_name: 'owner/repo-1',
        name: 'repo-1',
        owner: 'owner',
        html_url: 'https://github.com/owner/repo-1',
        activity_score: 85,
        last_activity: new Date().toISOString(),
      },
    ],
  };

  it('should render repository with accessible external link', () => {
    render(<WorkspacePreviewCard workspace={mockWorkspace} />);

    const link = screen.getByLabelText('View repo-1 on GitHub');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/owner/repo-1');
    expect(link).toHaveAttribute('title', 'View on GitHub');
  });
});
