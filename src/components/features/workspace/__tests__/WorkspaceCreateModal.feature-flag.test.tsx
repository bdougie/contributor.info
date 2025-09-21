import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { WorkspaceCreateModal } from '../WorkspaceCreateModal';
import { useFeatureFlags } from '@/lib/feature-flags/context';
import { FEATURE_FLAGS } from '@/lib/feature-flags/types';

// Mock the feature flags hook
vi.mock('@/lib/feature-flags/context');
const mockUseFeatureFlags = useFeatureFlags as ReturnType<typeof vi.fn>;

// Mock the services
vi.mock('@/services/workspace.service');
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
      signInWithOAuth: vi.fn(),
    },
  },
}));
vi.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({
    trackWorkspaceCreated: vi.fn(),
    trackWorkspaceSettingsModified: vi.fn(),
  }),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe('WorkspaceCreateModal - Feature Flag Tests', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
    mode: 'create' as const,
    source: 'home' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when workspace creation is enabled', () => {
    beforeEach(() => {
      vi.mocked(mockUseFeatureFlags).mockReturnValue({
        checkFlag: vi.fn((flagName) =>
          flagName === FEATURE_FLAGS.ENABLE_WORKSPACE_CREATION ? true : false
        ),
        flags: new Map(),
        isLoading: false,
        error: null,
        getFlagValue: vi.fn(),
        getExperimentVariant: vi.fn(),
        reload: vi.fn(),
      });
    });

    it('should show the workspace creation form', () => {
      render(<WorkspaceCreateModal {...defaultProps} />);

      expect(screen.getByTestId('modal-title-enabled')).toHaveTextContent('Create New Workspace');
      expect(screen.getByLabelText(/workspace name/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create workspace/i })).toBeInTheDocument();
    });

    it('should show form elements when feature is enabled', () => {
      render(<WorkspaceCreateModal {...defaultProps} />);

      const nameInput = screen.getByLabelText(/workspace name/i);
      const submitButton = screen.getByRole('button', { name: /create workspace/i });

      // Just verify elements exist
      expect(nameInput).toBeInTheDocument();
      expect(submitButton).toBeInTheDocument();
    });
  });

  describe('when workspace creation is disabled', () => {
    beforeEach(() => {
      vi.mocked(mockUseFeatureFlags).mockReturnValue({
        checkFlag: vi.fn((flagName) =>
          flagName === FEATURE_FLAGS.ENABLE_WORKSPACE_CREATION ? false : false
        ),
        flags: new Map(),
        isLoading: false,
        error: null,
        getFlagValue: vi.fn(),
        getExperimentVariant: vi.fn(),
        reload: vi.fn(),
      });
    });

    it('should show the disabled state for creation mode', () => {
      render(<WorkspaceCreateModal {...defaultProps} />);

      expect(screen.getByTestId('modal-title-disabled')).toHaveTextContent('Workspace Creation');
      expect(screen.getByTestId('modal-description-disabled')).toHaveTextContent(
        /workspace creation.*unavailable/i
      );
      expect(screen.queryByRole('button', { name: /create workspace/i })).not.toBeInTheDocument();
    });

    it('should show normal edit form for edit mode even when creation is disabled', () => {
      render(<WorkspaceCreateModal {...defaultProps} mode="edit" workspaceId="test-id" />);

      expect(screen.getByTestId('modal-title-enabled')).toHaveTextContent('Edit Workspace');
      expect(screen.getByLabelText(/workspace name/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('should render disabled component when creation is disabled', () => {
      render(<WorkspaceCreateModal {...defaultProps} />);

      // Test only what's immediately available without async behavior
      expect(screen.getByTestId('modal-title-disabled')).toBeInTheDocument();
      expect(screen.getByTestId('modal-description-disabled')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-creation-disabled')).toBeInTheDocument();
    });
  });
});
