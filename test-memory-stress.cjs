#!/usr/bin/env node

// Memory stress test for LastUpdated tests
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function runTestWithMemoryLimit(iteration) {
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`\nRun ${iteration}:`);
  console.log(`Starting memory: ${startMemory.toFixed(2)} MB`);
  
  try {
    // Run test with memory limit similar to CI
    const { stdout, stderr } = await execAsync(
      'node --max-old-space-size=512 node_modules/.bin/vitest run src/components/ui/__tests__/last-updated.test.tsx',
      { 
        env: { ...process.env, NODE_ENV: 'test' },
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      }
    );
    
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    const memoryDelta = endMemory - startMemory;
    
    // Check if tests passed
    const passed = stdout.includes('Test Files  1 passed');
    console.log(`Tests passed: ${passed ? '✅' : '❌'}`);
    console.log(`Ending memory: ${endMemory.toFixed(2)} MB`);
    console.log(`Memory delta: ${memoryDelta > 0 ? '+' : ''}${memoryDelta.toFixed(2)} MB`);
    
    return { passed, memoryDelta };
  } catch (error) {
    console.error(`❌ Test failed with error:`, error.message);
    if (error.message.includes('heap out of memory')) {
      console.error('⚠️  MEMORY EXHAUSTION DETECTED!');
    }
    return { passed: false, memoryDelta: 0 };
  }
}

async function runMemoryStressTest() {
  console.log('Running memory stress test with 512MB heap limit (similar to CI)...\n');
  
  const results = [];
  const iterations = 10;
  
  for (let i = 1; i <= iterations; i++) {
    const result = await runTestWithMemoryLimit(i);
    results.push(result);
    
    if (!result.passed) {
      console.error(`\n❌ Test failed on iteration ${i}`);
      break;
    }
    
    // Force garbage collection between runs
    if (global.gc) {
      global.gc();
    }
  }
  
  // Summary
  const passedCount = results.filter(r => r.passed).length;
  const avgMemoryDelta = results
    .filter(r => r.passed)
    .reduce((sum, r) => sum + r.memoryDelta, 0) / passedCount;
  
  console.log('\n=== Summary ===');
  console.log(`Passed: ${passedCount}/${iterations} runs`);
  console.log(`Average memory delta: ${avgMemoryDelta.toFixed(2)} MB`);
  
  if (passedCount === iterations) {
    console.log('✅ All tests passed with memory constraint!');
    process.exit(0);
  } else {
    console.log('❌ Memory stress test failed');
    process.exit(1);
  }
}

// Run with --expose-gc to enable manual garbage collection
runMemoryStressTest();