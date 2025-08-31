/**
 * No-mock setup - Only sets up absolutely essential test utilities
 * All tests requiring mocks should be skipped
 */
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Mock Path2D for uPlot (not available in jsdom)
global.Path2D = class Path2D {
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  bezierCurveTo = vi.fn();
  quadraticCurveTo = vi.fn();
  arc = vi.fn();
  arcTo = vi.fn();
  ellipse = vi.fn();
  rect = vi.fn();
  addPath = vi.fn();
};

// Mock matchMedia for uPlot (required for chart components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock HTMLCanvasElement.getContext for uPlot charts
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(() => {}), // Support Path2D parameter
  fill: vi.fn(() => {}), // Support Path2D parameter
  arc: vi.fn(),
  closePath: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  setTransform: vi.fn(),
  setLineDash: vi.fn(), // Added for uPlot compatibility
  clip: vi.fn(), // Added for uPlot clipping support
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  canvas: { width: 100, height: 100 },
}));

// Only cleanup DOM after each test, no mocks
afterEach(() => {
  cleanup();
});
