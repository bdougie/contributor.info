import { WorkspaceService } from '@/services/workspace.service';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderSettings, workspace } from './settings-test-support';

vi.mock('@/services/workspace.service', () => ({ WorkspaceService: { updateWorkspace: vi.fn() } }));

const navigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

describe('Workspace settings save lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('saves notifications with general fields, preserves other settings, and resets dirty state', async () => {
    const updated = {
      ...workspace,
      name: 'Updated name',
      settings: {
        ...workspace.settings,
        notifications: { email: false, in_app: false },
      },
    };
    vi.mocked(WorkspaceService.updateWorkspace).mockResolvedValue({ success: true, data: updated });
    renderSettings();
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: updated.name } });
    fireEvent.click(screen.getByRole('switch', { name: 'Email' }));
    await act(async () => fireEvent.submit(screen.getByRole('form')));
    expect(WorkspaceService.updateWorkspace).toHaveBeenCalledWith(workspace.id, 'owner-one', {
      name: updated.name,
      slug: workspace.slug,
      description: workspace.description,
      visibility: workspace.visibility,
      settings: updated.settings,
    });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Workspace name'), {
      target: { value: 'Another edit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Workspace name')).toHaveValue(updated.name);
    expect(screen.getByRole('switch', { name: 'Email' })).not.toBeChecked();
  });

  it('sends an explicit null so a cleared description is persisted', async () => {
    vi.mocked(WorkspaceService.updateWorkspace).mockResolvedValue({
      success: true,
      data: { ...workspace, description: null },
    });
    renderSettings();
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: '' } });
    await act(async () => fireEvent.submit(screen.getByRole('form')));
    expect(WorkspaceService.updateWorkspace).toHaveBeenCalledWith(
      workspace.id,
      'owner-one',
      expect.objectContaining({ description: null })
    );
    expect(screen.getByLabelText(/Description/)).toHaveValue('');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('moves to the new URL after a confirmed slug change so the page refetches by it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(WorkspaceService.updateWorkspace).mockResolvedValue({
      success: true,
      data: { ...workspace, slug: 'new-url' },
    });
    renderSettings();
    fireEvent.change(screen.getByLabelText('Workspace URL'), { target: { value: 'new-url' } });
    await act(async () => fireEvent.submit(screen.getByRole('form')));
    expect(navigate).toHaveBeenCalledWith('/i/new-url/settings', { replace: true });
    expect(screen.getByLabelText('Workspace URL')).toHaveValue('new-url');
  });

  it('retains edits after a failed save so the user can retry or cancel', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(WorkspaceService.updateWorkspace).mockResolvedValue({
      success: false,
      error: 'Denied',
    });
    renderSettings();
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Draft' } });
    await act(async () => fireEvent.submit(screen.getByRole('form')));
    expect(screen.getByLabelText('Workspace name')).toHaveValue('Draft');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Workspace name')).toHaveValue(workspace.name);
  });

  it('disables editing and duplicate submissions while a save is pending', async () => {
    let finish!: (value: Awaited<ReturnType<typeof WorkspaceService.updateWorkspace>>) => void;
    vi.mocked(WorkspaceService.updateWorkspace).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    renderSettings();
    fireEvent.click(screen.getByRole('switch', { name: 'Email' }));
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Email' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form'));
    expect(WorkspaceService.updateWorkspace).toHaveBeenCalledOnce();
    await act(async () => finish({ success: true, data: workspace }));
  });
});
