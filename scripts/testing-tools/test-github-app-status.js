// Test script for the GitHub App installation status endpoint
async function testGitHubAppStatus() {
  console.log('Testing GitHub App installation status endpoint...\n');

  const endpoints = [
    { url: 'http://localhost:8888/api/github-app/installation-status', port: 8888 },
    { url: 'http://localhost:5174/api/github-app/installation-status', port: 5174 },
  ];

  for (const endpoint of endpoints) {
    console.log(`Testing on port ${endpoint.port}:`);
    try {
      const response = await fetch(`${endpoint.url}?owner=continuedev&repo=continue`);
      console.log(`  Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        console.log('  Response:', JSON.stringify(data, null, 2));
      } else {
        console.log(`  ❌ Error: ${response.status}`);
      }
    } catch (error) {
      console.log(`  ❌ Failed to connect on port ${endpoint.port}: ${error.message}`);
    }
    console.log();
  }
}

// Run the test
testGitHubAppStatus();
