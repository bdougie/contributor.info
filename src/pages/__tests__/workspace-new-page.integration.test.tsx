import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import WorkspaceNewPage from '../workspace-new-page';
import { readWorkspaceDraft } from '@/lib/utils/workspace-onboarding';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createWorkspace: vi.fn(),
  getAppUserId: vi.fn(),
}));
vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: () =>
    Promise.resolve({
      auth: { getUser: mocks.getUser },
      from: () => ({ select: () => ({ eq: () => Promise.resolve({ count: 1 }) }) }),
    }),
}));
vi.mock('@/lib/auth-helpers', () => ({ getAppUserId: mocks.getAppUserId }));
vi.mock('@/services/workspace.service', () => ({
  WorkspaceService: { createWorkspace: mocks.createWorkspace },
}));
vi.mock('@/lib/posthog-lazy', () => ({ trackEvent: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const entry = '/workspaces/new?repository=papercomputeco%2Ftapes';
function Destination() {
  const location = useLocation();
  return <output data-testid="destination">{location.pathname + location.search}</output>;
}
function renderPage() {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/workspaces/new" element={<WorkspaceNewPage />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>
  );
}
function fillDraft() {
  fireEvent.change(screen.getByLabelText(/Workspace Name/), {
    target: { value: 'Tapes and PCC Labs' },
  });
  fireEvent.change(screen.getByLabelText(/Description/), {
    target: { value: 'Related open source repos' },
  });
}

describe('workspace creation authentication and continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-user' } } });
    mocks.getAppUserId.mockResolvedValue('app-user');
    mocks.createWorkspace.mockResolvedValue({
      success: true,
      data: { id: 'workspace-id', slug: 'tapes' },
    });
  });

  it('waits for authentication before enabling workspace creation', async () => {
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
    expect(screen.getByLabelText(/Workspace Name/)).toBeDisabled();
    await waitFor(() => expect(screen.getByLabelText(/Workspace Name/)).toBeEnabled());
    fillDraft();
    expect(screen.getByRole('button', { name: 'Create Workspace' })).toBeEnabled();
  });

  it('restores a signed-out draft after returning from sign-in and resumes adding Tapes', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const first = renderPage();
    await screen.findByRole('button', { name: 'Sign in to continue' });
    fillDraft();
    expect(screen.getByRole('button', { name: 'Create Workspace' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to continue' }));
    const login = new URL(screen.getByTestId('destination').textContent!, window.location.origin);
    expect(login.searchParams.get('redirectTo')).toBe(entry);
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
    first.unmount();

    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-user' } } });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create Workspace' })).toBeEnabled()
    );
    expect(screen.getByLabelText(/Workspace Name/)).toHaveValue('Tapes and PCC Labs');
    expect(screen.getByLabelText(/Description/)).toHaveValue('Related open source repos');
    fireEvent.click(screen.getByRole('button', { name: 'Create Workspace' }));
    await waitFor(() =>
      expect(screen.getByTestId('destination')).toHaveTextContent(
        '/i/tapes?addRepository=papercomputeco%2Ftapes'
      )
    );
    expect(mocks.createWorkspace).toHaveBeenCalledWith(
      { appUserId: 'app-user', authUserId: 'auth-user' },
      expect.objectContaining({ name: 'Tapes and PCC Labs' })
    );
    expect(readWorkspaceDraft('papercomputeco/tapes')).toEqual({});
  });

  it('rechecks expired sessions and offers sign-in without discarding the draft', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/Workspace Name/)).toBeEnabled());
    fillDraft();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Workspace' }));
    await screen.findByRole('button', { name: 'Sign in to continue' });
    expect(screen.getByText(/Your session expired/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Workspace Name/)).toHaveValue('Tapes and PCC Labs');
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  it('keeps the draft on service failure and clears it on cancellation', async () => {
    mocks.createWorkspace.mockResolvedValue({ success: false, error: 'Workspace limit reached' });
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/Workspace Name/)).toBeEnabled());
    fillDraft();
    fireEvent.click(screen.getByRole('button', { name: 'Create Workspace' }));
    await screen.findByText('Workspace limit reached');
    expect(readWorkspaceDraft('papercomputeco/tapes').name).toBe('Tapes and PCC Labs');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(readWorkspaceDraft('papercomputeco/tapes')).toEqual({});
  });

  it('links help to the published workspace documentation', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/Workspace Name/)).toBeEnabled());
    expect(screen.getByRole('link', { name: 'documentation' })).toHaveAttribute(
      'href',
      'https://docs.contributor.info/workspaces/overview'
    );
  });
});
