import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { WorkspaceTabNavigation } from '../WorkspaceTabNavigation';

afterEach(cleanup);

function renderNavigation(onValueChange = vi.fn()) {
  render(
    <Tabs defaultValue="overview" onValueChange={onValueChange}>
      <WorkspaceTabNavigation />
      <TabsContent value="overview">Workspace overview</TabsContent>
      <TabsContent value="settings">Workspace settings</TabsContent>
    </Tabs>
  );
}

describe('Workspace section navigation', () => {
  it('keeps every tab named without hiding mobile labels', () => {
    renderNavigation();
    expect(screen.getByRole('tablist', { name: 'Workspace sections' })).toBeInTheDocument();
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
      const tab = screen.getByRole('tab', { name });
      expect(tab).toBeVisible();
      expect(tab.querySelector('span')).not.toHaveClass('hidden');
      expect(tab).toHaveClass('min-w-0', 'min-h-11');
    }
  });

  it('uses an auto-height grid instead of an overflowing tablet flex row', () => {
    renderNavigation();
    const list = screen.getByRole('tablist');
    expect(list).toHaveClass('h-auto', 'grid-cols-2', 'sm:grid-cols-4', 'xl:grid-cols-8');
    expect(list).not.toHaveClass('sm:flex', 'h-9', 'grid-rows-2');
  });

  it('keeps Settings selectable at the end of the grid', () => {
    const onValueChange = vi.fn();
    renderNavigation(onValueChange);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Settings' }), {
      button: 0,
      ctrlKey: false,
    });
    expect(onValueChange).toHaveBeenCalledWith('settings');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Workspace settings');
  });

  it('preserves Radix keyboard navigation across the wrapped tabs', async () => {
    renderNavigation();
    const overview = screen.getByRole('tab', { name: 'Overview' });
    act(() => overview.focus());
    fireEvent.keyDown(overview, { key: 'End' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Settings' })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Settings' }), { key: 'Home' });
    await waitFor(() => expect(overview).toHaveFocus());
  });
});
