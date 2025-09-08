import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceCreateModal } from '../WorkspaceCreateModal';
import { useFeatureFlags } from '@/lib/feature-flags/context';
import { FEATURE_FLAGS } from '@/lib/feature-flags/types';

// Mock the feature flags hook
jest.mock('@/lib/feature-flags/context');
const mockUseFeatureFlags = useFeatureFlags as jest.MockedFunction<typeof useFeatureFlags>;

// Mock the services
jest.mock('@/services/workspace.service');
jest.mock('@/lib/supabase');
jest.mock('@/hooks/use-analytics');

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
  },
}));

describe('WorkspaceCreateModal - Feature Flag Tests', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onSuccess: jest.fn(),
    mode: 'create' as const,
    source: 'home' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when workspace creation is enabled', () => {
    beforeEach(() => {
      mockUseFeatureFlags.mockReturnValue({
        checkFlag: jest.fn((flagName) =>
          flagName === FEATURE_FLAGS.ENABLE_WORKSPACE_CREATION ? true : false
        ),
        flags: new Map(),
        isLoading: false,
        error: null,
        getFlagValue: jest.fn(),
        getExperimentVariant: jest.fn(),
        reload: jest.fn(),
      });
    });

    it('should show the workspace creation form', () => {
      render(<WorkspaceCreateModal {...defaultProps} />);

      expect(screen.getByText('Create New Workspace')).toBeInTheDocument();
      expect(screen.getByLabelText(/workspace name/i)).toBeInTheDocument();
      expect(screen.getByText('Create Workspace')).toBeInTheDocument();
    });

    it('should allow form submission when feature is enabled', async () => {
      const user = userEvent.setup();
      render(<WorkspaceCreateModal {...defaultProps} />);

      const nameInput = screen.getByLabelText(/workspace name/i);
      const submitButton = screen.getByText('Create Workspace');

      await user.type(nameInput, 'Test Workspace');
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('when workspace creation is disabled', () => {
    beforeEach(() => {
      mockUseFeatureFlags.mockReturnValue({
        checkFlag: jest.fn((flagName) =>
          flagName === FEATURE_FLAGS.ENABLE_WORKSPACE_CREATION ? false : false
        ),
        flags: new Map(),
        isLoading: false,
        error: null,
        getFlagValue: jest.fn(),
        getExperimentVariant: jest.fn(),
        reload: jest.fn(),
      });
    });

    it('should show the disabled state for creation mode', () => {
      render(<WorkspaceCreateModal {...defaultProps} />);

      expect(screen.getByText('Workspace Creation')).toBeInTheDocument();
      expect(screen.getByText('Workspace creation is currently unavailable')).toBeInTheDocument();
      expect(screen.getByText('Request Early Access')).toBeInTheDocument();
      expect(screen.queryByText('Create Workspace')).not.toBeInTheDocument();
    });

    it('should show normal edit form for edit mode even when creation is disabled', () => {
      render(<WorkspaceCreateModal {...defaultProps} mode="edit" workspaceId="test-id" />);

      expect(screen.getByText('Edit Workspace')).toBeInTheDocument();
      expect(screen.getByLabelText(/workspace name/i)).toBeInTheDocument();
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    it('should handle request access button click', async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();

      render(<WorkspaceCreateModal {...defaultProps} onOpenChange={onOpenChange} />);

      const requestButton = screen.getByText('Request Early Access');
      await user.click(requestButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('feature flag checking during submission', () => {
    it('should prevent submission if feature flag is disabled during form submission', async () => {
      // Start with feature enabled
      let flagEnabled = true;
      mockUseFeatureFlags.mockReturnValue({
        checkFlag: jest.fn((flagName) =>
          flagName === FEATURE_FLAGS.ENABLE_WORKSPACE_CREATION ? flagEnabled : false
        ),
        flags: new Map(),
        isLoading: false,
        error: null,
        getFlagValue: jest.fn(),
        getExperimentVariant: jest.fn(),
        reload: jest.fn(),
      });

      const user = userEvent.setup();
      render(<WorkspaceCreateModal {...defaultProps} />);

      const nameInput = screen.getByLabelText(/workspace name/i);
      await user.type(nameInput, 'Test Workspace');

      // Disable feature flag before submission
      flagEnabled = false;

      const submitButton = screen.getByText('Create Workspace');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Workspace creation is currently disabled')).toBeInTheDocument();
      });
    });
  });
});
