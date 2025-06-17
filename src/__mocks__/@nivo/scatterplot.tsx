// Mock @nivo/scatterplot to avoid ES module issues in tests
import { vi } from 'vitest';

export const ResponsiveScatterPlot = vi.fn(() => <div data-testid="mock-scatterplot">Mock Scatter Plot</div>);
export const ScatterPlot = vi.fn(() => <div data-testid="mock-scatterplot">Mock Scatter Plot</div>);

export default {
  ResponsiveScatterPlot,
  ScatterPlot
};