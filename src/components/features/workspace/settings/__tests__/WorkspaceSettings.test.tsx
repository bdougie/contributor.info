import { WorkspaceService } from '@/services/workspace.service';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderSettings } from './settings-test-support';

vi.mock('@/services/workspace.service', () => ({ WorkspaceService: { updateWorkspace: vi.fn() } }));

describe('Workspace settings edits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cancels both general settings and notification changes without saving', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Draft name' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Email' }));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Workspace name')).toHaveValue('Paper Compute');
    expect(screen.getByRole('switch', { name: 'Email' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(WorkspaceService.updateWorkspace).not.toHaveBeenCalled();
  });

  it('enables saving when only notifications change', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('switch', { name: 'In-app' }));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    expect(screen.getByRole('form', { name: 'Workspace preferences' })).toContainElement(
      screen.getByRole('switch', { name: 'In-app' })
    );
  });

  it('keeps contributor settings read-only and deletion owner-only', () => {
    renderSettings('contributor');
    expect(screen.getByLabelText('Workspace name')).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Email' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'In-app' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete workspace' })).not.toBeInTheDocument();
  });

  it('lets maintainers edit without exposing workspace deletion', () => {
    renderSettings('maintainer');
    expect(screen.getByLabelText('Workspace name')).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Delete workspace' })).not.toBeInTheDocument();
  });

  it('keeps URL confirmation and restores the saved slug when declined', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderSettings();
    fireEvent.change(screen.getByLabelText('Workspace URL'), { target: { value: 'new-url' } });
    expect(screen.getByText(/Changing the URL will break/)).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('form'));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Workspace URL')).toHaveValue('open-source-repos');
    expect(WorkspaceService.updateWorkspace).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('keeps technical details collapsed and deletion outside the preferences form', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: 'Workspace details' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByText('Workspace ID')).not.toBeInTheDocument();
    expect(screen.getByRole('form')).not.toContainElement(
      screen.getByRole('button', { name: 'Delete workspace' })
    );
  });
});
