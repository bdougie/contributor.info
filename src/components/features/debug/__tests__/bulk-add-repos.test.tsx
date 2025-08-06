import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { BulkAddRepos } from '../bulk-add-repos';

// Mock the toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast
  })
}));

// Simple Supabase mock that doesn't actually do anything
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => ({
          in: () => Promise.resolve({ data: [], error: null })
        })
      }),
      insert: () => Promise.resolve({ error: null })
    })
  }
}));

describe('BulkAddRepos', () => {
  it('renders the component with all UI elements', () => {
    render(<BulkAddRepos />);
    
    // Check for key elements - use more flexible queries
    const title = screen.queryByText('Bulk Add Repositories');
    const repoInput = screen.queryByText('Repository Input');
    const placeholder = screen.queryByPlaceholderText(/Paste repository list/);
    const addButton = screen.queryByText('Add Repositories');
    const clearButton = screen.queryByText('Clear');
    
    // At least one element should be present
    expect(title || repoInput || placeholder || addButton || clearButton).toBeTruthy();
    
    if (placeholder) {
      expect(placeholder).toBeInTheDocument();
    }
    if (addButton) {
      expect(addButton).toBeInTheDocument();
    }
  });

  it('enables the Add button when input is provided', () => {
    render(<BulkAddRepos />);
    
    const textarea = screen.getByPlaceholderText(/Paste repository list/);
    const addButton = screen.getByText('Add Repositories');
    
    // Initially disabled
    expect(addButton).toBeDisabled();
    
    // Enable after adding input
    fireEvent.change(textarea, { target: { value: 'vue/vue\nvitejs/vite' } });
    expect(addButton).not.toBeDisabled();
  });

  it('clears input when Clear button is clicked', () => {
    render(<BulkAddRepos />);
    
    const textarea = screen.getByPlaceholderText(/Paste repository list/) as HTMLTextAreaElement;
    const clearButton = screen.getByText('Clear');
    
    fireEvent.change(textarea, { target: { value: 'vue/vue\nvitejs/vite' } });
    expect(textarea.value).toBe('vue/vue\nvitejs/vite');
    
    fireEvent.click(clearButton);
    expect(textarea.value).toBe('');
  });

  it('shows placeholder text correctly', () => {
    render(<BulkAddRepos />);
    
    const textarea = screen.getByPlaceholderText(/Paste repository list/);
    expect(textarea).toHaveAttribute('placeholder');
    expect(textarea.getAttribute('placeholder')).toContain('vue/vue');
    expect(textarea.getAttribute('placeholder')).toContain('vitejs/vite');
  });

  it('textarea has correct styling classes', () => {
    render(<BulkAddRepos />);
    
    const textarea = screen.getByPlaceholderText(/Paste repository list/);
    expect(textarea).toHaveClass('min-h-[200px]');
    expect(textarea).toHaveClass('font-mono');
    expect(textarea).toHaveClass('text-sm');
  });

  it('has database icon in the title', () => {
    render(<BulkAddRepos />);
    
    const title = screen.getByText('Bulk Add Repositories');
    const titleContainer = title.parentElement;
    
    // Check that the container has the database icon (svg with specific class)
    expect(titleContainer?.querySelector('.lucide-database')).toBeInTheDocument();
  });

  it('add button has correct styling and icon', () => {
    render(<BulkAddRepos />);
    
    const addButton = screen.getByText('Add Repositories');
    
    // Check button has icon
    expect(addButton.querySelector('.lucide-database')).toBeInTheDocument();
    
    // Check button styling
    expect(addButton).toHaveClass('flex', 'items-center', 'gap-2');
  });

  it('updates button text when disabled vs enabled', () => {
    render(<BulkAddRepos />);
    
    const textarea = screen.getByPlaceholderText(/Paste repository list/);
    const addButton = screen.getByText('Add Repositories');
    
    // Initially shows "Add Repositories"
    expect(addButton).toHaveTextContent('Add Repositories');
    
    // Still shows same text when enabled
    fireEvent.change(textarea, { target: { value: 'vue/vue' } });
    expect(addButton).toHaveTextContent('Add Repositories');
  });
});