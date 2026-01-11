import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { Kbd } from './kbd';

describe('Kbd', () => {
  it('renders with default props', () => {
    const { container } = render(<Kbd>⌘K</Kbd>);
    const kbdElement = container.querySelector('kbd');

    expect(kbdElement).toBeInTheDocument();
    expect(kbdElement?.textContent).toBe('⌘K');
  });

  it('applies default styling', () => {
    const { container } = render(<Kbd>Ctrl</Kbd>);
    const kbdElement = container.querySelector('kbd');

    expect(kbdElement).toHaveClass(
      'pointer-events-none',
      'inline-flex',
      'h-5',
      'select-none',
      'items-center',
      'gap-1',
      'rounded',
      'border',
      'bg-muted',
      'px-1.5',
      'font-mono',
      'text-muted-foreground'
    );
  });

  it('accepts custom className', () => {
    const { container } = render(<Kbd className="custom-class">⌘</Kbd>);
    const kbdElement = container.querySelector('kbd');

    expect(kbdElement).toHaveClass('custom-class');
    // Should still have default classes
    expect(kbdElement).toHaveClass('rounded', 'bg-muted');
  });

  it('renders children correctly', () => {
    const { container } = render(<Kbd>↑↓</Kbd>);
    const kbdElement = container.querySelector('kbd');

    expect(kbdElement?.textContent).toBe('↑↓');
  });

  it('supports aria attributes', () => {
    const { container } = render(<Kbd aria-label="Command key">⌘</Kbd>);
    const kbdElement = container.querySelector('kbd');

    expect(kbdElement).toHaveAttribute('aria-label', 'Command key');
  });

  it('forwards ref correctly', () => {
    const ref = createRef<HTMLElement>();
    render(<Kbd ref={ref}>Test</Kbd>);

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current?.textContent).toBe('Test');
  });

  it('renders as semantic kbd element', () => {
    const { container } = render(<Kbd>Esc</Kbd>);
    const kbdElement = container.querySelector('kbd');

    expect(kbdElement?.tagName).toBe('KBD');
  });

  it('allows className override for sizing', () => {
    const { container } = render(<Kbd className="h-auto">+</Kbd>);
    const kbdElement = container.querySelector('kbd');

    expect(kbdElement).toHaveClass('h-auto');
    // h-5 from default should still be present but h-auto will override it
    expect(kbdElement).toHaveClass('h-5');
  });

  it('works with multiple children', () => {
    const { container } = render(
      <Kbd>
        <span>Cmd</span>
        <span>+</span>
        <span>K</span>
      </Kbd>
    );
    const kbdElement = container.querySelector('kbd');

    expect(kbdElement?.children).toHaveLength(3);
  });
});
