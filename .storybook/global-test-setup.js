// Global setup for Storybook tests
module.exports = async () => {
  // Set up environment variables
  process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
  process.env.VITE_SUPABASE_ANON_KEY = 'mock-anon-key';
  process.env.NODE_ENV = 'test';
  
  // Increase timeout for CI environments
  if (process.env.CI) {
    jest.setTimeout(60000);
  }
  
  console.log('🔧 Storybook test environment initialized');
};