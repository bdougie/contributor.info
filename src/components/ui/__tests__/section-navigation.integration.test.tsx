import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionNavigation } from '../section-navigation';
import { Tabs } from '../tabs';

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
const items = [
  { value: 'activity', label: 'Activity' },
  { value: 'health', label: 'Health', badge: 0 },
  { value: 'distribution', label: 'Distribution', disabled: true },
  { value: 'feed', label: 'Feed' },
];
afterEach(() => {
  cleanup();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Navigation({
  value = 'activity',
  onChange = vi.fn(),
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <SectionNavigation
        label="Repository section"
        items={items}
        value={value}
        onValueChange={onChange}
      />
    </Tabs>
  );
}

describe('Shared section navigation', () => {
  it('preserves disabled items and zero counts in the picker', () => {
    render(<Navigation />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(screen.getByRole('option', { name: 'Distribution' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('option', { name: 'Health (0)' })).toBeInTheDocument();
  });
  it('reflects route-driven changes without firing a navigation callback', () => {
    const onChange = vi.fn();
    const view = render(<Navigation onChange={onChange} />);
    view.rerender(<Navigation value="feed" onChange={onChange} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Feed');
    expect(onChange).not.toHaveBeenCalled();
  });
  it('retains a working picker without ResizeObserver and upgrades on window resize', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<Navigation />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      return { width: this.classList.contains('w-max') ? 400 : 800 } as DOMRect;
    });
    act(() => {
      fireEvent(window, new Event('resize'));
    });
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Distribution' })).toBeDisabled();
  });
});
