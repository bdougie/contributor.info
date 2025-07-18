// Test setup file for mocking problematic dependencies
import { vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import '@testing-library/jest-dom';

// Create mock components
const createMockComponent = (name: string) => 
  vi.fn(({ children, ...props }) => 
    createElement('div', { 
      'data-testid': `mock-${name.toLowerCase()}`,
      ...props 
    }, children || `Mock ${name}`)
  );

// Create mock for @nivo/scatterplot components with proper types
const mockResponsiveScatterPlot = vi.fn(({ nodeComponent, data = [], ...props }: any) => {
  // Render nodes if nodeComponent and data are provided
  const nodes = data.flatMap((series: any) => 
    series.data?.map((point: any, index: number) => {
      if (nodeComponent) {
        return createElement(nodeComponent, {
          key: `${series.id}-${index}`,
          node: { data: point },
          style: {
            x: { to: () => 50 },
            y: { to: () => 50 },
            size: { to: () => 10 }
          }
        });
      }
      return null;
    }).filter(Boolean) || []
  );
  
  return createElement('div', {
    'data-testid': 'mock-responsive-scatterplot',
    'data-points': data.reduce((acc: number, series: any) => acc + (series.data?.length || 0), 0),
    ...props
  }, nodes);
});

const mockScatterPlot = vi.fn(({ nodeComponent, data = [], ...props }: any) => {
  const nodes = data.flatMap((series: any) => 
    series.data?.map((point: any, index: number) => {
      if (nodeComponent) {
        return createElement(nodeComponent, {
          key: `${series.id}-${index}`,
          node: { data: point },
          style: {
            x: { to: () => 50 },
            y: { to: () => 50 },
            size: { to: () => 10 }
          }
        });
      }
      return null;
    }).filter(Boolean) || []
  );
  
  return createElement('div', {
    'data-testid': 'mock-scatterplot',
    'data-points': data.reduce((acc: number, series: any) => acc + (series.data?.length || 0), 0),
    ...props
  }, nodes);
});

// Mock the entire features that import problematic modules
vi.mock('@/components/features/activity/contributions', () => ({
  default: createMockComponent('Contributions')
}));

vi.mock('@/components/features/activity', () => ({
  Contributions: createMockComponent('Contributions'),
  PRActivity: createMockComponent('PRActivity'),
  ActivityItem: createMockComponent('ActivityItem'),
  PRActivityFeed: createMockComponent('PRActivityFeed')
}));

// Mock @nivo/scatterplot with comprehensive mock
vi.mock('@nivo/scatterplot', () => ({
  ResponsiveScatterPlot: mockResponsiveScatterPlot,
  ScatterPlot: mockScatterPlot,
  default: mockResponsiveScatterPlot
}));

// Mock @nivo/core
vi.mock('@nivo/core', () => ({
  ResponsiveWrapper: vi.fn(({ children }) => children),
  withContainer: vi.fn((component) => component),
  SvgWrapper: createMockComponent('SvgWrapper'),
  Container: createMockComponent('Container'),
  default: vi.fn()
}));

// Mock all d3 modules that could cause ES module issues
vi.mock('d3-scale', () => ({
  scaleLinear: vi.fn(() => ({
    domain: vi.fn(() => ({ range: vi.fn() })),
    range: vi.fn(() => ({ domain: vi.fn() }))
  })),
  scaleOrdinal: vi.fn(() => ({
    domain: vi.fn(() => ({ range: vi.fn() })),
    range: vi.fn(() => ({ domain: vi.fn() }))
  })),
  default: vi.fn()
}));

vi.mock('d3-color', () => ({
  rgb: vi.fn(() => ({ toString: () => '#000000' })),
  hsl: vi.fn(() => ({ toString: () => '#000000' })),
  default: vi.fn()
}));

vi.mock('d3-format', () => ({
  format: vi.fn(() => vi.fn()),
  default: vi.fn()
}));

vi.mock('d3-time', () => ({
  timeDay: vi.fn(),
  timeMonth: vi.fn(),
  default: vi.fn()
}));

vi.mock('d3-time-format', () => ({
  timeFormat: vi.fn(() => vi.fn()),
  default: vi.fn()
}));

vi.mock('d3-array', () => ({
  extent: vi.fn(() => [0, 100]),
  max: vi.fn(() => 100),
  min: vi.fn(() => 0),
  default: vi.fn()
}));

vi.mock('d3-shape', () => ({
  line: vi.fn(() => vi.fn()),
  area: vi.fn(() => vi.fn()),
  default: vi.fn()
}));

vi.mock('d3-path', () => ({
  path: vi.fn(() => ({
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    toString: () => 'M0,0L100,100'
  })),
  default: vi.fn()
}));

// Mock d3-interpolate directly
vi.mock('d3-interpolate', () => ({
  interpolate: vi.fn(() => vi.fn()),
  interpolateNumber: vi.fn(() => vi.fn()),
  interpolateString: vi.fn(() => vi.fn()),
  default: vi.fn()
}));

// Mock Supabase client to avoid environment variable errors
vi.mock('@/lib/supabase', () => ({
  createSupabaseClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signInWithOAuth: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: [], error: null })),
      insert: vi.fn(() => ({ data: [], error: null })),
      update: vi.fn(() => ({ data: [], error: null })),
      delete: vi.fn(() => ({ data: [], error: null }))
    }))
  })),
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signInWithOAuth: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: [], error: null })),
      insert: vi.fn(() => ({ data: [], error: null })),
      update: vi.fn(() => ({ data: [], error: null })),
      delete: vi.fn(() => ({ data: [], error: null }))
    }))
  },
  debugAuthSession: vi.fn(() => Promise.resolve({ session: null, error: null }))
}));

// Mock OpenAI service to avoid real API calls
vi.mock('@/lib/llm/openai-service', () => ({
  openAIService: {
    isAvailable: vi.fn(() => false), // Return false in tests to use fallbacks
    generateHealthInsight: vi.fn(() => Promise.resolve(null)),
    generateRecommendations: vi.fn(() => Promise.resolve(null)),
    analyzePRPatterns: vi.fn(() => Promise.resolve(null))
  }
}));

// Also mock the OpenAI service class
vi.mock('../lib/llm/openai-service.ts', () => ({
  OpenAIService: vi.fn().mockImplementation(() => ({
    isAvailable: vi.fn(() => false),
    generateHealthInsight: vi.fn(() => Promise.resolve(null)),
    generateRecommendations: vi.fn(() => Promise.resolve(null)),
    analyzePRPatterns: vi.fn(() => Promise.resolve(null))
  })),
  openAIService: {
    isAvailable: vi.fn(() => false),
    generateHealthInsight: vi.fn(() => Promise.resolve(null)),
    generateRecommendations: vi.fn(() => Promise.resolve(null)),
    analyzePRPatterns: vi.fn(() => Promise.resolve(null))
  }
}));

// Mock fetch globally to avoid network requests in tests
import { setupGitHubApiMock } from './github-api';
setupGitHubApiMock();

// Global fetch mock for any missed network calls
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    json: () => Promise.resolve({ error: 'Network call blocked in tests' }),
    text: () => Promise.resolve('Network call blocked in tests')
  } as Response)
);

// Suppress console methods in tests to reduce noise
const originalConsole = { ...console };
beforeEach(() => {
  console.warn = vi.fn();
  console.error = vi.fn();
  console.log = vi.fn();
});

afterEach(() => {
  Object.assign(console, originalConsole);
  vi.clearAllMocks();
});