import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { UserAvatar } from '../user-avatar';

describe('UserAvatar', () => {
  it('renders with basic props', () => {
    render(<UserAvatar src="https://example.com/avatar.jpg" alt="John Doe" />);

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(img).toHaveAttribute('alt', 'John Doe');
  });

  it('optimizes GitHub avatar URLs with size parameter', () => {
    // This test should fail initially, as the optimization is not yet implemented
    render(
      <UserAvatar
        src="https://avatars.githubusercontent.com/u/123456"
        alt="GitHub User"
        size={48}
      />
    );

    const img = screen.getByRole('img');
    // Expect the URL to be optimized with size and version params
    expect(img).toHaveAttribute('src', 'https://avatars.githubusercontent.com/u/123456?s=48&v=4');
  });

  it('leaves non-GitHub URLs untouched', () => {
    render(<UserAvatar src="https://example.com/avatar.jpg" alt="External User" size={48} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });
});
