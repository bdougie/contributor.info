import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VirtualizedList, WindowVirtualizedList } from '../virtualized-list';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('VirtualizedList Gap Issue', () => {
  it('VirtualizedList: should include gap in total size calculation', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const itemHeight = 100;
    const gap = 10;

    const { container } = render(
      <VirtualizedList
        items={items}
        renderItem={(item) => <div style={{ height: itemHeight }}>Item {item.id}</div>}
        itemHeight={itemHeight}
        gap={gap}
        containerClassName="test-container"
      />
    );

    const scrollContainer = container.querySelector('.test-container');
    if (scrollContainer) {
      Object.defineProperty(scrollContainer, 'getBoundingClientRect', {
        value: () => ({
          width: 500,
          height: 500,
          top: 0,
          left: 0,
          right: 500,
          bottom: 500,
        }),
      });
      Object.defineProperty(scrollContainer, 'offsetHeight', { value: 500 });
      Object.defineProperty(scrollContainer, 'offsetWidth', { value: 500 });
    }

    const innerDiv = scrollContainer?.firstElementChild as HTMLElement;
    expect(innerDiv).toBeTruthy();

    const height = innerDiv.style.height;
    const heightVal = parseInt(height || '0', 10);
    // 10 items * 100px + 9 * 10px = 1090px.
    expect(heightVal).toBe(1090);
  });

  it('WindowVirtualizedList: should include gap in total size calculation', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const itemHeight = 100;
    const gap = 10;

    const { container } = render(
      <WindowVirtualizedList
        items={items}
        renderItem={(item) => <div style={{ height: itemHeight }}>Item {item.id}</div>}
        itemHeight={itemHeight}
        gap={gap}
        className="window-item"
      />
    );

    const innerDiv = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(innerDiv).toBeTruthy();

    const height = innerDiv.style.height;
    const heightVal = parseInt(height || '0', 10);
    expect(heightVal).toBe(1090);
  });
});
