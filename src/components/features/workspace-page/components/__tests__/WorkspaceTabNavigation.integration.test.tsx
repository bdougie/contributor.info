import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { WorkspaceTabNavigation } from '../WorkspaceTabNavigation';

let available = 600;
let updateSize: () => void;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

beforeEach(() => {
  available = 600;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    return new DOMRect(0, 0, this.classList.contains('w-max') ? 850 : available, 44);
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: () => void) {}
      observe(element: Element) {
        if (element.classList.contains('min-w-0')) updateSize = this.callback;
      }
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Navigation({ onChange = vi.fn() }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('overview');
  const change = (next: string) => {
    setValue(next);
    onChange(next);
  };
  return (
    <Tabs value={value} onValueChange={change}>
      <WorkspaceTabNavigation value={value} onValueChange={change} />
      <TabsContent value="overview">Workspace overview</TabsContent>
      <TabsContent value="settings">Workspace settings</TabsContent>
    </Tabs>
  );
}

describe('Workspace section navigation', () => {
  it('uses themed options without a selectable placeholder row', () => {
    render(<Navigation />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveClass('focus:ring-0', 'focus-visible:ring-foreground/30');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.queryByRole('option', { name: 'Select a section' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Overview' })).toHaveAttribute(
      'data-state',
      'checked'
    );
    expect(screen.getByRole('option', { name: 'Issues' })).toHaveClass(
      'data-[highlighted]:bg-muted'
    );
  });

  it('closes the portaled menu when resizing to the tab row', async () => {
    render(<Navigation />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    act(() => screen.getByRole('option', { name: 'Overview' }).focus());
    act(() => {
      available = 1000;
      updateSize();
    });
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus());
  });

  it('replaces overflowing tabs with a labeled section picker containing every section', () => {
    render(<Navigation />);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Workspace section' })).toHaveTextContent(
      'Overview'
    );
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    for (const name of [
      'Overview',
      'PRs',
      'Issues',
      'Discussions',
      'Spam',
      'Contributors',
      'Activity',
      'Settings',
    ]) {
      expect(screen.getByRole('option', { name })).toBeInTheDocument();
    }
  });

  it('selects Settings through the same controlled tab callback', () => {
    const onChange = vi.fn();
    render(<Navigation onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Settings' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('settings');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Workspace settings');
  });

  it('shows only one accessible tab row when all labels fit', () => {
    available = 1000;
    render(<Navigation />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Workspace sections' })).toBeVisible();
    expect(screen.getAllByRole('tab')).toHaveLength(8);
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeVisible();
  });

  it('preserves Radix keyboard navigation on the single row', async () => {
    available = 1000;
    render(<Navigation />);
    const overview = screen.getByRole('tab', { name: 'Overview' });
    act(() => overview.focus());
    fireEvent.keyDown(overview, { key: 'End' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Settings' })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Settings' }), { key: 'Home' });
    await waitFor(() => expect(overview).toHaveFocus());
  });

  it('preserves selection and focus when resizing between modes', () => {
    render(<Navigation />);
    const picker = screen.getByRole('combobox');
    fireEvent.keyDown(picker, { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Settings' }));
    act(() => picker.focus());
    act(() => {
      available = 1000;
      updateSize();
    });
    expect(screen.getByRole('tab', { name: 'Settings' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Workspace settings');
    act(() => {
      available = 400;
      updateSize();
    });
    expect(screen.getByRole('combobox')).toHaveFocus();
    expect(screen.getByRole('combobox')).toHaveTextContent('Settings');
  });
});
