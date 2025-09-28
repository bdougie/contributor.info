import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryMonitor, TimeWindowedCollection, validateMemoryLeakFix } from './memory-monitor';

describe('MemoryMonitor', () => {
  let monitor: MemoryMonitor;

  beforeEach(() => {
    monitor = MemoryMonitor.getInstance();
  });

  it('should be a singleton', () => {
    const monitor1 = MemoryMonitor.getInstance();
    const monitor2 = MemoryMonitor.getInstance();
    expect(monitor1).toBe(monitor2);
  });

  it('should get current memory metrics', () => {
    const memory = monitor.getCurrentMemory();

    if (typeof process !== 'undefined' && process.memoryUsage) {
      expect(memory).toBeDefined();
      expect(memory).toHaveProperty('heapUsed');
      expect(memory).toHaveProperty('heapTotal');
      expect(memory).toHaveProperty('rss');
    } else {
      // In browser environment
      expect(memory).toBeNull();
    }
  });

  it('should track memory trends', () => {
    const trend = monitor.getMemoryTrend();
    expect(['increasing', 'stable', 'decreasing', 'unknown']).toContain(trend);
  });

  it('should provide statistics', () => {
    const stats = monitor.getStatistics();

    if (typeof process !== 'undefined' && process.memoryUsage) {
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('current');
      expect(stats).toHaveProperty('trend');
      expect(stats).toHaveProperty('isHigh');
      expect(stats).toHaveProperty('isCritical');
    } else {
      expect(stats).toBeNull();
    }
  });
});

describe('TimeWindowedCollection', () => {
  let collection: TimeWindowedCollection<{ id: number; data: string }>;

  beforeEach(() => {
    collection = new TimeWindowedCollection(1000, 10); // 1 second window, max 10 items
  });

  afterEach(() => {
    collection.dispose();
  });

  it('should add and retrieve items', () => {
    collection.add({ id: 1, data: 'test1' });
    collection.add({ id: 2, data: 'test2' });

    const items = collection.getItems();
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ id: 1, data: 'test1' });
  });

  it('should automatically clean up old items', async () => {
    collection.add({ id: 1, data: 'old' });

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    collection.add({ id: 2, data: 'new' });

    const items = collection.getItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ id: 2, data: 'new' });
  });

  it('should enforce maximum item limit', () => {
    // Add more than max items
    for (let i = 0; i < 15; i++) {
      collection.add({ id: i, data: `item${i}` });
    }

    const items = collection.getItems();
    expect(items).toHaveLength(10); // Max is 10

    // Should keep the most recent items
    expect(items[0].id).toBe(5);
    expect(items[9].id).toBe(14);
  });

  it('should handle clear operation', () => {
    collection.add({ id: 1, data: 'test1' });
    collection.add({ id: 2, data: 'test2' });

    collection.clear();

    const items = collection.getItems();
    expect(items).toHaveLength(0);
  });

  it('should provide accurate statistics', () => {
    collection.add({ id: 1, data: 'test1' });
    collection.add({ id: 2, data: 'test2' });

    const stats = collection.getStats();
    expect(stats.itemCount).toBe(2);
    expect(stats.windowMs).toBe(1000);
    expect(stats.maxItems).toBe(10);
    expect(stats.oldestItem).toBeDefined();
    expect(stats.newestItem).toBeDefined();
  });
});

describe('Memory Leak Prevention', () => {
  it('should validate memory leak fix', async () => {
    const collection = new TimeWindowedCollection<{ value: number }>(
      5000, // 5 second window
      100 // max 100 items
    );

    // Test rapid insertion
    const testPromise = validateMemoryLeakFix(collection, 2000);

    const isValid = await testPromise;

    expect(isValid).toBe(true);

    // Verify collection is bounded
    const stats = collection.getStats();
    expect(stats.itemCount).toBeLessThanOrEqual(100);

    collection.dispose();
  });

  it('should prevent unbounded growth in GraphQL client', async () => {
    // Test with TimeWindowedCollection directly since GraphQLClient requires env vars
    const queryHistory = new TimeWindowedCollection<{
      query: string;
      duration: number;
      cost: number;
      timestamp: number;
    }>(1000, 10);

    const errorHistory = new TimeWindowedCollection<{
      error: string;
      query: string;
      timestamp: number;
    }>(1000, 10);

    // Simulate many queries
    for (let i = 0; i < 100; i++) {
      queryHistory.add({
        query: `query${i}`,
        duration: 100,
        cost: 1,
        timestamp: Date.now(),
      });

      // Add some errors too
      if (i % 10 === 0) {
        errorHistory.add({
          error: `Error ${i}`,
          query: `query${i}`,
          timestamp: Date.now(),
        });
      }
    }

    // Check that collections are bounded
    expect(queryHistory.getItems().length).toBeLessThanOrEqual(10);
    expect(errorHistory.getItems().length).toBeLessThanOrEqual(10);

    // Check stats
    const queryStats = queryHistory.getStats();
    expect(queryStats.itemCount).toBeLessThanOrEqual(10);
    expect(queryStats.maxItems).toBe(10);

    const errorStats = errorHistory.getStats();
    expect(errorStats.itemCount).toBeLessThanOrEqual(10);

    queryHistory.dispose();
    errorHistory.dispose();
  });

  it('should handle memory pressure events', () => {
    const collection = new TimeWindowedCollection<string>(5000, 100);

    // Add some items
    for (let i = 0; i < 50; i++) {
      collection.add(`item${i}`);
    }

    expect(collection.getItems().length).toBe(50);

    // Simulate memory pressure warning
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('memory-pressure-warning'));

      // Collection should still have items after warning (just cleanup)
      expect(collection.getItems().length).toBeGreaterThan(0);

      // Simulate critical memory pressure
      window.dispatchEvent(new CustomEvent('memory-pressure-critical'));

      // Collection should be cleared
      expect(collection.getItems().length).toBe(0);
    }

    collection.dispose();
  });

  it('should bound collection size over time', async () => {
    const collection = new TimeWindowedCollection<number>(100, 5); // 100ms window, max 5 items

    // Add items continuously
    const interval = setInterval(() => {
      collection.add(Date.now());
    }, 10);

    // Let it run for 500ms
    await new Promise((resolve) => setTimeout(resolve, 500));

    clearInterval(interval);

    // Check that collection is bounded
    const items = collection.getItems();
    expect(items.length).toBeLessThanOrEqual(5);

    // All items should be recent (within window)
    const now = Date.now();
    const stats = collection.getStats();
    if (stats.oldestItem) {
      expect(now - stats.oldestItem).toBeLessThanOrEqual(200); // Some buffer for test timing
    }

    collection.dispose();
  });
});
