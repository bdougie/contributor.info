import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

// Common types used across analytics components
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  search?: string;
  type?: string;
  status?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  [key: string]: unknown;
}

// Sorting utilities
export function sortData<T>(
  data: T[],
  sortConfig: SortConfig | null,
  getValueFn?: (item: T, key: string) => unknown
): T[] {
  if (!sortConfig) return data;

  return [...data].sort((a, b) => {
    const aValue = getValueFn ? getValueFn(a, sortConfig.key) : (a as Record<string, unknown>)[sortConfig.key];
    const bValue = getValueFn ? getValueFn(b, sortConfig.key) : (b as Record<string, unknown>)[sortConfig.key];

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

// Filtering utilities
export function filterData<T extends object>(data: T[], filters: FilterConfig, searchFields: (keyof T)[]): T[] {
  return data.filter((item) => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = searchFields.some((field) => {
        const value = item[field];
        return value && String(value).toLowerCase().includes(searchLower);
      });
      if (!matchesSearch) return false;
    }

    // Type filter
    if (filters.type && 'type' in item) {
      if ((item as Record<string, unknown>).type !== filters.type) return false;
    }

    // Status filter
    if (filters.status && 'status' in item) {
      if ((item as Record<string, unknown>).status !== filters.status) return false;
    }

    // Date range filter
    if (filters.dateRange && 'date' in item) {
      const itemDate = new Date((item as Record<string, unknown>).date as string);
      if (itemDate < filters.dateRange.start || itemDate > filters.dateRange.end) {
        return false;
      }
    }

    return true;
  });
}

// Date range utilities
export function getDateRangePresets() {
  const now = new Date();

  return {
    today: {
      label: 'Today',
      start: new Date(now.setHours(0, 0, 0, 0)),
      end: new Date(now.setHours(23, 59, 59, 999)),
    },
    last7Days: {
      label: 'Last 7 Days',
      start: subDays(now, 7),
      end: now,
    },
    last30Days: {
      label: 'Last 30 Days',
      start: subDays(now, 30),
      end: now,
    },
    thisMonth: {
      label: 'This Month',
      start: startOfMonth(now),
      end: endOfMonth(now),
    },
    lastMonth: {
      label: 'Last Month',
      start: startOfMonth(subDays(now, 30)),
      end: endOfMonth(subDays(now, 30)),
    },
  };
}

// Trend calculation utilities
export function calculateTrend(
  current: number,
  previous: number
): {
  value: number;
  direction: 'up' | 'down' | 'neutral';
  percentage: number;
} {
  if (previous === 0) {
    return {
      value: current,
      direction: current > 0 ? 'up' : 'neutral',
      percentage: current > 0 ? 100 : 0,
    };
  }

  const difference = current - previous;
  const percentage = Math.round((difference / previous) * 100);

  return {
    value: difference,
    direction: difference > 0 ? 'up' : (difference < 0 ? 'down' : 'neutral'),
    percentage: Math.abs(percentage),
  };
}

// Export utilities
export async function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
) {
  if (!data.length) {
    throw new Error('No data to export');
  }

  const headers = columns ? columns.map((col) => col.label) : Object.keys(data[0]);

  const keys = columns ? columns.map((col) => col.key) : Object.keys(data[0]);

  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      keys
        .map((key) => {
          const value = row[key as keyof T];
          // Escape commas and quotes in values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function exportToJSON<T>(data: T, filename: string) {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Debounce utility for search inputs
export function debounce<Args extends unknown[]>(
  func: (...args: Args) => void,
  delay: number
): (...args: Args) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Format utilities
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
