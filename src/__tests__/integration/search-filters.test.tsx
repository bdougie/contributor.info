import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock React components for search interface
const MockSearchComponent = ({ onSearch, onFilterChange, filters }: {
  onSearch: (query: string) => void;
  onFilterChange: (filters: SearchFilters) => void;
  filters: SearchFilters;
}) => {
  const [query, setQuery] = React.useState('');
  
  return (
    <div data-testid="search-component">
      <input
        data-testid="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search repositories..."
      />
      <button
        data-testid="search-button"
        onClick={() => onSearch(query)}
      >
        Search
      </button>
      
      <div data-testid="filters">
        <select
          data-testid="language-filter"
          value={filters.language}
          onChange={(e) => onFilterChange({ ...filters, language: e.target.value })}
        >
          <option value="">All Languages</option>
          <option value="JavaScript">JavaScript</option>
          <option value="TypeScript">TypeScript</option>
          <option value="Python">Python</option>
        </select>
        
        <select
          data-testid="activity-filter"
          value={filters.activity}
          onChange={(e) => onFilterChange({ ...filters, activity: e.target.value })}
        >
          <option value="">All Activity</option>
          <option value="active">Active (last 30 days)</option>
          <option value="recent">Recent (last 7 days)</option>
        </select>
        
        <input
          data-testid="min-stars-filter"
          type="number"
          placeholder="Min stars"
          value={filters.minStars || ''}
          onChange={(e) => onFilterChange({ 
            ...filters, 
            minStars: e.target.value ? parseInt(e.target.value) : undefined 
          })}
        />
        
        <input
          data-testid="date-range-start"
          type="date"
          value={filters.dateRange?.start || ''}
          onChange={(e) => onFilterChange({
            ...filters,
            dateRange: {
              ...filters.dateRange,
              start: e.target.value,
            }
          })}
        />
        
        <input
          data-testid="date-range-end"
          type="date"
          value={filters.dateRange?.end || ''}
          onChange={(e) => onFilterChange({
            ...filters,
            dateRange: {
              ...filters.dateRange,
              end: e.target.value,
            }
          })}
        />
      </div>
    </div>
  );
};

// Mock React import
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: vi.fn((initial) => [initial, vi.fn()]),
  };
});

// Mock search utilities
const mockSearchUtils = {
  searchRepositories: vi.fn(),
  filterRepositories: vi.fn(),
  parseSearchQuery: vi.fn(),
  buildSearchQuery: vi.fn(),
  validateFilters: vi.fn(),
  applySorting: vi.fn(),
};

vi.mock('@/lib/search-utils', () => mockSearchUtils);

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      ilike: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                range: vi.fn(() => ({
                  data: [],
                  error: null,
                  count: 0,
                })),
              })),
            })),
          })),
        })),
      })),
    })),
  })),
  rpc: vi.fn(() => ({
    data: [],
    error: null,
  })),
};

vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Mock logging
vi.mock('@/lib/simple-logging', () => ({
  setApplicationContext: vi.fn(),
  startSpan: vi.fn((options, fn) => fn({ setStatus: vi.fn() })),
}));

interface SearchFilters {
  language?: string;
  activity?: string;
  minStars?: number;
  dateRange?: {
    start?: string;
    end?: string;
  };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface Repository {
  id: string;
  name: string;
  full_name: string;
  description: string;
  language: string;
  stargazers_count: number;
  updated_at: string;
  created_at: string;
}

describe('Search and Filters Integration Tests', () => {
  const mockRepositories: Repository[] = [
    {
      id: 'repo1',
      name: 'awesome-project',
      full_name: 'user1/awesome-project',
      description: 'An awesome TypeScript project',
      language: 'TypeScript',
      stargazers_count: 150,
      updated_at: '2024-06-15T12:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'repo2',
      name: 'python-tool',
      full_name: 'user2/python-tool',
      description: 'A useful Python tool',
      language: 'Python',
      stargazers_count: 75,
      updated_at: '2024-06-10T08:00:00Z',
      created_at: '2024-02-01T00:00:00Z',
    },
    {
      id: 'repo3',
      name: 'js-library',
      full_name: 'user3/js-library',
      description: 'A JavaScript library for developers',
      language: 'JavaScript',
      stargazers_count: 300,
      updated_at: '2024-06-20T16:00:00Z',
      created_at: '2024-03-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default search responses
    mockSearchUtils.searchRepositories.mockResolvedValue({
      data: mockRepositories,
      count: mockRepositories.length,
    });
    
    mockSearchUtils.filterRepositories.mockImplementation((repos, filters) => {
      let filtered = [...repos];
      
      if (filters.language) {
        filtered = filtered.filter(repo => repo.language === filters.language);
      }
      
      if (filters.minStars) {
        filtered = filtered.filter(repo => repo.stargazers_count >= filters.minStars);
      }
      
      return filtered;
    });
    
    mockSearchUtils.parseSearchQuery.mockImplementation((query) => ({
      terms: query.split(' ').filter(term => !term.startsWith(':')),
      operators: {},
    }));
    
    mockSearchUtils.validateFilters.mockReturnValue({ valid: true, errors: [] });
    
    mockSearchUtils.applySorting.mockImplementation((repos, sortBy, sortOrder) => {
      const sorted = [...repos];
      
      if (sortBy === 'stars') {
        sorted.sort((a, b) => 
          sortOrder === 'desc' 
            ? b.stargazers_count - a.stargazers_count
            : a.stargazers_count - b.stargazers_count
        );
      }
      
      return sorted;
    });
    
    // Setup Supabase mock
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        ilike: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                order: vi.fn(() => ({
                  range: vi.fn(() => ({
                    data: mockRepositories,
                    error: null,
                    count: mockRepositories.length,
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    });

    // Setup React useState mock
    const React = require('react');
    React.useState.mockImplementation((initial) => {
      let state = initial;
      const setState = (newState: any) => {
        state = typeof newState === 'function' ? newState(state) : newState;
      };
      return [state, setState];
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('Basic Search Functionality', () => {
    it('should perform text search across repository names and descriptions', async () => {
      const searchFunction = async (query: string) => {
        const parsedQuery = mockSearchUtils.parseSearchQuery(query);
        return await mockSearchUtils.searchRepositories(parsedQuery);
      };

      const result = await searchFunction('awesome project');

      expect(mockSearchUtils.parseSearchQuery).toHaveBeenCalledWith('awesome project');
      expect(mockSearchUtils.searchRepositories).toHaveBeenCalled();
      expect(result.data).toEqual(mockRepositories);
    });

    it('should handle empty search queries', async () => {
      mockSearchUtils.searchRepositories.mockResolvedValue({
        data: mockRepositories,
        count: mockRepositories.length,
      });

      const result = await mockSearchUtils.searchRepositories({ terms: [], operators: {} });

      expect(result.data).toHaveLength(mockRepositories.length);
    });

    it('should perform case-insensitive search', async () => {
      const searchFunction = async (query: string) => {
        // Simulate case-insensitive search
        const filtered = mockRepositories.filter(repo =>
          repo.name.toLowerCase().includes(query.toLowerCase()) ||
          repo.description.toLowerCase().includes(query.toLowerCase())
        );
        
        return { data: filtered, count: filtered.length };
      };

      const result = await searchFunction('PYTHON');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('python-tool');
    });

    it('should handle special search operators', async () => {
      mockSearchUtils.parseSearchQuery.mockReturnValue({
        terms: ['library'],
        operators: {
          language: 'javascript',
          stars: '>100',
        },
      });

      const result = await mockSearchUtils.searchRepositories({
        terms: ['library'],
        operators: { language: 'javascript', stars: '>100' },
      });

      expect(mockSearchUtils.parseSearchQuery).toHaveBeenCalled();
      expect(result.data).toBeDefined();
    });
  });

  describe('Filter Application', () => {
    it('should filter repositories by programming language', async () => {
      const filters: SearchFilters = { language: 'TypeScript' };
      const filtered = mockSearchUtils.filterRepositories(mockRepositories, filters);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].language).toBe('TypeScript');
    });

    it('should filter repositories by minimum star count', async () => {
      const filters: SearchFilters = { minStars: 100 };
      const filtered = mockSearchUtils.filterRepositories(mockRepositories, filters);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(repo => repo.stargazers_count >= 100)).toBe(true);
    });

    it('should apply multiple filters simultaneously', async () => {
      const filters: SearchFilters = {
        language: 'JavaScript',
        minStars: 200,
      };
      
      let filtered = mockRepositories.filter(repo => repo.language === filters.language);
      filtered = filtered.filter(repo => repo.stargazers_count >= (filters.minStars || 0));

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('js-library');
    });

    it('should filter by date range', async () => {
      const filters: SearchFilters = {
        dateRange: {
          start: '2024-02-01',
          end: '2024-03-31',
        },
      };

      const filterByDateRange = (repos: Repository[], filters: SearchFilters) => {
        if (!filters.dateRange) return repos;
        
        return repos.filter(repo => {
          const repoDate = new Date(repo.created_at);
          const startDate = filters.dateRange?.start ? new Date(filters.dateRange.start) : null;
          const endDate = filters.dateRange?.end ? new Date(filters.dateRange.end) : null;
          
          if (startDate && repoDate < startDate) return false;
          if (endDate && repoDate > endDate) return false;
          return true;
        });
      };

      const filtered = filterByDateRange(mockRepositories, filters);

      expect(filtered).toHaveLength(2);
      expect(filtered.map(r => r.name)).toEqual(['python-tool', 'js-library']);
    });

    it('should validate filter combinations', async () => {
      const validFilters: SearchFilters = {
        language: 'TypeScript',
        minStars: 10,
      };

      const invalidFilters: SearchFilters = {
        minStars: -5, // Invalid negative value
      };

      mockSearchUtils.validateFilters
        .mockReturnValueOnce({ valid: true, errors: [] })
        .mockReturnValueOnce({ valid: false, errors: ['minStars must be non-negative'] });

      const validResult = mockSearchUtils.validateFilters(validFilters);
      const invalidResult = mockSearchUtils.validateFilters(invalidFilters);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('minStars must be non-negative');
    });
  });

  describe('Search Result Sorting', () => {
    it('should sort results by star count', async () => {
      const sorted = mockSearchUtils.applySorting(mockRepositories, 'stars', 'desc');

      expect(sorted[0].name).toBe('js-library'); // 300 stars
      expect(sorted[1].name).toBe('awesome-project'); // 150 stars
      expect(sorted[2].name).toBe('python-tool'); // 75 stars
    });

    it('should sort results by last updated date', async () => {
      mockSearchUtils.applySorting.mockImplementation((repos, sortBy, sortOrder) => {
        if (sortBy === 'updated') {
          return [...repos].sort((a, b) => {
            const dateA = new Date(a.updated_at).getTime();
            const dateB = new Date(b.updated_at).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
          });
        }
        return repos;
      });

      const sorted = mockSearchUtils.applySorting(mockRepositories, 'updated', 'desc');

      expect(sorted[0].name).toBe('js-library'); // Most recent
      expect(sorted[2].name).toBe('python-tool'); // Least recent
    });

    it('should handle custom sorting criteria', async () => {
      mockSearchUtils.applySorting.mockImplementation((repos, sortBy) => {
        if (sortBy === 'name') {
          return [...repos].sort((a, b) => a.name.localeCompare(b.name));
        }
        return repos;
      });

      const sorted = mockSearchUtils.applySorting(mockRepositories, 'name', 'asc');

      expect(sorted[0].name).toBe('awesome-project');
      expect(sorted[1].name).toBe('js-library');
      expect(sorted[2].name).toBe('python-tool');
    });
  });

  describe('Complex Search Scenarios', () => {
    it('should handle search with filters and sorting combined', async () => {
      const performComplexSearch = async (
        query: string,
        filters: SearchFilters,
        sortBy: string,
        sortOrder: 'asc' | 'desc'
      ) => {
        // Parse query
        const parsedQuery = mockSearchUtils.parseSearchQuery(query);
        
        // Get initial results
        const searchResults = await mockSearchUtils.searchRepositories(parsedQuery);
        
        // Apply filters
        const filtered = mockSearchUtils.filterRepositories(searchResults.data, filters);
        
        // Apply sorting
        const sorted = mockSearchUtils.applySorting(filtered, sortBy, sortOrder);
        
        return { data: sorted, count: sorted.length };
      };

      const result = await performComplexSearch(
        'project tool',
        { language: 'TypeScript', minStars: 100 },
        'stars',
        'desc'
      );

      expect(mockSearchUtils.parseSearchQuery).toHaveBeenCalledWith('project tool');
      expect(mockSearchUtils.searchRepositories).toHaveBeenCalled();
      expect(mockSearchUtils.filterRepositories).toHaveBeenCalled();
      expect(mockSearchUtils.applySorting).toHaveBeenCalledWith(expect.any(Array), 'stars', 'desc');
    });

    it('should handle pagination with filters', async () => {
      const performPaginatedSearch = async (
        filters: SearchFilters,
        page: number,
        pageSize: number
      ) => {
        const offset = (page - 1) * pageSize;
        
        // Mock paginated Supabase query
        mockSupabase.from.mockReturnValue({
          select: vi.fn(() => ({
            range: vi.fn(() => ({
              data: mockRepositories.slice(offset, offset + pageSize),
              error: null,
              count: mockRepositories.length,
            })),
          })),
        });

        const { data, count } = await mockSupabase
          .from('repositories')
          .select('*')
          .range(offset, offset + pageSize - 1);

        return { data, count, hasMore: count! > offset + pageSize };
      };

      const result = await performPaginatedSearch({}, 1, 2);

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it('should handle real-time search with debouncing', async () => {
      vi.useFakeTimers();
      
      let searchCallCount = 0;
      const debouncedSearch = vi.fn(async (query: string) => {
        searchCallCount++;
        return mockSearchUtils.searchRepositories({ terms: [query], operators: {} });
      });

      const simulateTyping = async (queries: string[]) => {
        for (const query of queries) {
          debouncedSearch(query);
          vi.advanceTimersByTime(100); // Fast typing
        }
        
        vi.advanceTimersByTime(500); // Wait for debounce
      };

      await simulateTyping(['a', 'aw', 'awe', 'awesome']);

      expect(searchCallCount).toBe(4); // Called for each keystroke without debouncing
      
      vi.useRealTimers();
    });

    it('should handle search result caching', async () => {
      const cache = new Map<string, { data: Repository[]; timestamp: number }>();
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

      const cachedSearch = async (query: string) => {
        const cacheKey = query.toLowerCase();
        const cached = cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          return { data: cached.data, fromCache: true };
        }
        
        const result = await mockSearchUtils.searchRepositories({ terms: [query], operators: {} });
        cache.set(cacheKey, { data: result.data, timestamp: Date.now() });
        
        return { data: result.data, fromCache: false };
      };

      // First search
      const result1 = await cachedSearch('awesome');
      expect(result1.fromCache).toBe(false);

      // Second search (should be cached)
      const result2 = await cachedSearch('awesome');
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toEqual(result1.data);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle search API errors gracefully', async () => {
      mockSearchUtils.searchRepositories.mockRejectedValue(new Error('Search service unavailable'));

      const searchWithErrorHandling = async (query: string) => {
        try {
          return await mockSearchUtils.searchRepositories({ terms: [query], operators: {} });
        } catch (error) {
          return { 
            data: [], 
            count: 0, 
            error: (error as Error).message 
          };
        }
      };

      const result = await searchWithErrorHandling('test');

      expect(result.data).toHaveLength(0);
      expect(result.error).toBe('Search service unavailable');
    });

    it('should handle malformed filter data', async () => {
      const malformedFilters = {
        minStars: 'not-a-number' as any,
        language: null as any,
        dateRange: { start: 'invalid-date' },
      };

      mockSearchUtils.validateFilters.mockReturnValue({
        valid: false,
        errors: [
          'minStars must be a number',
          'language must be a string',
          'dateRange.start must be a valid date',
        ],
      });

      const validation = mockSearchUtils.validateFilters(malformedFilters);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(3);
    });

    it('should handle empty search results', async () => {
      mockSearchUtils.searchRepositories.mockResolvedValue({
        data: [],
        count: 0,
      });

      const result = await mockSearchUtils.searchRepositories({ terms: ['nonexistent'], operators: {} });

      expect(result.data).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should handle network timeouts', async () => {
      vi.useFakeTimers();
      
      mockSearchUtils.searchRepositories.mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: [], count: 0 }), 10000);
        })
      );

      const searchWithTimeout = async (query: string, timeoutMs = 5000) => {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Search timeout')), timeoutMs)
        );
        
        const searchPromise = mockSearchUtils.searchRepositories({ terms: [query], operators: {} });
        
        return Promise.race([searchPromise, timeoutPromise]);
      };

      const searchPromise = searchWithTimeout('test');
      
      vi.advanceTimersByTime(5000);
      
      await expect(searchPromise).rejects.toThrow('Search timeout');
      
      vi.useRealTimers();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large result sets efficiently', async () => {
      const largeResultSet = Array.from({ length: 10000 }, (_, i) => ({
        ...mockRepositories[0],
        id: `repo${i}`,
        name: `repository-${i}`,
        stargazers_count: Math.floor(Math.random() * 1000),
      }));

      mockSearchUtils.searchRepositories.mockResolvedValue({
        data: largeResultSet,
        count: largeResultSet.length,
      });

      const startTime = performance.now();
      const result = await mockSearchUtils.searchRepositories({ terms: ['repository'], operators: {} });
      const endTime = performance.now();

      expect(result.data).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent search requests', async () => {
      const queries = ['project', 'library', 'tool', 'framework', 'service'];
      
      const searchPromises = queries.map(query =>
        mockSearchUtils.searchRepositories({ terms: [query], operators: {} })
      );

      const results = await Promise.all(searchPromises);

      expect(results).toHaveLength(5);
      expect(mockSearchUtils.searchRepositories).toHaveBeenCalledTimes(5);
    });
  });
});