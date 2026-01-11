// Mock d3-interpolate to prevent ES module issues
import { vi } from 'vitest';

export const interpolate = vi.fn(
  <T>(a: T, b: T) =>
    () =>
      b
);
export const interpolateNumber = vi.fn((a: number, b: number) => () => b);
export const interpolateString = vi.fn((a: string, b: string) => () => b);
export const interpolateRgb = vi.fn(() => () => 'rgb(0,0,0)');
export const interpolateHsl = vi.fn(() => () => 'hsl(0,0%,0%)');
export const interpolateArray = vi.fn(
  <T>(a: T[], b: T[]) =>
    () =>
      b
);
export const interpolateObject = vi.fn(<T extends object>(a: T, b: T) => () => ({ ...b }));

export default {
  interpolate,
  interpolateNumber,
  interpolateString,
  interpolateRgb,
  interpolateHsl,
  interpolateArray,
  interpolateObject,
};
