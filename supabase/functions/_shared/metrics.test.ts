import { assertEquals, assert } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { PerformanceMonitor } from './metrics.ts';

// Mock console methods for testing
let consoleOutput: Array<{ level: string; message: any }> = [];

const originalConsole = {
  info: console.info,
  warn: console.warn,
};

function mockConsole() {
  consoleOutput = [];
  console.info = (...args: any[]) => consoleOutput.push({ level: 'info', message: args });
  console.warn = (...args: any[]) => consoleOutput.push({ level: 'warn', message: args });
}

function restoreConsole() {
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
}

// Helper to wait for a short duration
function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.test('PerformanceMonitor - tracks timer lifecycle', async () => {
  mockConsole();
  
  try {
    const monitor = new PerformanceMonitor('test-function');
    
    monitor.startTimer('test-operation');
    await wait(10); // Wait a small amount of time
    const metric = monitor.endTimer('test-operation');

    assert(metric);
    assertEquals(metric.function_name, 'test-function');
    assertEquals(metric.operation, 'test-operation');
    assertEquals(metric.success, true);
    assert(metric.duration_ms >= 10);
    assert(metric.timestamp);
    
    // Should log metric
    assertEquals(consoleOutput.length, 1);
    assertEquals(consoleOutput[0].level, 'info');
    assertEquals(consoleOutput[0].message[0], 'METRIC:');
  } finally {
    restoreConsole();
  }
});

Deno.test('PerformanceMonitor - handles missing timer gracefully', () => {
  mockConsole();
  
  try {
    const monitor = new PerformanceMonitor('test-function');
    
    const metric = monitor.endTimer('non-existent-operation');
    
    assertEquals(metric, undefined);
    
    // Should log warning about missing timer
    assertEquals(consoleOutput.length, 1);
    assertEquals(consoleOutput[0].level, 'warn');
    assert(consoleOutput[0].message[0].includes('No timer found'));
  } finally {
    restoreConsole();
  }
});

Deno.test('PerformanceMonitor - warns on slow operations', async () => {
  mockConsole();
  
  try {
    const monitor = new PerformanceMonitor('test-function');
    
    // Mock performance.now to simulate slow operation
    const originalNow = performance.now;
    let callCount = 0;
    performance.now = () => {
      callCount++;
      if (callCount === 1) return 0; // start time
      return 1500; // end time (1.5 seconds later)
    };
    
    monitor.startTimer('slow-operation');
    const metric = monitor.endTimer('slow-operation');
    
    // Restore original performance.now
    performance.now = originalNow;

    assert(metric);
    assertEquals(metric.duration_ms, 1500);
    
    // Should log metric and warning
    assertEquals(consoleOutput.length, 2);
    assertEquals(consoleOutput[0].level, 'info'); // metric log
    assertEquals(consoleOutput[1].level, 'warn'); // slow operation warning
    assert(consoleOutput[1].message[0].includes('Slow operation detected'));
  } finally {
    restoreConsole();
  }
});

Deno.test('PerformanceMonitor - measure async operation success', async () => {
  mockConsole();
  
  try {
    const monitor = new PerformanceMonitor('test-function');
    
    const result = await monitor.measure('async-op', async () => {
      await wait(5);
      return 'success-result';
    });

    assertEquals(result, 'success-result');
    
    // Should log metric
    assertEquals(consoleOutput.length, 1);
    const metricLog = JSON.parse(consoleOutput[0].message[1]);
    assertEquals(metricLog.function_name, 'test-function');
    assertEquals(metricLog.operation, 'async-op');
    assertEquals(metricLog.success, true);
    assert(metricLog.duration_ms >= 5);
  } finally {
    restoreConsole();
  }
});

Deno.test('PerformanceMonitor - measure async operation failure', async () => {
  mockConsole();
  
  try {
    const monitor = new PerformanceMonitor('test-function');
    
    let thrownError;
    try {
      await monitor.measure('failing-op', async () => {
        await wait(5);
        throw new Error('Test error');
      });
    } catch (error) {
      thrownError = error;
    }

    assert(thrownError);
    assertEquals(thrownError.message, 'Test error');
    
    // Should log metric with success=false
    assertEquals(consoleOutput.length, 1);
    const metricLog = JSON.parse(consoleOutput[0].message[1]);
    assertEquals(metricLog.operation, 'failing-op');
    assertEquals(metricLog.success, false);
  } finally {
    restoreConsole();
  }
});

Deno.test('PerformanceMonitor - measureSync operation success', () => {
  mockConsole();
  
  try {
    const monitor = new PerformanceMonitor('test-function');
    
    const result = monitor.measureSync('sync-op', () => {
      return 'sync-result';
    });

    assertEquals(result, 'sync-result');
    
    // Should log metric
    assertEquals(consoleOutput.length, 1);
    const metricLog = JSON.parse(consoleOutput[0].message[1]);
    assertEquals(metricLog.function_name, 'test-function');
    assertEquals(metricLog.operation, 'sync-op');
    assertEquals(metricLog.success, true);
  } finally {
    restoreConsole();
  }
});

Deno.test('PerformanceMonitor - measureSync operation failure', () => {
  mockConsole();
  
  try {
    const monitor = new PerformanceMonitor('test-function');
    
    let thrownError;
    try {
      monitor.measureSync('failing-sync-op', () => {
        throw new Error('Sync error');
      });
    } catch (error) {
      thrownError = error;
    }

    assert(thrownError);
    assertEquals(thrownError.message, 'Sync error');
    
    // Should log metric with success=false
    assertEquals(consoleOutput.length, 1);
    const metricLog = JSON.parse(consoleOutput[0].message[1]);
    assertEquals(metricLog.operation, 'failing-sync-op');
    assertEquals(metricLog.success, false);
  } finally {
    restoreConsole();
  }
});

Deno.test('PerformanceMonitor - endTimer with custom success flag', () => {
  mockConsole();
  
  try {
    const monitor = new PerformanceMonitor('test-function');
    
    monitor.startTimer('custom-success-op');
    const metric = monitor.endTimer('custom-success-op', false);

    assert(metric);
    assertEquals(metric.success, false);
  } finally {
    restoreConsole();
  }
});

Deno.test('PerformanceMonitor - multiple concurrent timers', async () => {
  mockConsole();
  
  try {
    const monitor = new PerformanceMonitor('test-function');
    
    monitor.startTimer('op1');
    monitor.startTimer('op2');
    
    await wait(5);
    
    const metric1 = monitor.endTimer('op1');
    await wait(5);
    const metric2 = monitor.endTimer('op2');

    assert(metric1);
    assert(metric2);
    assertEquals(metric1.operation, 'op1');
    assertEquals(metric2.operation, 'op2');
    
    // metric2 should have longer duration since it was ended later
    assert(metric2.duration_ms > metric1.duration_ms);
  } finally {
    restoreConsole();
  }
});