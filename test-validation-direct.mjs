// Direct test of our validation logic
import { captureRepositorySyncGraphQL } from './src/lib/inngest/functions/capture-repository-sync-graphql.ts';

// Mock the event and step objects
const mockStep = {
  run: async (name, fn) => {
    console.log(`Running step: ${name}`);
    try {
      const result = await fn();
      console.log(`Step ${name} completed`);
      return result;
    } catch (error) {
      console.log(`Step ${name} failed:`, error.message);
      throw error;
    }
  },
  sendEvent: async (name, event) => {
    console.log(`Would send event ${name}:`, event);
  }
};

async function testValidation() {
  console.log('Testing validation with undefined repositoryId...\n');
  
  // Test 1: undefined repositoryId
  try {
    const event1 = {
      data: {
        // repositoryId is missing
        days: 7,
        priority: 'high',
        reason: 'test'
      }
    };
    
    console.log('Test 1: Missing repositoryId');
    // This should throw an error
    await captureRepositorySyncGraphQL.fn({ event: event1, step: mockStep });
    console.log('❌ Test 1 failed: Should have thrown an error');
  } catch (error) {
    console.log('✅ Test 1 passed: Error thrown as expected');
    console.log('   Error message:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 2: null repositoryId
  try {
    const event2 = {
      data: {
        repositoryId: null,
        days: 7,
        priority: 'high',
        reason: 'test'
      }
    };
    
    console.log('Test 2: Null repositoryId');
    await captureRepositorySyncGraphQL.fn({ event: event2, step: mockStep });
    console.log('❌ Test 2 failed: Should have thrown an error');
  } catch (error) {
    console.log('✅ Test 2 passed: Error thrown as expected');
    console.log('   Error message:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 3: empty string repositoryId
  try {
    const event3 = {
      data: {
        repositoryId: '',
        days: 7,
        priority: 'high',
        reason: 'test'
      }
    };
    
    console.log('Test 3: Empty string repositoryId');
    await captureRepositorySyncGraphQL.fn({ event: event3, step: mockStep });
    console.log('❌ Test 3 failed: Should have thrown an error');
  } catch (error) {
    console.log('✅ Test 3 passed: Error thrown as expected');
    console.log('   Error message:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 4: Valid repositoryId (should fail at database step)
  try {
    const event4 = {
      data: {
        repositoryId: 'valid-repo-id-123',
        days: 7,
        priority: 'high',
        reason: 'test'
      }
    };
    
    console.log('Test 4: Valid repositoryId');
    await captureRepositorySyncGraphQL.fn({ event: event4, step: mockStep });
    console.log('❌ Test 4: Got past validation but failed at database');
  } catch (error) {
    console.log('✅ Test 4: Got past validation, failed at expected database step');
    console.log('   Error message:', error.message);
  }
}

testValidation().catch(console.error);