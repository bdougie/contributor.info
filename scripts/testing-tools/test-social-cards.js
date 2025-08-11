import { chromium } from 'playwright';

// Platform validators and testing tools
const validators = {
  twitter: 'https://cards-dev.twitter.com/validator',
  facebook: 'https://developers.facebook.com/tools/debug/',
  linkedin: 'https://www.linkedin.com/post-inspector/',
  discord: 'https://discord.com/developers/docs/resources/channel#embed-object',
  slack: 'https://api.slack.com/reference/messaging/link-unfurling'
};

// Test URLs to validate
const testUrls = [
  'https://contributor.info',
  'https://contributor.info/facebook/react',
  'https://contributor.info/vercel/next.js'
];

// Meta tags to check
const requiredMetaTags = [
  'og:title',
  'og:description', 
  'og:image',
  'og:url',
  'og:type',
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image'
];

async function testMetaTags(url) {
  console.log(`\n🔍 Testing meta tags for: ${url}`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    
    const metaTags = {};
    
    // Extract meta tags
    for (const tag of requiredMetaTags) {
      const selector = `meta[property="${tag}"], meta[name="${tag}"]`;
      const element = await page.$(selector);
      
      if (element) {
        const content = await element.getAttribute('content');
        metaTags[tag] = content;
        console.log(`  ✅ ${tag}: ${content}`);
      } else {
        console.log(`  ❌ ${tag}: Missing`);
      }
    }
    
    // Test image accessibility
    if (metaTags['og:image']) {
      console.log(`\n📸 Testing image: ${metaTags['og:image']}`);
      
      try {
        const response = await page.goto(metaTags['og:image']);
        if (response.ok()) {
          const contentType = response.headers()['content-type'];
          const contentLength = response.headers()['content-length'];
          console.log(`  ✅ Image accessible: ${contentType}, ${contentLength} bytes`);
        } else {
          console.log(`  ❌ Image not accessible: ${response.status()}`);
        }
      } catch (error) {
        console.log(`  ❌ Image error: ${error.message}`);
      }
    }
    
    return metaTags;
    
  } catch (error) {
    console.error(`Error testing ${url}:`, error.message);
    return {};
  } finally {
    await browser.close();
  }
}

async function testSocialCardDimensions(imageUrl) {
  console.log(`\n📐 Testing image dimensions: ${imageUrl}`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(imageUrl);
    
    const dimensions = await page.evaluate(() => {
      const img = document.querySelector('img') || document.body;
      return {
        width: img.naturalWidth || img.offsetWidth,
        height: img.naturalHeight || img.offsetHeight
      };
    });
    
    console.log(`  📏 Dimensions: ${dimensions.width}x${dimensions.height}`);
    
    // Check if dimensions meet social platform requirements
    const isTwitterValid = dimensions.width >= 300 && dimensions.height >= 157;
    const isOGValid = dimensions.width >= 200 && dimensions.height >= 200;
    const isOptimal = dimensions.width === 1200 && dimensions.height === 630;
    
    console.log(`  ${isTwitterValid ? '✅' : '❌'} Twitter Card minimum (300x157)`);
    console.log(`  ${isOGValid ? '✅' : '❌'} Open Graph minimum (200x200)`);
    console.log(`  ${isOptimal ? '✅' : '❌'} Optimal size (1200x630)`);
    
    return dimensions;
    
  } catch (error) {
    console.error(`Error testing dimensions:`, error.message);
    return null;
  } finally {
    await browser.close();
  }
}

function generateValidatorLinks(url) {
  console.log(`\n🔗 Platform validator links for: ${url}`);
  console.log(`  Twitter: ${validators.twitter}?url=${encodeURIComponent(url)}`);
  console.log(`  Facebook: ${validators.facebook}?q=${encodeURIComponent(url)}`);
  console.log(`  LinkedIn: ${validators.linkedin}?url=${encodeURIComponent(url)}`);
  console.log('\n📝 Manual testing steps:');
  console.log('  1. Copy the URLs above and test in each validator');
  console.log('  2. Share the URL in Discord/Slack to test preview');
  console.log('  3. Verify the card displays correctly on each platform');
}

async function main() {
  console.log('🧪 Social Card Testing Suite');
  console.log('============================\n');
  
  const allResults = [];
  
  for (const url of testUrls) {
    const metaTags = await testMetaTags(url);
    allResults.push({ url, metaTags });
    
    // Test image dimensions if og:image exists
    if (metaTags['og:image']) {
      await testSocialCardDimensions(metaTags['og:image']);
    }
    
    // Generate validator links
    generateValidatorLinks(url);
  }
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('===============');
  
  allResults.forEach(({ url, metaTags }) => {
    const tagCount = Object.keys(metaTags).length;
    const totalRequired = requiredMetaTags.length;
    const percentage = Math.round((tagCount / totalRequired) * 100);
    
    console.log(`${url}: ${tagCount}/${totalRequired} tags (${percentage}%)`);
  });
  
  console.log('\n✨ Testing complete!');
  console.log('\nNext steps:');
  console.log('1. Use the validator links above to test each platform');
  console.log('2. Test sharing in Discord/Slack for real-world validation');
  console.log('3. Monitor social media analytics for click-through rates');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default main;