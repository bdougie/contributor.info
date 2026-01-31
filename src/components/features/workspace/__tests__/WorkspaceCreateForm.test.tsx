import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceCreateForm } from '../WorkspaceCreateForm';
import { vi } from 'vitest';

describe('WorkspaceCreateForm', () => {
  it('renders correctly', () => {
    const mockSubmit = vi.fn();
    render(<WorkspaceCreateForm onSubmit={mockSubmit} />);

    expect(screen.getByLabelText(/Workspace Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Workspace/i })).toBeInTheDocument();
  });

  it('shows character count for description', () => {
    const mockSubmit = vi.fn();
    render(<WorkspaceCreateForm onSubmit={mockSubmit} />);

    const descriptionInput = screen.getByLabelText(/Description/i);
    const counter = screen.getByText(/0\/500/i);

    expect(counter).toBeInTheDocument();

    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    expect(screen.getByText(/16\/500/i)).toBeInTheDocument();
  });

  it('has maxLength attributes', () => {
    const mockSubmit = vi.fn();
    render(<WorkspaceCreateForm onSubmit={mockSubmit} />);

    expect(screen.getByLabelText(/Workspace Name/i)).toHaveAttribute('maxLength', '50');
    expect(screen.getByLabelText(/Description/i)).toHaveAttribute('maxLength', '500');
  });
});
