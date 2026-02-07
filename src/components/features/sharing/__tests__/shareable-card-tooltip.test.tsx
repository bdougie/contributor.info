import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareableCard } from '../shareable-card';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock Tooltip components to be synchronous and easily testable
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('ShareableCard Tooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders buttons with tooltip content and without title attribute', () => {
    render(
      <TooltipProvider>
        <ShareableCard title="Test Chart" className="w-[500px] h-[300px]">
          <div>Chart Content</div>
        </ShareableCard>
      </TooltipProvider>
    );

    // Hover over the card to show buttons (buttons are hidden until hover via CSS)
    // We can simulate this by finding the buttons which are in the DOM but maybe hidden
    // However, our mock doesn't handle CSS hover, so they should be in the DOM.
    // But ShareableCard uses state for `isHovered`.

    // We need to trigger mouse enter on the card
    const card = screen.getByText('Chart Content').closest('div[data-shareable-card="true"]');
    if (card) {
      fireEvent.mouseEnter(card);
    }

    // Now buttons should be rendered
    const copyButton = screen.getByRole('button', { name: /Copy chart as image/i });
    expect(copyButton).toBeInTheDocument();

    // Check it does NOT have the title attribute anymore
    expect(copyButton).not.toHaveAttribute('title');

    // Verify tooltip content is present (due to our mock rendering it always)
    expect(screen.getByText('Copy chart as image')).toBeInTheDocument();
    expect(screen.getByText('Download chart')).toBeInTheDocument();
    expect(screen.getByText('Share chart')).toBeInTheDocument();
  });
});
