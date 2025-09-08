import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceOnboarding, WorkspaceOnboardingCompact } from '../WorkspaceOnboarding';
import { useFeatureFlags } from '@/lib/feature-flags/context';
import { FEATURE_FLAGS } from '@/lib/feature-flags/types';

// Mock the feature flags hook
jest.mock('@/lib/feature-flags/context');
const mockUseFeatureFlags = useFeatureFlags as jest.MockedFunction<typeof useFeatureFlags>;

describe('WorkspaceOnboarding - Feature Flag Tests', () => {
  const mockOnCreateClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WorkspaceOnboarding', () => {
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

      it('should show the full onboarding card', () => {
        render(<WorkspaceOnboarding onCreateClick={mockOnCreateClick} />);

        expect(screen.getByText('Create Your First Workspace')).toBeInTheDocument();
        expect(screen.getByText('Organize Repositories')).toBeInTheDocument();
        expect(screen.getByText('Track Contributors')).toBeInTheDocument();
        expect(screen.getByText('View Analytics')).toBeInTheDocument();
        expect(screen.getByText('Collaborate')).toBeInTheDocument();
        expect(screen.getByText('Create Your First Workspace')).toBeInTheDocument();
      });

      it('should call onCreateClick when button is clicked', async () => {
        const user = userEvent.setup();
        render(<WorkspaceOnboarding onCreateClick={mockOnCreateClick} />);

        const createButton = screen.getByText('Create Your First Workspace');
        await user.click(createButton);

        expect(mockOnCreateClick).toHaveBeenCalledTimes(1);
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

      it('should show the disabled state', () => {
        render(<WorkspaceOnboarding onCreateClick={mockOnCreateClick} />);

        expect(screen.getByText('Workspaces')).toBeInTheDocument();
        expect(screen.getByText('Workspace Creation Disabled')).toBeInTheDocument();
        expect(screen.queryByText('Create Your First Workspace')).not.toBeInTheDocument();
      });

      it('should not show the create button', () => {
        render(<WorkspaceOnboarding onCreateClick={mockOnCreateClick} />);

        const createButton = screen.queryByText('Create Your First Workspace');
        expect(createButton).not.toBeInTheDocument();
      });
    });
  });

  describe('WorkspaceOnboardingCompact', () => {
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

      it('should show the compact onboarding card', () => {
        render(<WorkspaceOnboardingCompact onCreateClick={mockOnCreateClick} />);

        expect(screen.getByText('Need another workspace?')).toBeInTheDocument();
        expect(screen.getByText('New Workspace')).toBeInTheDocument();
      });

      it('should call onCreateClick when button is clicked', async () => {
        const user = userEvent.setup();
        render(<WorkspaceOnboardingCompact onCreateClick={mockOnCreateClick} />);

        const createButton = screen.getByText('New Workspace');
        await user.click(createButton);

        expect(mockOnCreateClick).toHaveBeenCalledTimes(1);
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

      it('should show the disabled state', () => {
        render(<WorkspaceOnboardingCompact onCreateClick={mockOnCreateClick} />);

        expect(screen.getByText('Workspace Creation Disabled')).toBeInTheDocument();
        expect(screen.queryByText('New Workspace')).not.toBeInTheDocument();
      });
    });
  });
});
