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
    // @ts-expect-error - isLoading prop to be added
    const { container } = render(<Button isLoading>Click me</Button>);
    const button = screen.getByRole('button'); // It might still have text "Click me"

    expect(button).toBeDisabled();
    // Check for spinner
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('does not show spinner when isLoading is false', () => {
    // @ts-expect-error - isLoading prop to be added
    const { container } = render(<Button isLoading={false}>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });

    expect(button).not.toBeDisabled();
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
  });
});
