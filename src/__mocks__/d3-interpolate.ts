// Mock d3-interpolate to prevent ES module issues
import { vi } from 'vitest';

export const interpolate = vi.fn((_a: any, b: any) => (_t: number) => b);
export const interpolateNumber = vi.fn((_a: number, b: number) => (_t: number) => b);
export const interpolateString = vi.fn((_a: string, b: string) => () => b);
export const interpolateRgb = vi.fn(() => () => 'rgb(0,0,0)');
export const interpolateHsl = vi.fn(() => () => 'hsl(0,0%,0%)');
export const interpolateArray = vi.fn((_a: any[], b: any[]) => () => b);
export const interpolateObject = vi.fn((_a: any, b: any) => () => ({ ...b }));

export default {
  interpolate,
  interpolateNumber,
  interpolateString,
  interpolateRgb,
  interpolateHsl,
  interpolateArray,
  interpolateObject,
};
