// Test Dub.co functionality
import { createChartShareUrl, getDubConfig } from './src/lib/dub.ts';

async function testDubFunctionality() {
  console.log('Testing Dub.co functionality...\n');

  // 1. Test configuration
  console.log('1. Testing configuration:');
  const config = getDubConfig();
  console.log('- Environment:', config.isDev ? 'Development' : 'Production');
  console.log('- Domain:', config.domain);
  console.log('- Has API Key:', config.hasApiKey);
  console.log('- API Key from env:', !!process.env.VITE_DUB_CO_KEY);
  console.log();

  // 2. Test URL shortening
  console.log('2. Testing URL shortening:');
  try {
    const testUrl = 'https://contributor.info/facebook/react';
    console.log('- Original URL:', testUrl);
    
    const shortUrl = await createChartShareUrl(
      testUrl,
      'distribution-chart',
      'facebook/react'
    );
    
    console.log('- Short URL:', shortUrl);
    console.log('- Success:', shortUrl !== testUrl ? '✅ URL was shortened' : '⚠️ URL not shortened (dev mode or no API key)');
  } catch (error) {
    console.error('- Error:', error.message);
  }
  console.log();

  // 3. Test with various URLs
  console.log('3. Testing various URL patterns:');
  const testUrls = [
    'https://contributor.info/',
    'https://contributor.info/facebook/react',
    'https://contributor.info/user/gaearon',
    'https://localhost:5174/facebook/react'
  ];

  for (const url of testUrls) {
    try {
      const result = await createChartShareUrl(url, 'test-chart');
      console.log(`- ${url}: ${result === url ? 'Original' : 'Shortened'}`);
    } catch (error) {
      console.log(`- ${url}: Error - ${error.message}`);
    }
  }
  console.log();

  // 4. Test environment variables
  console.log('4. Environment variables check:');
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- VITE_DUB_CO_KEY present:', !!process.env.VITE_DUB_CO_KEY);
  if (process.env.VITE_DUB_CO_KEY) {
    console.log('- VITE_DUB_CO_KEY format valid:', process.env.VITE_DUB_CO_KEY.startsWith('dub_'));
  }
  console.log();

  console.log('Test completed!');
}

// Run the test
testDubFunctionality().catch(console.error);