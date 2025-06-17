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

// Mock fetch globally to avoid network requests in tests
import { setupGitHubApiMock } from './github-api';
setupGitHubApiMock();

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