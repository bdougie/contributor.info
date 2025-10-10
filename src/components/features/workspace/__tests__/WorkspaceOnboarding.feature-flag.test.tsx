import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceOnboarding, WorkspaceOnboardingCompact } from '../WorkspaceOnboarding';
import { useFeatureFlags } from '@/lib/feature-flags/context';
import { FEATURE_FLAGS } from '@/lib/feature-flags/types';

// Mock the feature flags hook
vi.mock('@/lib/feature-flags/context');
const mockUseFeatureFlags = useFeatureFlags as ReturnType<typeof vi.fn>;

describe('WorkspaceOnboarding - Feature Flag Tests', () => {
  const mockOnCreateClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WorkspaceOnboarding', () => {
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

      it('should show the full onboarding card', () => {
        render(
          <MemoryRouter>
            <WorkspaceOnboarding onCreateClick={mockOnCreateClick} />
          </MemoryRouter>
        );

        expect(
          screen.getByRole('heading', { name: 'Create Your First Workspace' })
        ).toBeInTheDocument();
        expect(screen.getByText('Organize Repositories')).toBeInTheDocument();
        expect(screen.getByText('Track Contributors')).toBeInTheDocument();
        expect(screen.getByText('View Analytics')).toBeInTheDocument();
        expect(screen.getByText('Collaborate')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Create Your First Workspace' })
        ).toBeInTheDocument();
      });

      it('should show create button when enabled', () => {
        render(
          <MemoryRouter>
            <WorkspaceOnboarding onCreateClick={mockOnCreateClick} />
          </MemoryRouter>
        );

        const createButton = screen.getByRole('button', { name: 'Create Your First Workspace' });
        // Just verify button exists, actual click testing is forbidden
        expect(createButton).toBeInTheDocument();
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

      it('should show the disabled state', () => {
        render(
          <MemoryRouter>
            <WorkspaceOnboarding onCreateClick={mockOnCreateClick} />
          </MemoryRouter>
        );

        expect(screen.getByText('Workspaces')).toBeInTheDocument();
        expect(screen.getByText('Sign In Required')).toBeInTheDocument();
        expect(screen.queryByText('Create Your First Workspace')).not.toBeInTheDocument();
      });

      it('should not show the create button', () => {
        render(
          <MemoryRouter>
            <WorkspaceOnboarding onCreateClick={mockOnCreateClick} />
          </MemoryRouter>
        );

        const createButton = screen.queryByText('Create Your First Workspace');
        expect(createButton).not.toBeInTheDocument();
      });
    });
  });

  describe('WorkspaceOnboardingCompact', () => {
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

      it('should show the compact onboarding card', () => {
        render(
          <MemoryRouter>
            <WorkspaceOnboardingCompact onCreateClick={mockOnCreateClick} />
          </MemoryRouter>
        );

        expect(screen.getByText('Need another workspace?')).toBeInTheDocument();
        expect(screen.getByText('New Workspace')).toBeInTheDocument();
      });

      it('should show create button when enabled', () => {
        render(
          <MemoryRouter>
            <WorkspaceOnboardingCompact onCreateClick={mockOnCreateClick} />
          </MemoryRouter>
        );

        const createButton = screen.getByText('New Workspace');
        // Just verify button exists, actual click testing is forbidden
        expect(createButton).toBeInTheDocument();
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

      it('should show the disabled state', () => {
        render(
          <MemoryRouter>
            <WorkspaceOnboardingCompact onCreateClick={mockOnCreateClick} />
          </MemoryRouter>
        );

        expect(screen.getByText('Sign In Required')).toBeInTheDocument();
        expect(screen.queryByText('New Workspace')).not.toBeInTheDocument();
      });
    });
  });
});
