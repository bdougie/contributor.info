import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '../button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('applies standard classes', () => {
    const { container } = render(<Button>Click me</Button>);
    const button = container.firstChild as HTMLElement;
    expect(button).toHaveClass('inline-flex', 'items-center', 'justify-center');
  });

  // Tests for new functionality
  it('shows loading spinner and disables button when isLoading is true', () => {
    const { container } = render(<Button isLoading>Click me</Button>);
    const button = screen.getByRole('button'); // It might still have text "Click me"

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    // Check for spinner
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    // Check for sr-only text
    expect(screen.getByText('Loading')).toHaveClass('sr-only');
  });

  it('does not show spinner when isLoading is false', () => {
    const { container } = render(<Button isLoading={false}>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });

    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('disables button in asChild mode when isLoading is true', () => {
    const { container } = render(
      <Button asChild isLoading>
        <a href="#">Link Button</a>
      </Button>
    );
    const link = container.querySelector('a');

    // Note: Spinner is not shown in asChild mode due to Slot limitations (single child requirement)
    // Loading state is indicated through disabled attribute only
    expect(link).toHaveAttribute('disabled');
    expect(link).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
  });
});
