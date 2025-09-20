import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock the Select component to avoid jsdom issues with Radix UI
interface SelectProps {
  children: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}

interface SelectTriggerProps {
  children: React.ReactNode;
}

interface SelectContentProps {
  children: React.ReactNode;
}

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: SelectProps) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onValueChange(e.target.value);
    };

    return (
      <select
        value={value}
        onChange={handleChange}
        role="combobox"
        aria-label="Filter by activity type"
        data-testid="type-filter-select"
      >
        {children}
      </select>
    );
  },
  SelectTrigger: ({ children }: SelectTriggerProps) => <>{children}</>,
  SelectContent: ({ children }: SelectContentProps) => <>{children}</>,
  SelectItem: ({ value, children }: SelectItemProps) => <option value={value}>{children}</option>,
  SelectValue: () => null,
}));

import { ActivityTableFilters } from '../components/ActivityTableFilters';
import { ActivityTableHeader } from '../components/ActivityTableHeader';
import { ActivityTableRow } from '../components/ActivityTableRow';
import { AnalyticsErrorBoundary } from '../ErrorBoundary';
import { sortData, filterData, calculateTrend, formatNumber } from '../utils/analytics-utils';

// Mock data for testing
const mockActivity = {
  id: '1',
  type: 'pr' as const,
  title: 'Fix authentication bug',
  author: {
    username: 'johndoe',
    avatar_url: 'https://example.com/avatar.jpg',
  },
  repository: 'company/app',
  created_at: '2024-01-15T10:00:00Z',
  status: 'merged' as const,
  url: 'https://github.com/company/app/pull/123',
};

const mockActivities = [
  mockActivity,
  {
    ...mockActivity,
    id: '2',
    type: 'issue' as const,
    title: 'Add dark mode support',
    author: { username: 'janedoe', avatar_url: '' },
    status: 'open' as const,
  },
  {
    ...mockActivity,
    id: '3',
    type: 'commit' as const,
    title: 'Update dependencies',
    created_at: '2024-01-14T10:00:00Z',
  },
];

describe('ActivityTableFilters', () => {
  it('renders search input and type filter', () => {
    const onSearchChange = vi.fn();
    const onTypeFilterChange = vi.fn();

    render(
      <ActivityTableFilters
        searchQuery=""
        typeFilter="all"
        onSearchChange={onSearchChange}
        onTypeFilterChange={onTypeFilterChange}
      />
    );

    expect(screen.getByPlaceholderText('Search activities...')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('debounces search input', async () => {
    const onSearchChange = vi.fn();
    const onTypeFilterChange = vi.fn();

    render(
      <ActivityTableFilters
        searchQuery=""
        typeFilter="all"
        onSearchChange={onSearchChange}
        onTypeFilterChange={onTypeFilterChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search activities...');
    await userEvent.type(searchInput, 'test');

    // Should not be called immediately
    expect(onSearchChange).not.toHaveBeenCalled();

    // Should be called after debounce delay
    await waitFor(
      () => {
        expect(onSearchChange).toHaveBeenCalledWith('test');
      },
      { timeout: 400 }
    );
  });

  it('handles type filter change', async () => {
    const onSearchChange = vi.fn();
    const onTypeFilterChange = vi.fn();

    render(
      <ActivityTableFilters
        searchQuery=""
        typeFilter="all"
        onSearchChange={onSearchChange}
        onTypeFilterChange={onTypeFilterChange}
      />
    );

    // Find the select element (mocked)
    const select = screen.getByRole('combobox');

    // Change the select value
    fireEvent.change(select, { target: { value: 'pr' } });

    // Verify the callback was called
    expect(onTypeFilterChange).toHaveBeenCalledWith('pr');
  });
});

describe('ActivityTableHeader', () => {
  it('renders all column headers', () => {
    const onSort = vi.fn();

    render(<ActivityTableHeader sortField="created_at" sortOrder="desc" onSort={onSort} />);

    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Author')).toBeInTheDocument();
    expect(screen.getByText('Repository')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('shows sort indicator for active sort field', () => {
    const onSort = vi.fn();

    render(<ActivityTableHeader sortField="created_at" sortOrder="desc" onSort={onSort} />);

    const dateButton = screen.getByRole('button', { name: /sort by date/i });
    expect(dateButton).toHaveAttribute('aria-sort', 'descending');
  });

  it('calls onSort when clicking sortable columns', () => {
    const onSort = vi.fn();

    render(<ActivityTableHeader sortField="created_at" sortOrder="desc" onSort={onSort} />);

    const typeButton = screen.getByRole('button', { name: /sort by type/i });
    fireEvent.click(typeButton);

    expect(onSort).toHaveBeenCalledWith('type');
  });
});

describe('ActivityTableRow', () => {
  it('renders activity information correctly', () => {
    render(<ActivityTableRow activity={mockActivity} />);

    // Test that title is rendered
    expect(screen.getByText('Fix authentication bug')).toBeInTheDocument();

    // Test that username is rendered (may be hidden on mobile)
    const usernameElement = screen.getByText('johndoe');
    expect(usernameElement).toBeInTheDocument();

    // Test that repository is rendered
    expect(screen.getByText('company/app')).toBeInTheDocument();
  });

  it('displays correct status badge', () => {
    render(<ActivityTableRow activity={mockActivity} />);

    const statusBadge = screen.getByText('Merged');
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveClass('bg-purple-500/10');
  });

  it('opens GitHub link in new tab when clicking external link', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<ActivityTableRow activity={mockActivity} />);

    const linkButton = screen.getByRole('button', { name: /open pull request in new tab/i });
    fireEvent.click(linkButton);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://github.com/company/app/pull/123',
      '_blank',
      'noopener,noreferrer'
    );

    windowOpenSpy.mockRestore();
  });
});

describe('AnalyticsErrorBoundary', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };

  beforeEach(() => {
    // Suppress console.error for these tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('catches errors and displays fallback UI', () => {
    render(
      <AnalyticsErrorBoundary>
        <ThrowError />
      </AnalyticsErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('resets error state when clicking Try Again', () => {
    const GoodComponent = () => <div>Working component</div>;
    let shouldThrow = true;

    const ConditionalError = () => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <GoodComponent />;
    };

    const { rerender } = render(
      <AnalyticsErrorBoundary>
        <ConditionalError />
      </AnalyticsErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    shouldThrow = false;
    const tryAgainButton = screen.getByRole('button', { name: 'Try Again' });
    fireEvent.click(tryAgainButton);

    rerender(
      <AnalyticsErrorBoundary>
        <ConditionalError />
      </AnalyticsErrorBoundary>
    );

    expect(screen.getByText('Working component')).toBeInTheDocument();
  });

  it('uses custom fallback when provided', () => {
    render(
      <AnalyticsErrorBoundary fallback={<div>Custom error message</div>}>
        <ThrowError />
      </AnalyticsErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });
});

describe('Analytics Utilities', () => {
  describe('sortData', () => {
    it('sorts data ascending', () => {
      const data = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];

      const sorted = sortData(data, { key: 'name', direction: 'asc' });
      expect(sorted[0].name).toBe('Alice');
      expect(sorted[2].name).toBe('Charlie');
    });

    it('sorts data descending', () => {
      const data = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];

      const sorted = sortData(data, { key: 'age', direction: 'desc' });
      expect(sorted[0].age).toBe(35);
      expect(sorted[2].age).toBe(25);
    });

    it('handles null values', () => {
      const data = [
        { name: 'Alice', age: null },
        { name: 'Bob', age: 35 },
        { name: 'Charlie', age: undefined },
      ];

      const sorted = sortData(data, { key: 'age', direction: 'asc' });
      expect(sorted[0].age).toBe(35);
      expect(sorted[1].age).toBe(null);
      expect(sorted[2].age).toBe(undefined);
    });
  });

  describe('filterData', () => {
    it('filters by search term', () => {
      const filtered = filterData(mockActivities, { search: 'dark' }, ['title', 'description']);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Add dark mode support');
    });

    it('filters by type', () => {
      const filtered = filterData(mockActivities, { type: 'pr' }, []);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('pr');
    });

    it('combines multiple filters', () => {
      const filtered = filterData(mockActivities, { search: 'update', type: 'commit' }, ['title']);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Update dependencies');
    });
  });

  describe('calculateTrend', () => {
    it('calculates positive trend', () => {
      const trend = calculateTrend(150, 100);
      expect(trend.value).toBe(50);
      expect(trend.direction).toBe('up');
      expect(trend.percentage).toBe(50);
    });

    it('calculates negative trend', () => {
      const trend = calculateTrend(80, 100);
      expect(trend.value).toBe(-20);
      expect(trend.direction).toBe('down');
      expect(trend.percentage).toBe(20);
    });

    it('handles zero previous value', () => {
      const trend = calculateTrend(100, 0);
      expect(trend.value).toBe(100);
      expect(trend.direction).toBe('up');
      expect(trend.percentage).toBe(100);
    });

    it('identifies neutral trend', () => {
      const trend = calculateTrend(100, 100);
      expect(trend.value).toBe(0);
      expect(trend.direction).toBe('neutral');
      expect(trend.percentage).toBe(0);
    });
  });

  describe('formatNumber', () => {
    it('formats thousands', () => {
      expect(formatNumber(1500)).toBe('1.5K');
      expect(formatNumber(999)).toBe('999');
      expect(formatNumber(1000)).toBe('1.0K');
    });

    it('formats millions', () => {
      expect(formatNumber(1500000)).toBe('1.5M');
      expect(formatNumber(999999)).toBe('1000.0K');
      expect(formatNumber(1000000)).toBe('1.0M');
    });
  });
});
