import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { WorkspaceSkeleton } from '../workspace-skeleton';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WorkspaceSkeleton />
    </MemoryRouter>
  );
}

describe('WorkspaceSkeleton', () => {
  it('renders the workspace slug from the URL as the heading', () => {
    renderAt('/i/my-team');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('my-team');
  });

  it('resolves the slug for the /workspaces/:slug alias', () => {
    renderAt('/workspaces/my-team/prs');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('my-team');
  });

  it('exposes loading state to assistive technology like the other skeletons', () => {
    renderAt('/i/my-team');
    const container = screen.getByRole('status');
    expect(container).toHaveAttribute('aria-label', 'Loading workspace...');
    expect(container).toHaveAttribute('aria-busy', 'true');
    expect(container).toHaveClass('skeleton-container');
    expect(screen.getByText('Loading workspace, please wait...')).toHaveClass('sr-only');
  });

  it('renders the four always-visible metric cards', () => {
    renderAt('/i/my-team');
    for (const title of ['Star Velocity', 'Open PRs', 'Open Issues', 'Contributors']) {
      expect(document.querySelector(`[aria-label="Loading ${title}"]`)).toBeInTheDocument();
    }
  });

  it('renders the workspace tab labels so the tab row measures like the real one', () => {
    renderAt('/i/my-team');
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.getByText('Discussions')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders the workspaces list layout when no slug is present', () => {
    renderAt('/workspaces');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your Workspaces');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('applies a custom className', () => {
    render(
      <MemoryRouter initialEntries={['/i/my-team']}>
        <WorkspaceSkeleton className="test-class" />
      </MemoryRouter>
    );
    expect(document.querySelector('.test-class')).toBeInTheDocument();
  });
});
