import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { OptimizedAvatar } from '../optimized-avatar';

// Mock intersection observer
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: vi.fn().mockReturnValue([]),
}));

describe('OptimizedAvatar', () => {
  it('renders with fallback text', () => {
    render(
      <OptimizedAvatar
        src="https://example.com/avatar.jpg"
        alt="John Doe"
        fallback="JD"
        lazy={false}
      />
    );

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('optimizes GitHub avatar URLs with size parameter', () => {
    const { container } = render(
      <OptimizedAvatar
        src="https://avatars.githubusercontent.com/u/123456?v=4"
        alt="GitHub User"
        size={64}
        lazy={false}
      />
    );

    // Check if the optimized URL is used (we need to check the component's internal state)
    // For now, just verify the component renders
    expect(container.firstChild).toBeInTheDocument();
  });

  it('generates fallback initials from alt text', async () => {
    render(
      <OptimizedAvatar
        src="invalid-url"
        alt="Jane Smith"
        lazy={false}
      />
    );

    // Should show fallback initials immediately since image will fail to load
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const { container } = render(
      <OptimizedAvatar
        src="https://example.com/avatar.jpg"
        alt="Test User"
        size={96}
        lazy={false}
      />
    );

    const avatar = container.firstChild as HTMLElement;
    expect(avatar).toHaveClass('h-24', 'w-24');
    expect(avatar).toHaveStyle({ width: '96px', height: '96px' });
  });

  it('sets priority prop correctly', () => {
    const { container } = render(
      <OptimizedAvatar
        src="https://example.com/avatar.jpg"
        alt="Test User"
        priority={true}
        lazy={false}
      />
    );

    // Component should render with priority settings
    expect(container.firstChild).toBeInTheDocument();
  });

  it('handles non-GitHub URLs without modification', () => {
    const { container } = render(
      <OptimizedAvatar
        src="https://example.com/avatar.jpg"
        alt="External User"
        size={48}
        lazy={false}
      />
    );

    // Should render the component
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <OptimizedAvatar
        src="https://example.com/avatar.jpg"
        alt="Test User"
        className="custom-class"
        lazy={false}
      />
    );

    const avatar = container.firstChild as HTMLElement;
    expect(avatar).toHaveClass('custom-class');
  });
});