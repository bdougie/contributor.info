#!/usr/bin/env node

/**
 * Social Card Speed Test
 * Tests the delivery speed of social cards from the Fly.io service
 * 
 * @fileoverview Performance testing suite for social card generation and delivery
 * @author Claude Code
 */

const baseUrl = 'https://contributor-info-social-cards.fly.dev';

const testUrls = [
  // Home card
  { name: 'Home Card', url: `${baseUrl}/social-cards/home` },
  
  // Repository cards (popular repos)
  { name: 'React Repo', url: `${baseUrl}/social-cards/repo?owner=facebook&repo=react` },
  { name: 'Vue Repo', url: `${baseUrl}/social-cards/repo?owner=vuejs&repo=vue` },
  { name: 'Angular Repo', url: `${baseUrl}/social-cards/repo?owner=angular&repo=angular` },
  { name: 'Next.js Repo', url: `${baseUrl}/social-cards/repo?owner=vercel&repo=next.js` },
  
  // User cards
  { name: 'User Card - gaearon', url: `${baseUrl}/social-cards/user?username=gaearon` },
  { name: 'User Card - tj', url: `${baseUrl}/social-cards/user?username=tj` },
  
  // Test with custom titles
  { name: 'Custom Title', url: `${baseUrl}/social-cards/home?title=Custom%20Title&subtitle=Custom%20Subtitle` },
];

/**
 * Measures the response time for a social card request
 * @async
 * @function measureRequestTime
 * @param {string} url - The URL to test
 * @returns {Promise<Object>} Response time and status information
 */
async function measureRequestTime(url) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD to test without downloading full content
      headers: {
        'User-Agent': 'Social-Card-Speed-Test'
      }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      success: response.ok,
      status: response.status,
      responseTime,
      headers: {
        cacheControl: response.headers.get('cache-control'),
        responseTimeHeader: response.headers.get('x-response-time'),
        dataSource: response.headers.get('x-data-source'),
        contentType: response.headers.get('content-type')
      }
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      success: false,
      error: error.message,
      responseTime: endTime - startTime
    };
  }
}

/**
 * Runs comprehensive speed tests for social card generation
 * @async
 * @function runSpeedTest
 * @returns {Promise<void>}
 */
async function runSpeedTest() {
  console.log('🚀 Social Card Speed Test\n');
  console.log('Testing delivery speed from:', baseUrl);
  console.log('=' * 60);
  
  const results = [];
  
  for (const test of testUrls) {
    process.stdout.write(`Testing ${test.name}... `);
    
    // Run multiple iterations for more accurate timing
    const iterations = 3;
    const timings = [];
    
    for (let i = 0; i < iterations; i++) {
      const result = await measureRequestTime(test.url);
      timings.push(result);
      
      // Add small delay between requests
      if (i < iterations - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Calculate statistics
    const responseTimes = timings.map(t => t.responseTime);
    const avgTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
    const minTime = Math.min(...responseTimes);
    const maxTime = Math.max(...responseTimes);
    
    const successfulRequests = timings.filter(t => t.success).length;
    const lastResult = timings[timings.length - 1];
    
    results.push({
      name: test.name,
      url: test.url,
      avgTime: Math.round(avgTime),
      minTime,
      maxTime,
      successRate: (successfulRequests / iterations) * 100,
      headers: lastResult.headers,
      status: lastResult.status
    });
    
    // Display result
    const status = successfulRequests === iterations ? '✅' : '❌';
    console.log(`${status} ${Math.round(avgTime)}ms (${minTime}-${maxTime}ms)`);
  }
  
  console.log('\n' + '=' * 60);
  console.log('📊 DETAILED RESULTS\n');
  
  // Sort by average response time
  results.sort((a, b) => a.avgTime - b.avgTime);
  
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}`);
    console.log(`   URL: ${result.url}`);
    console.log(`   Response Time: ${result.avgTime}ms (min: ${result.minTime}ms, max: ${result.maxTime}ms)`);
    console.log(`   Success Rate: ${result.successRate}%`);
    if (result.headers) {
      console.log(`   Cache Control: ${result.headers.cacheControl || 'None'}`);
      console.log(`   Data Source: ${result.headers.dataSource || 'Unknown'}`);
      console.log(`   Server Response Time: ${result.headers.responseTimeHeader || 'Not reported'}`);
    }
    console.log('');
  });
  
  // Summary statistics
  const avgResponseTime = results.reduce((sum, r) => sum + r.avgTime, 0) / results.length;
  const fastestCard = results[0];
  const slowestCard = results[results.length - 1];
  const overallSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
  
  console.log('=' * 60);
  console.log('📈 SUMMARY STATISTICS\n');
  console.log(`Average Response Time: ${Math.round(avgResponseTime)}ms`);
  console.log(`Fastest Card: ${fastestCard.name} (${fastestCard.avgTime}ms)`);
  console.log(`Slowest Card: ${slowestCard.name} (${slowestCard.avgTime}ms)`);
  console.log(`Overall Success Rate: ${overallSuccessRate.toFixed(1)}%`);
  
  // Performance assessment
  console.log('\n🎯 PERFORMANCE ASSESSMENT\n');
  
  if (avgResponseTime < 200) {
    console.log('🟢 EXCELLENT: Average response time under 200ms');
  } else if (avgResponseTime < 500) {
    console.log('🟡 GOOD: Average response time under 500ms');
  } else if (avgResponseTime < 1000) {
    console.log('🟠 FAIR: Average response time under 1 second');
  } else {
    console.log('🔴 POOR: Average response time over 1 second');
  }
  
  if (overallSuccessRate === 100) {
    console.log('🟢 EXCELLENT: 100% success rate');
  } else if (overallSuccessRate >= 95) {
    console.log('🟡 GOOD: 95%+ success rate');
  } else {
    console.log('🔴 POOR: Success rate below 95%');
  }
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS\n');
  
  if (avgResponseTime > 300) {
    console.log('- Consider implementing CDN caching for faster delivery');
    console.log('- Review database query performance for data fetching');
  }
  
  const cacheHeaders = results.filter(r => r.headers?.cacheControl?.includes('max-age'));
  if (cacheHeaders.length < results.length) {
    console.log('- Ensure all responses have proper cache headers');
  }
  
  if (overallSuccessRate < 100) {
    console.log('- Investigate failed requests and improve error handling');
  }
  
  console.log('\nTest completed! 🎉');
}

// Test with network timing if available
async function testWithNetworkTiming() {
  if (typeof performance !== 'undefined' && performance.getEntriesByType) {
    console.log('\n🔬 DETAILED NETWORK TIMING ANALYSIS\n');
    
    const testUrl = `${baseUrl}/social-cards/repo?owner=facebook&repo=react`;
    
    // Clear existing entries
    if (performance.clearResourceTimings) {
      performance.clearResourceTimings();
    }
    
    const startTime = performance.now();
    
    try {
      const response = await fetch(testUrl);
      const endTime = performance.now();
      
      // Get network timing data
      const entries = performance.getEntriesByType('resource')
        .filter(entry => entry.name.includes('contributor-info-social-cards'));
      
      if (entries.length > 0) {
        const entry = entries[entries.length - 1];
        
        console.log('Network Timing Breakdown:');
        console.log(`- DNS Lookup: ${(entry.domainLookupEnd - entry.domainLookupStart).toFixed(2)}ms`);
        console.log(`- TCP Connection: ${(entry.connectEnd - entry.connectStart).toFixed(2)}ms`);
        console.log(`- SSL Handshake: ${(entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : 0).toFixed(2)}ms`);
        console.log(`- Request/Response: ${(entry.responseStart - entry.requestStart).toFixed(2)}ms`);
        console.log(`- Response Download: ${(entry.responseEnd - entry.responseStart).toFixed(2)}ms`);
        console.log(`- Total Time: ${(entry.responseEnd - entry.requestStart).toFixed(2)}ms`);
      }
    } catch (error) {
      console.log('Network timing analysis failed:', error.message);
    }
  }
}

// Run the tests
runSpeedTest()
  .then(() => testWithNetworkTiming())
  .catch(console.error);