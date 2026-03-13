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

// Mock the lazy-loaded contributions chart synchronously
vi.mock('../contributions', () => ({
  default: () => (
    <div
      data-testid="mock-contributions-chart"
      className="h-[400px] w-full flex items-center justify-center"
    >
      <span>Mock Contributions Chart</span>
    </div>
  ),
}));

// Mock React.lazy to render synchronously in tests
vi.mock('react', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const actual = require('react');
  return {
    ...actual,
    lazy: (factory: () => Promise<{ default: React.ComponentType }>) => {
      let Component: React.ComponentType | undefined;
      factory().then((mod: { default: React.ComponentType }) => {
        Component = mod.default;
      });
      // The promise resolves synchronously in vitest with vi.mock
      return (props: Record<string, unknown>) => {
        if (!Component) return null;
        return actual.createElement(Component, props);
      };
    },
  };
});

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

    // Chart renders synchronously via mocked lazy
    const chart = screen.getByTestId('mock-contributions-chart');
    expect(chart).toBeInTheDocument();

    // Check if chart is also inside shareable card
    expect(shareableCard).toContainElement(chart);
  });
});
