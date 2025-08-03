# Testing Documentation

This directory contains testing strategies, guidelines, and documentation for contributor.info quality assurance.

## Purpose

Testing documentation helps developers:
- **Maintain code quality** - Ensure reliability and correctness
- **Prevent regressions** - Catch issues before they reach production
- **Document test strategies** - Share testing approaches and patterns
- **Improve test efficiency** - Optimize test execution and maintenance

## Documentation Index

### 🎨 Visual Testing
- **[Chromatic README](./chromatic-readme.md)** - Visual regression testing with Chromatic

### 🏗️ Testing Philosophy
- **[E2E Minimal Testing Philosophy](./e2e-minimal-testing-philosophy.md)** - Pragmatic end-to-end testing approach

### 📊 Performance & Monitoring
- **[Performance Monitoring](./performance-monitoring.md)** - Performance testing and monitoring strategies

### 🚀 Release & Deployment
- **[Release Process](./release-process.md)** - Testing as part of release workflow

## Testing Strategy Overview

### Testing Pyramid

```
    /\        E2E Tests (Few)
   /  \       - Critical user journeys
  /____\      - Cross-browser testing
 /      \     - Production-like environment
/_______\     
          \   Integration Tests (Some)
           \  - API endpoints
            \ - Database operations
             \- Component interactions
              \
               \  Unit Tests (Many)
                \ - Pure functions
                 \- Component logic
                  \- Utilities and helpers
```

### Test Types & Coverage

#### Unit Tests (80% of tests)
- **Purpose**: Test individual functions and components in isolation
- **Tools**: Vitest, React Testing Library
- **Coverage**: >90% for utility functions, >80% for components
- **Execution**: Fast (<1s per test), run on every commit

#### Integration Tests (15% of tests)
- **Purpose**: Test feature workflows and API interactions
- **Tools**: Vitest, MSW (Mock Service Worker)
- **Coverage**: Critical user paths, API integrations
- **Execution**: Medium speed (~5s per test), run on PR

#### End-to-End Tests (5% of tests)
- **Purpose**: Test complete user journeys in real browsers
- **Tools**: Playwright, Chromatic
- **Coverage**: Core functionality, critical business flows
- **Execution**: Slow (30s+ per test), run on deployment

## Testing Setup & Configuration

### Vitest Configuration
```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*'
      ],
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

### Test Environment Setup
```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockResolvedValue({ data: [], error: null }),
      delete: vi.fn().mockResolvedValue({ data: [], error: null })
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
    }
  }))
}));

// Mock GitHub API
vi.mock('../lib/github', () => ({
  fetchContributors: vi.fn().mockResolvedValue([]),
  fetchRepositories: vi.fn().mockResolvedValue([])
}));
```

## Testing Patterns & Best Practices

### Component Testing Pattern
```typescript
// Component test example
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContributorCard } from './ContributorCard';

describe('ContributorCard', () => {
  const mockContributor = {
    id: '1',
    username: 'testuser',
    avatar_url: 'https://github.com/testuser.avatar',
    contributions: 42
  };

  it('renders contributor information', () => {
    render(<ContributorCard contributor={mockContributor} />);
    
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('42 contributions')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', mockContributor.avatar_url);
  });

  it('handles click events', async () => {
    const onClickMock = vi.fn();
    render(<ContributorCard contributor={mockContributor} onClick={onClickMock} />);
    
    fireEvent.click(screen.getByText('testuser'));
    
    await waitFor(() => {
      expect(onClickMock).toHaveBeenCalledWith(mockContributor);
    });
  });
});
```

### Hook Testing Pattern
```typescript
// Custom hook test example
import { renderHook, waitFor } from '@testing-library/react';
import { useContributors } from './useContributors';

describe('useContributors', () => {
  it('fetches contributors successfully', async () => {
    const { result } = renderHook(() => useContributors('owner/repo'));
    
    expect(result.current.loading).toBe(true);
    expect(result.current.contributors).toEqual([]);
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.contributors).toHaveLength(0);
    });
  });

  it('handles errors gracefully', async () => {
    // Mock API error
    vi.mocked(fetchContributors).mockRejectedValueOnce(new Error('API Error'));
    
    const { result } = renderHook(() => useContributors('owner/repo'));
    
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });
  });
});
```

### API Testing Pattern
```typescript
// API integration test example
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { fetchContributors } from '../lib/github';

const server = setupServer(
  http.get('https://api.github.com/repos/*/contributors', () => {
    return HttpResponse.json([
      { login: 'user1', contributions: 100 },
      { login: 'user2', contributions: 50 }
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('GitHub API Integration', () => {
  it('fetches contributors from GitHub API', async () => {
    const contributors = await fetchContributors('owner/repo');
    
    expect(contributors).toHaveLength(2);
    expect(contributors[0]).toEqual({
      login: 'user1',
      contributions: 100
    });
  });

  it('handles API errors', async () => {
    server.use(
      http.get('https://api.github.com/repos/*/contributors', () => {
        return HttpResponse.error();
      })
    );
    
    await expect(fetchContributors('owner/repo')).rejects.toThrow();
  });
});
```

## Visual Testing with Chromatic

### Storybook Integration
```typescript
// Component story for visual testing
import type { Meta, StoryObj } from '@storybook/react';
import { ContributorCard } from './ContributorCard';

const meta: Meta<typeof ContributorCard> = {
  title: 'Components/ContributorCard',
  component: ContributorCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    contributor: {
      id: '1',
      username: 'octocat',
      avatar_url: 'https://github.com/octocat.png',
      contributions: 1337
    }
  }
};

export const Loading: Story = {
  args: {
    ...Default.args,
    loading: true
  }
};

export const WithError: Story = {
  args: {
    ...Default.args,
    error: 'Failed to load contributor data'
  }
};
```

### Visual Regression Testing
- Automatic visual regression detection
- Cross-browser compatibility testing
- Component isolation testing
- Design system validation

## Performance Testing

### Performance Monitoring Strategy
```typescript
// Performance test example
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  it('renders large contributor list efficiently', async () => {
    const contributors = Array.from({ length: 1000 }, (_, i) => ({
      id: i.toString(),
      username: `user${i}`,
      avatar_url: `https://github.com/user${i}.png`,
      contributions: Math.floor(Math.random() * 1000)
    }));

    const startTime = performance.now();
    
    render(<ContributorList contributors={contributors} />);
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should render within 500ms
    expect(renderTime).toBeLessThan(500);
  });
});
```

### Memory Leak Testing
```typescript
// Memory leak detection
describe('Memory Leak Tests', () => {
  it('does not leak memory on component unmount', () => {
    const { unmount } = render(<ContributorCard contributor={mockContributor} />);
    
    // Measure memory before unmount
    const memoryBefore = performance.memory?.usedJSHeapSize || 0;
    
    unmount();
    
    // Force garbage collection (if available)
    if (global.gc) {
      global.gc();
    }
    
    // Measure memory after unmount
    const memoryAfter = performance.memory?.usedJSHeapSize || 0;
    
    // Memory usage should not increase significantly
    expect(memoryAfter - memoryBefore).toBeLessThan(1024 * 1024); // 1MB threshold
  });
});
```

## Test Data Management

### Mock Data Factory
```typescript
// Test data factory
export const createMockContributor = (overrides: Partial<Contributor> = {}): Contributor => ({
  id: faker.datatype.uuid(),
  username: faker.internet.userName(),
  avatar_url: faker.internet.avatar(),
  contributions: faker.datatype.number({ min: 1, max: 1000 }),
  html_url: faker.internet.url(),
  ...overrides
});

export const createMockRepository = (overrides: Partial<Repository> = {}): Repository => ({
  id: faker.datatype.uuid(),
  name: faker.lorem.word(),
  full_name: `${faker.internet.userName()}/${faker.lorem.word()}`,
  description: faker.lorem.sentence(),
  stargazers_count: faker.datatype.number({ min: 0, max: 10000 }),
  ...overrides
});
```

### Database Testing
```typescript
// Database test utilities
export const setupTestDatabase = async () => {
  // Create test database connection
  const testDb = createClient(TEST_DATABASE_URL, TEST_DATABASE_KEY);
  
  // Clear test data
  await testDb.from('contributors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await testDb.from('repositories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  return testDb;
};

export const teardownTestDatabase = async (testDb: SupabaseClient) => {
  // Clean up test data
  await testDb.from('contributors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await testDb.from('repositories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
};
```

## Continuous Integration Testing

### GitHub Actions Test Workflow
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage
      - run: npm run build
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Test Reporting
- Coverage reports via Codecov
- Visual regression reports via Chromatic
- Performance regression tracking
- Test result notifications

## Test Maintenance

### Regular Test Maintenance Tasks
- **Remove obsolete tests** - Clean up tests for removed features
- **Update test data** - Keep mock data current with schema changes
- **Optimize slow tests** - Improve test performance and reliability
- **Review test coverage** - Ensure adequate coverage for new code

### Test Quality Metrics
- **Test coverage** - Aim for >80% line coverage
- **Test execution time** - Keep test suite under 5 minutes
- **Test reliability** - <1% flaky test rate
- **Maintenance burden** - Low test-to-code ratio

## Related Documentation

- [Setup Documentation](../setup/) - Test environment setup
- [Implementation Guides](../implementations/) - Feature-specific testing
- [Debugging Documentation](../debugging/) - Test debugging techniques
- [Performance Monitoring](./performance-monitoring.md) - Performance testing details

---

**Testing Philosophy**: Write tests that give you confidence to refactor and deploy. Focus on testing behavior, not implementation details.