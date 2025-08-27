import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { OptimizedAvatarSimple } from '../optimized-avatar-simple';

// Mock IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  elements: Set<Element> = new Set();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  // Trigger intersection for testing
  triggerIntersection(isIntersecting: boolean) {
    const entries = Array.from(this.elements).map((element) => ({
      isIntersecting,
      target: element,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    }));
    this.callback(entries, this as any);
  }
}

let mockObserver: MockIntersectionObserver | null = null;

beforeEach(() => {
  global.IntersectionObserver = vi.fn().mockImplementation((callback) => {
    mockObserver = new MockIntersectionObserver(callback);
    return mockObserver;
  }) as any;
});

afterEach(() => {
  mockObserver = null;
});

describe('OptimizedAvatarSimple - Rendering', () => {
  it('renders with basic props', () => {
    render(
      <OptimizedAvatarSimple src="https://example.com/avatar.jpg" alt="John Doe" lazy={false} />
    );

    const img = screen.getByRole('img', { name: 'John Doe' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('renders with custom fallback text', () => {
    render(<OptimizedAvatarSimple alt="John Doe" fallback="JD" lazy={false} />);

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('generates fallback initials from alt text', () => {
    render(<OptimizedAvatarSimple alt="Jane Smith" lazy={false} />);

    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="Test User"
        className="custom-class"
        lazy={false}
      />
    );

    const avatar = container.firstChild as HTMLElement;
    expect(avatar).toHaveClass('custom-class');
  });

  it('applies correct size styles', () => {
    const { container } = render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="Test User"
        size={64}
        lazy={false}
      />
    );

    const avatar = container.firstChild as HTMLElement;
    expect(avatar).toHaveClass('h-16', 'w-16');
    expect(avatar).toHaveStyle({ width: '64px', height: '64px' });
  });
});

describe('OptimizedAvatarSimple - Image Loading', () => {
  it('calls onLoad when image loads successfully', () => {
    const onLoad = vi.fn();

    render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="Test User"
        onLoad={onLoad}
        lazy={false}
      />
    );

    const img = screen.getByRole('img');
    fireEvent.load(img);

    expect(onLoad).toHaveBeenCalledOnce();
  });

  it('calls onError and shows fallback when image fails to load', () => {
    const onError = vi.fn();

    render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="Error User"
        onError={onError}
        lazy={false}
      />
    );

    const img = screen.getByRole('img');
    fireEvent.error(img);

    expect(onError).toHaveBeenCalledOnce();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('shows fallback while image is loading', () => {
    render(
      <OptimizedAvatarSimple src="https://example.com/avatar.jpg" alt="Loading User" lazy={false} />
    );

    // Fallback should be visible initially
    expect(screen.getByText('LU')).toBeInTheDocument();
    expect(screen.getByText('LU')).toHaveClass('opacity-100');
  });

  it('hides fallback after image loads', () => {
    render(
      <OptimizedAvatarSimple src="https://example.com/avatar.jpg" alt="Success User" lazy={false} />
    );

    const img = screen.getByRole('img');
    fireEvent.load(img);

    // Fallback should be hidden after load
    expect(screen.getByText('SU')).toHaveClass('opacity-0');
  });
});

describe('OptimizedAvatarSimple - Lazy Loading', () => {
  it('does not render image initially when lazy is true', () => {
    render(
      <OptimizedAvatarSimple src="https://example.com/avatar.jpg" alt="Lazy User" lazy={true} />
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('LU')).toBeInTheDocument();
  });

  it('renders image immediately when priority is true', () => {
    render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="Priority User"
        lazy={true}
        priority={true}
      />
    );

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('loading', 'eager');
  });

  it('loads image when intersecting viewport', async () => {
    render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="Intersection User"
        lazy={true}
      />
    );

    // Initially no image
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    // Trigger intersection
    mockObserver?.triggerIntersection(true);

    // Image should now be rendered
    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  it('sets correct loading attribute based on priority', () => {
    const { rerender } = render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="Loading Attr User"
        priority={false}
        lazy={false}
      />
    );

    let img = screen.getByRole('img');
    expect(img).toHaveAttribute('loading', 'lazy');

    rerender(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="Loading Attr User"
        priority={true}
        lazy={false}
      />
    );

    img = screen.getByRole('img');
    expect(img).toHaveAttribute('loading', 'eager');
  });
});

describe('OptimizedAvatarSimple - URL Optimization', () => {
  it('optimizes GitHub avatar URLs', () => {
    render(
      <OptimizedAvatarSimple
        src="https://avatars.githubusercontent.com/u/123456"
        alt="GitHub User"
        size={48}
        lazy={false}
      />
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://avatars.githubusercontent.com/u/123456?s=48&v=4');
  });

  it('leaves non-GitHub URLs unchanged', () => {
    render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="External User"
        size={48}
        lazy={false}
      />
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('handles invalid URLs gracefully', () => {
    render(<OptimizedAvatarSimple src="not-a-valid-url" alt="Invalid URL User" lazy={false} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'not-a-valid-url');
  });

  it('handles relative URLs', () => {
    render(<OptimizedAvatarSimple src="/images/avatar.jpg" alt="Relative URL User" lazy={false} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/images/avatar.jpg');
  });
});

describe('OptimizedAvatarSimple - Edge Cases', () => {
  it('handles undefined src gracefully', () => {
    render(<OptimizedAvatarSimple alt="No Source User" lazy={false} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('NS')).toBeInTheDocument();
  });

  it('handles empty alt text', () => {
    render(<OptimizedAvatarSimple src="https://example.com/avatar.jpg" alt="" lazy={false} />);

    // Images with empty alt have role="presentation"
    const img = screen.getByRole('presentation');
    expect(img).toHaveAttribute('alt', '');
  });

  it('handles single character alt text', () => {
    render(<OptimizedAvatarSimple alt="X" lazy={false} />);

    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('handles alt text with special characters', () => {
    render(<OptimizedAvatarSimple alt="John-Paul O'Connor" lazy={false} />);

    expect(screen.getByText('JO')).toBeInTheDocument();
  });

  it('cleans up intersection observer on unmount', () => {
    const { unmount } = render(
      <OptimizedAvatarSimple src="https://example.com/avatar.jpg" alt="Cleanup User" lazy={true} />
    );

    const disconnectSpy = vi.spyOn(mockObserver!, 'unobserve');

    unmount();

    expect(disconnectSpy).toHaveBeenCalled();
  });
});

describe('OptimizedAvatarSimple - Accessibility', () => {
  it('has correct alt text for screen readers', () => {
    render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="Screen Reader User"
        lazy={false}
      />
    );

    const img = screen.getByRole('img', { name: 'Screen Reader User' });
    expect(img).toBeInTheDocument();
  });

  it('maintains aspect ratio to prevent layout shift', () => {
    render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="Aspect Ratio User"
        size={64}
        lazy={false}
      />
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('width', '64');
    expect(img).toHaveAttribute('height', '64');
    expect(img).toHaveClass('aspect-square');
  });

  it('provides explicit dimensions to prevent CLS', () => {
    const { container } = render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="CLS Prevention User"
        size={48}
        lazy={false}
      />
    );

    const avatar = container.firstChild as HTMLElement;
    expect(avatar).toHaveStyle({
      width: '48px',
      height: '48px',
    });
  });
});

describe('OptimizedAvatarSimple - Custom Renderers', () => {
  it('uses custom avatar renderer when provided', () => {
    const customRenderer = vi.fn(({ children }) => (
      <div data-testid="custom-avatar">{children}</div>
    ));

    render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="Custom Renderer User"
        renderAvatar={customRenderer}
        lazy={false}
      />
    );

    expect(screen.getByTestId('custom-avatar')).toBeInTheDocument();
    expect(customRenderer).toHaveBeenCalled();
  });

  it('uses custom image renderer when provided', () => {
    const customImageRenderer = vi.fn(({ src, alt }) => (
      <img data-testid="custom-img" src={src} alt={alt} />
    ));

    render(
      <OptimizedAvatarSimple
        src="https://example.com/avatar.jpg"
        alt="Custom Image User"
        renderImage={customImageRenderer}
        lazy={false}
      />
    );

    expect(screen.getByTestId('custom-img')).toBeInTheDocument();
    expect(customImageRenderer).toHaveBeenCalled();
  });

  it('uses custom fallback renderer when provided', () => {
    const customFallbackRenderer = vi.fn(({ children }) => (
      <span data-testid="custom-fallback">{children}</span>
    ));

    render(
      <OptimizedAvatarSimple
        alt="Custom Fallback User"
        renderFallback={customFallbackRenderer}
        lazy={false}
      />
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(customFallbackRenderer).toHaveBeenCalled();
  });
});
