import { inngest } from '../src/lib/inngest/client.js';

console.log('Testing repository sync fix...\n');

// Test data similar to what's being sent
const testEvent = {
  name: 'capture/repository.sync.graphql',
  data: {
    jobId: 'test-job-' + Date.now(),
    repositoryId: '98b0e461-ea5c-4916-99c0-402fbff5950a', // continuedev/continue
    repositoryName: 'continuedev/continue',
    days: 1, // This was missing before the fix
    maxItems: 50,
    priority: 'medium',
    reason: 'test-fix'
  }
};

console.log('Event data being sent:');
console.log(JSON.stringify(testEvent, null, 2));

try {
  const result = await inngest.send(testEvent);
  console.log('\n✅ Event sent successfully!');
  console.log('Result:', result);
} catch (error) {
  console.error('\n❌ Error sending event:', error.message);
  if (error.response) {
    console.error('Response status:', error.response.status);
    console.error('Response data:', await error.response.text());
  }
}