import { assertEquals, assert } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { Logger, createLogger } from './logger.ts';

// Mock console methods for testing
let consoleOutput: Array<{ level: string; message: unknown }> = [];

const originalConsole = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

function mockConsole() {
  consoleOutput = [];
  console.debug = (message: unknown) => consoleOutput.push({ level: 'debug', message });
  console.info = (message: unknown) => consoleOutput.push({ level: 'info', message });
  console.warn = (message: unknown) => consoleOutput.push({ level: 'warn', message });
  console.error = (message: unknown) => consoleOutput.push({ level: 'error', message });
}

function restoreConsole() {
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
}

Deno.test('Logger - logs debug messages', () => {
  mockConsole();
  
  try {
    const logger = new Logger({ function_name: 'test' });
    logger.debug('Debug message', { key: 'value' });

    assertEquals(consoleOutput.length, 1);
    assertEquals(consoleOutput[0].level, 'debug');
    
    const logEntry = JSON.parse(consoleOutput[0].message);
    assertEquals(logEntry.level, 'debug');
    assertEquals(logEntry.message, 'Debug message');
    assertEquals(logEntry.context.function_name, 'test');
    assertEquals(logEntry.data.key, 'value');
    assert(logEntry.timestamp);
  } finally {
    restoreConsole();
  }
});

Deno.test('Logger - logs info messages', () => {
  mockConsole();
  
  try {
    const logger = new Logger({ function_name: 'test' });
    logger.info('Info message', { status: 'running' });

    assertEquals(consoleOutput.length, 1);
    assertEquals(consoleOutput[0].level, 'info');
    
    const logEntry = JSON.parse(consoleOutput[0].message);
    assertEquals(logEntry.level, 'info');
    assertEquals(logEntry.message, 'Info message');
    assertEquals(logEntry.data.status, 'running');
  } finally {
    restoreConsole();
  }
});

Deno.test('Logger - logs warn messages', () => {
  mockConsole();
  
  try {
    const logger = new Logger({ function_name: 'test' });
    logger.warn('Warning message', { code: 'WARN001' });

    assertEquals(consoleOutput.length, 1);
    assertEquals(consoleOutput[0].level, 'warn');
    
    const logEntry = JSON.parse(consoleOutput[0].message);
    assertEquals(logEntry.level, 'warn');
    assertEquals(logEntry.message, 'Warning message');
    assertEquals(logEntry.data.code, 'WARN001');
  } finally {
    restoreConsole();
  }
});

Deno.test('Logger - logs error messages with Error objects', () => {
  mockConsole();
  
  try {
    const logger = new Logger({ function_name: 'test' });
    const error = new Error('Test error');
    logger.error('Error occurred', error);

    assertEquals(consoleOutput.length, 1);
    assertEquals(consoleOutput[0].level, 'error');
    
    const logEntry = JSON.parse(consoleOutput[0].message);
    assertEquals(logEntry.level, 'error');
    assertEquals(logEntry.message, 'Error occurred');
    assertEquals(logEntry.data.error.message, 'Test error');
    assertEquals(logEntry.data.error.name, 'Error');
    assert(logEntry.data.error.stack);
  } finally {
    restoreConsole();
  }
});

Deno.test('Logger - logs error messages with non-Error objects', () => {
  mockConsole();
  
  try {
    const logger = new Logger({ function_name: 'test' });
    logger.error('Error occurred', { code: 500, message: 'Server error' });

    assertEquals(consoleOutput.length, 1);
    
    const logEntry = JSON.parse(consoleOutput[0].message);
    assertEquals(logEntry.data.error.code, 500);
    assertEquals(logEntry.data.error.message, 'Server error');
  } finally {
    restoreConsole();
  }
});

Deno.test('Logger - includes context in all log entries', () => {
  mockConsole();
  
  try {
    const logger = new Logger({ 
      function_name: 'test-function',
      request_id: '123-456',
      user_id: 'user-789'
    });
    
    logger.info('Test message');

    const logEntry = JSON.parse(consoleOutput[0].message);
    assertEquals(logEntry.context.function_name, 'test-function');
    assertEquals(logEntry.context.request_id, '123-456');
    assertEquals(logEntry.context.user_id, 'user-789');
  } finally {
    restoreConsole();
  }
});

Deno.test('Logger - updateContext adds new context', () => {
  mockConsole();
  
  try {
    const logger = new Logger({ function_name: 'test' });
    logger.updateContext({ user_id: 'user-123', operation: 'sync' });
    logger.info('Updated context');

    const logEntry = JSON.parse(consoleOutput[0].message);
    assertEquals(logEntry.context.function_name, 'test');
    assertEquals(logEntry.context.user_id, 'user-123');
    assertEquals(logEntry.context.operation, 'sync');
  } finally {
    restoreConsole();
  }
});

Deno.test('Logger - child creates logger with additional context', () => {
  mockConsole();
  
  try {
    const parentLogger = new Logger({ function_name: 'parent' });
    const childLogger = parentLogger.child({ operation: 'child-op', step: 1 });
    childLogger.info('Child log');

    const logEntry = JSON.parse(consoleOutput[0].message);
    assertEquals(logEntry.context.function_name, 'parent');
    assertEquals(logEntry.context.operation, 'child-op');
    assertEquals(logEntry.context.step, 1);
  } finally {
    restoreConsole();
  }
});

Deno.test('createLogger - creates logger with function name', () => {
  const logger = createLogger('test-function');
  
  // Access the private context through logging and parsing
  mockConsole();
  
  try {
    logger.info('Test');
    const logEntry = JSON.parse(consoleOutput[0].message);
    assertEquals(logEntry.context.function_name, 'test-function');
    assert(logEntry.context.request_id);
  } finally {
    restoreConsole();
  }
});

Deno.test('createLogger - accepts custom request ID', () => {
  const logger = createLogger('test-function', 'custom-request-id');
  
  mockConsole();
  
  try {
    logger.info('Test');
    const logEntry = JSON.parse(consoleOutput[0].message);
    assertEquals(logEntry.context.function_name, 'test-function');
    assertEquals(logEntry.context.request_id, 'custom-request-id');
  } finally {
    restoreConsole();
  }
});

Deno.test('Logger - handles logging without data parameter', () => {
  mockConsole();
  
  try {
    const logger = new Logger({ function_name: 'test' });
    logger.info('Simple message');

    const logEntry = JSON.parse(consoleOutput[0].message);
    assertEquals(logEntry.message, 'Simple message');
    assertEquals(logEntry.data, undefined);
  } finally {
    restoreConsole();
  }
});