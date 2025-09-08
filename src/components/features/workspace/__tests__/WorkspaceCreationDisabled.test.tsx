import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceCreationDisabled } from '../WorkspaceCreationDisabled';

describe('WorkspaceCreationDisabled', () => {
  const mockOnRequestAccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('card variant', () => {
    it('should render the card variant by default', () => {
      render(<WorkspaceCreationDisabled />);

      expect(screen.getByText('Workspace Creation Disabled')).toBeInTheDocument();
      expect(screen.getByText(/Workspace creation is currently unavailable/)).toBeInTheDocument();
    });

    it('should show request access button when callback provided', () => {
      render(<WorkspaceCreationDisabled onRequestAccess={mockOnRequestAccess} />);

      expect(screen.getByText('Request Early Access')).toBeInTheDocument();
    });

    it('should not show request access button when callback not provided', () => {
      render(<WorkspaceCreationDisabled />);

      expect(screen.queryByText('Request Early Access')).not.toBeInTheDocument();
    });

    it('should call onRequestAccess when button clicked', async () => {
      const user = userEvent.setup();
      render(<WorkspaceCreationDisabled onRequestAccess={mockOnRequestAccess} />);

      const requestButton = screen.getByText('Request Early Access');
      await user.click(requestButton);

      expect(mockOnRequestAccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('modal variant', () => {
    it('should render the modal variant', () => {
      render(<WorkspaceCreationDisabled variant="modal" />);

      expect(screen.getByText('Workspace Creation Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/Workspace creation is currently disabled/)).toBeInTheDocument();
    });

    it('should show request access button for modal variant', () => {
      render(<WorkspaceCreationDisabled variant="modal" onRequestAccess={mockOnRequestAccess} />);

      expect(screen.getByText('Request Early Access')).toBeInTheDocument();
    });

    it('should call onRequestAccess for modal variant', async () => {
      const user = userEvent.setup();
      render(<WorkspaceCreationDisabled variant="modal" onRequestAccess={mockOnRequestAccess} />);

      const requestButton = screen.getByText('Request Early Access');
      await user.click(requestButton);

      expect(mockOnRequestAccess).toHaveBeenCalledTimes(1);
    });

    it('should render different layout for modal variant', () => {
      render(<WorkspaceCreationDisabled variant="modal" />);

      // Modal variant should have centered layout
      const container = screen.getByText('Workspace Creation Unavailable').closest('div');
      expect(container?.className).toContain('text-center');
    });
  });
});
