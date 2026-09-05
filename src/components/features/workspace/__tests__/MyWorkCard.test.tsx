import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { MyWorkCard } from '../MyWorkCard';

afterEach(cleanup);

describe('My Work scope', () => {
  it('explains the personal queue and links to repository activity', () => {
    render(
      <MemoryRouter>
        <MyWorkCard
          items={[]}
          activityUrls={{
            prs: '/i/open-source-repos/prs',
            issues: '/i/open-source-repos/issues',
          }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('No items in this personal queue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All pull requests' })).toHaveAttribute(
      'href',
      '/i/open-source-repos/prs'
    );
    expect(screen.getByRole('link', { name: 'All issues' })).toHaveAttribute(
      'href',
      '/i/open-source-repos/issues'
    );
  });

  it('does not present a failed query as an empty queue', () => {
    render(<MyWorkCard items={[]} error="Could not load work items" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load work items');
    expect(screen.queryByText('No items in this personal queue')).not.toBeInTheDocument();
  });
});
