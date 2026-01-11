import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import ContributionsWrapper from '../contributions-wrapper';
import { MemoryRouter, Routes, Route } from 'react-router';

// Mock ShareableCard
vi.mock('@/components/features/sharing/shareable-card', () => ({
  ShareableCard: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="shareable-card" title={title}>
      {children}
    </div>
  ),
}));

describe('ContributionsWrapper', () => {
  it('renders correctly with shareable card containing header and content', () => {
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
  });
});
