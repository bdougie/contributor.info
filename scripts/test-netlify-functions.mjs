#!/usr/bin/env node

console.log('Testing Netlify Functions locally...\n');

const endpoints = [
  { name: 'Hello', url: 'http://localhost:8888/api/hello' },
  { name: 'Inngest Status', url: 'http://localhost:8888/api/inngest' },
  { name: 'Health Check', url: 'http://localhost:8888/api/health' },
  { name: 'Direct Function', url: 'http://localhost:8888/.netlify/functions/hello' },
  { name: 'Direct Inngest', url: 'http://localhost:8888/.netlify/functions/inngest-prod' }
];

for (const endpoint of endpoints) {
  console.log(`Testing ${endpoint.name}: ${endpoint.url}`);
  try {
    const response = await fetch(endpoint.url);
    console.log(`  Status: ${response.status}`);
    
    const contentType = response.headers.get('content-type');
    console.log(`  Content-Type: ${contentType}`);
    
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      console.log(`  ✅ JSON Response:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
    } else if (contentType?.includes('text/html')) {
      console.log(`  ⚠️  HTML Response (probably the SPA, not the function)`);
    } else {
      const text = await response.text();
      console.log(`  Response preview:`, text.substring(0, 100) + '...');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  console.log('');
}

console.log('\nDiagnostics:');
console.log('- If you\'re getting HTML responses, the functions might not be loaded');
console.log('- Check the Netlify Dev console for any error messages');
console.log('- Make sure you ran: netlify dev');
console.log('- The functions should be available at /.netlify/functions/*');