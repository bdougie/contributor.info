// Mock @react-spring/web to prevent ES module issues
import { vi } from 'vitest';
import { createElement } from 'react';

export const animated = new Proxy(
  {},
  {
    get(_target, prop) {
      return vi.fn(
        ({
          children,
          style,
          ...props
        }: {
          children?: React.ReactNode;
          style?: Record<string, unknown>;
          [key: string]: unknown;
        }) => {
          // Convert animated style to regular style
          const processedStyle: Record<string, unknown> = {};
          if (style) {
            Object.keys(style).forEach((key) => {
              const value = style[key];
              processedStyle[key] = typeof value?.to === 'function' ? value.to(1) : value;
            });
          }

          return createElement(
            prop as string,
            {
              ...props,
              style: processedStyle,
            },
            children,
          );
        },
      );
    },
  },
);

export const useSpring = vi.fn(() => ({}));
export const useTransition = vi.fn(() => []);
export const config = {
  default: { tension: 170, friction: 26 },
  gentle: { tension: 120, friction: 14 },
  wobbly: { tension: 180, friction: 12 },
  stiff: { tension: 210, friction: 20 },
  slow: { tension: 280, friction: 60 },
  molasses: { tension: 280, friction: 120 },
};

export default {
  animated,
  useSpring,
  useTransition,
  config,
};
