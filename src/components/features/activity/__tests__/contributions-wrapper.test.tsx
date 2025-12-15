import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import ContributionsWrapper from '../contributions-wrapper';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock ShareableCard
vi.mock('@/components/features/sharing/shareable-card', () => ({
  ShareableCard: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="shareable-card" title={title}>
      {children}
    </div>
  ),
}));

describe('ContributionsWrapper', () => {
  it('renders correctly with shareable card', async () => {
    render(
      <MemoryRouter initialEntries={['/owner/repo']}>
        <Routes>
          <Route path="/:owner/:repo" element={<ContributionsWrapper />} />
        </Routes>
      </MemoryRouter>
    );

    // Check if card title is rendered
    expect(screen.getByText('Contributor Distribution')).toBeInTheDocument();

    // Check if ShareableCard is rendered
    const shareableCard = screen.getByTestId('shareable-card');
    expect(shareableCard).toBeInTheDocument();
    expect(shareableCard).toHaveAttribute('title', 'Contributor Distribution');

    // In test environment, ContributionsWrapper uses an internal mock
    await waitFor(() => {
        expect(screen.getByTestId('mock-contributions-chart')).toBeInTheDocument();
    });
  });
});
