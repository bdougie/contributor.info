// Mock @nivo/core to avoid ES module issues in CI
import { vi } from 'vitest';
import { createElement } from 'react';

export const ResponsiveWrapper = vi.fn(({ children }) => children);
export const withContainer = vi.fn((component) => component);
export const SvgWrapper = vi.fn(({ children, ...props }) => 
  createElement('div', { 'data-testid': 'mock-svg-wrapper', ...props }, children)
);
export const Container = vi.fn(({ children, ...props }) => 
  createElement('div', { 'data-testid': 'mock-container', ...props }, children)
);

export default {
  ResponsiveWrapper,
  withContainer,
  SvgWrapper,
  Container
};