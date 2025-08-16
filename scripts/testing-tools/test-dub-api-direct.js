#!/usr/bin/env node

/**
 * Direct Dub.co API Test
 * Tests the dub.co API directly without imports to validate URL shortening functionality
 * 
 * @fileoverview Comprehensive testing suite for dub.co API integration
 * @author Claude Code
 */

const DUB_API_KEY = process.env.VITE_DUB_CO_KEY;
const DOMAIN = process.env.NODE_ENV === 'production' ? "oss.fyi" : "dub.sh";

/**
 * Main test function for dub.co API functionality
 * @async
 * @function testDubAPI
 * @returns {Promise<void>}
 */
async function testDubAPI() {
  console.log('🔗 Direct Dub.co API Test\n');
  
  console.log('Configuration:');
  console.log('- API Key present:', !!DUB_API_KEY);
  console.log('- API Key format:', DUB_API_KEY ? (DUB_API_KEY.startsWith('dub_') ? 'Valid' : 'Invalid') : 'N/A');
  console.log('- Domain:', DOMAIN);
  console.log('- Environment:', process.env.NODE_ENV || 'development');
  console.log();

  if (!DUB_API_KEY) {
    console.log('❌ No DUB_API_KEY found. Please set VITE_DUB_CO_KEY environment variable.');
    console.log('\nTo test:');
    console.log('export VITE_DUB_CO_KEY="your_dub_api_key"');
    console.log('node test-dub-api-direct.js');
    return;
  }

  // Test URL shortening
  console.log('Testing URL shortening...');
  
  const testUrl = 'https://contributor.info/facebook/react';
  const customKey = 'facebook/react';
  
  try {
    const response = await fetch('https://api.dub.co/links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: testUrl,
        domain: DOMAIN,
        key: customKey,
        title: 'Distribution Chart for facebook/react',
        description: 'Interactive distribution chart showing metrics for facebook/react repository',
        rewrite: false,
        utmSource: "contributor-info",
        utmMedium: "chart-share",
        utmCampaign: "social-sharing"
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
      
      // Check if it's a conflict (link already exists)
      if (response.status === 409) {
        console.log('⚠️ Link already exists - this is expected for repeated tests');
        
        // Try to get the existing link
        try {
          const getResponse = await fetch(`https://api.dub.co/links?domain=${DOMAIN}&key=${customKey}`, {
            headers: {
              'Authorization': `Bearer ${DUB_API_KEY}`,
            },
          });
          
          if (getResponse.ok) {
            const existingLinks = await getResponse.json();
            console.log('✅ Found existing link:', existingLinks[0]?.shortLink || 'Not found');
          }
        } catch (getError) {
          console.log('Error fetching existing link:', getError.message);
        }
      }
    } else {
      const data = await response.json();
      console.log('✅ Success!');
      console.log('- Short URL:', data.shortLink);
      console.log('- Original URL:', data.url);
      console.log('- Domain:', data.domain);
      console.log('- Key:', data.key);
      console.log('- Created:', data.createdAt);
      console.log('- UTM Source:', data.utmSource);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Check if dub.co API is accessible from your network');
    } else if (error.code === 'ENOTFOUND') {
      console.error('💡 DNS resolution failed - check your internet connection');
    }
  }

  console.log('\n---\n');

  // Test analytics endpoint
  console.log('Testing analytics access...');
  
  try {
    const analyticsResponse = await fetch('https://api.dub.co/analytics', {
      headers: {
        'Authorization': `Bearer ${DUB_API_KEY}`,
      },
    });

    console.log('Analytics response status:', analyticsResponse.status);
    
    if (analyticsResponse.ok) {
      const analyticsData = await analyticsResponse.json();
      console.log('✅ Analytics access working');
      console.log('- Total clicks:', analyticsData.length || 'No data');
    } else {
      const errorText = await analyticsResponse.text();
      console.log('❌ Analytics error:', errorText);
    }
  } catch (error) {
    console.error('❌ Analytics error:', error.message);
    console.error('💡 Analytics may require different API permissions');
  }

  console.log('\n---\n');

  // Test speed performance
  console.log('Testing API speed performance...');
  
  const speedTests = [
    { name: 'Simple link creation', key: 'speed-test-1' },
    { name: 'Link with UTM params', key: 'speed-test-2' },
    { name: 'Link with long description', key: 'speed-test-3' }
  ];

  for (const test of speedTests) {
    const startTime = Date.now();
    
    try {
      const speedResponse = await fetch('https://api.dub.co/links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DUB_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `https://contributor.info/test-${Date.now()}`,
          domain: DOMAIN,
          key: `${test.key}-${Date.now()}`,
          title: test.name,
          description: test.name === 'Link with long description' ? 
            'This is a very long description to test how the API handles longer text content and whether it affects performance significantly' : 
            'Short description',
          rewrite: true // Allow overwriting for speed tests
        }),
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      if (speedResponse.ok) {
        console.log(`✅ ${test.name}: ${responseTime}ms`);
      } else {
        console.log(`❌ ${test.name}: Failed in ${responseTime}ms`);
      }
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      console.log(`❌ ${test.name}: Error in ${responseTime}ms - ${error.message}`);
    }
  }

  console.log('\nTest completed! 🎉');
}

testDubAPI().catch(console.error);