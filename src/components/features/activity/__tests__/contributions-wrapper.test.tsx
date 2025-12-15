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
  it('renders correctly with shareable card containing header and content', async () => {
    render(
      <MemoryRouter initialEntries={['/owner/repo']}>
        <Routes>
          <Route path="/:owner/:repo" element={<ContributionsWrapper />} />
        </Routes>
      </MemoryRouter>
    );

    // Check if ShareableCard is rendered
    const shareableCard = screen.getByTestId('shareable-card');
    expect(shareableCard).toBeInTheDocument();
    expect(shareableCard).toHaveAttribute('title', 'Contributor Distribution');

    // Check if header content is INSIDE the shareable card
    const titleElement = screen.getByText('Contributor Distribution');
    expect(shareableCard).toContainElement(titleElement);

    const descElement = screen.getByText(/This chart is a representation/);
    expect(shareableCard).toContainElement(descElement);

    // In test environment, ContributionsWrapper uses an internal mock
    await waitFor(() => {
        expect(screen.getByTestId('mock-contributions-chart')).toBeInTheDocument();
    });

    // Check if chart is also inside shareable card
    const chart = screen.getByTestId('mock-contributions-chart');
    expect(shareableCard).toContainElement(chart);
  });
});
