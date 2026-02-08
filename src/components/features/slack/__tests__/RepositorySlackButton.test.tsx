import { render, screen, fireEvent } from '@testing-library/react';
import { RepositorySlackButton } from '../RepositorySlackButton';
import { vi, describe, it, expect } from 'vitest';

// Mock dependencies
vi.mock('@/hooks/use-github-auth', () => ({
  useGitHubAuth: () => ({
    isLoggedIn: true,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('react-router', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('@/services/user-slack-integration.service', () => ({
  getUserSlackIntegrationForRepo: vi.fn().mockResolvedValue(null),
  getPendingIntegrationForRepo: vi.fn().mockResolvedValue(null),
  initiateUserSlackOAuth: vi.fn().mockReturnValue(new Promise(() => {})), // Never resolves to keep loading state
  getChannelsForUserIntegration: vi.fn(),
  setUserIntegrationChannel: vi.fn(),
  deleteUserSlackIntegration: vi.fn(),
}));

// Mock UI components that might cause issues
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('RepositorySlackButton', () => {
  const defaultProps = {
    owner: 'test-owner',
    repo: 'test-repo',
  };

  it('renders correctly when logged in', () => {
    render(<RepositorySlackButton {...defaultProps} />);
    const button = screen.getByRole('button', { name: /Connect Slack/i });
    expect(button).toBeInTheDocument();
  });

  it('shows loading state when connecting', () => {
    render(<RepositorySlackButton {...defaultProps} />);

    // Open dialog
    const openButton = screen.getByRole('button', { name: /Connect Slack/i });
    fireEvent.click(openButton);

    // Find "Connect to Slack" button inside dialog
    const connectButton = screen.getByRole('button', { name: /Connect to Slack/i });

    // Click connect
    fireEvent.click(connectButton);

    // Expect button to be disabled (loading state)
    expect(connectButton).toBeDisabled();

    // Text should still be present
    expect(screen.getByText('Connect to Slack')).toBeInTheDocument();
  });
});
