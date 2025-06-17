// Test setup file for mocking problematic dependencies
import { vi, beforeEach, afterEach } from 'vitest';

// Mock the entire features that import problematic modules
vi.mock('@/components/features/activity/contributions', () => ({
  default: vi.fn(() => 'MockContributions'),
  Contributions: vi.fn(() => 'MockContributions')
}));

vi.mock('@/components/features/activity', () => ({
  Contributions: vi.fn(() => 'MockContributions'),
  PRActivity: vi.fn(() => 'MockPRActivity'),
  ActivityItem: vi.fn(() => 'MockActivityItem'),
  PRActivityFeed: vi.fn(() => 'MockPRActivityFeed')
}));

// Mock @nivo/scatterplot to avoid d3-interpolate ES module issues
vi.mock('@nivo/scatterplot', () => ({
  ResponsiveScatterPlot: vi.fn(() => 'MockScatterPlot'),
  ScatterPlot: vi.fn(() => 'MockScatterPlot'),
  default: vi.fn(() => 'MockScatterPlot')
}));

// Mock @nivo/core to avoid ES module issues
vi.mock('@nivo/core', () => ({
  ResponsiveWrapper: vi.fn(({ children }) => children),
  withContainer: vi.fn((component) => component),
  SvgWrapper: vi.fn(() => 'MockSvgWrapper'),
  Container: vi.fn(() => 'MockContainer'),
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