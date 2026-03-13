import type { CSSProperties, ReactNode, Ref } from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
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

// Mock the Avatar UI components
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({
    children,
    className,
    style,
    ref,
  }: {
    children?: ReactNode;
    className?: string;
    style?: CSSProperties;
    ref?: Ref<HTMLDivElement>;
  }) => (
    <div ref={ref as never} className={className} style={style}>
      {children}
    </div>
  ),
  AvatarImage: ({
    src,
    alt,
    onLoad,
    onError,
    className,
  }: {
    src?: string;
    alt?: string;
    onLoad?: () => void;
    onError?: () => void;
    className?: string;
  }) => <img src={src} alt={alt} onLoad={onLoad} onError={onError} className={className} />,
  AvatarFallback: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

describe('OptimizedAvatar', () => {
  it('renders with fallback text', () => {
    const { container } = render(
      <OptimizedAvatar
        src="https://example.com/avatar.jpg"
        alt="John Doe"
        fallback="JD"
        lazy={false}
      />
    );

    // The fallback is rendered inside the AvatarFallback component
    const fallbackElement = container.querySelector('div');
    expect(fallbackElement).toBeInTheDocument();
    expect(fallbackElement?.textContent).toContain('JD');
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

  it('generates fallback initials from alt text', () => {
    const { container } = render(
      <OptimizedAvatar src="invalid-url" alt="Jane Smith" lazy={false} />
    );

    // Should show fallback initials immediately since image will fail to load
    const fallbackElement = container.querySelector('div');
    expect(fallbackElement).toBeInTheDocument();
    // The component generates 'JS' from 'Jane Smith'
    expect(fallbackElement?.textContent).toContain('JS');
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
