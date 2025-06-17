// Test setup file for mocking problematic dependencies
import { vi, beforeEach, afterEach } from 'vitest';

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