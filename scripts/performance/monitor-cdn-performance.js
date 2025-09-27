import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.SUPABASE_TOKEN || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Error: SUPABASE_TOKEN or VITE_SUPABASE_ANON_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test locations (you could expand this with a real global testing service)
const testLocations = [
  { name: 'US East', region: 'us-east' },
  { name: 'Europe', region: 'eu' },
  { name: 'Asia Pacific', region: 'ap' },
];

async function testImagePerformance(imageUrl, location) {
  const startTime = performance.now();

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': `CDN-Monitor/1.0 (${location.name})`,
      },
    });

    const endTime = performance.now();
    const loadTime = endTime - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const size = parseInt(response.headers.get('content-length') || '0');
    const contentType = response.headers.get('content-type');
    const cacheControl = response.headers.get('cache-control');
    const etag = response.headers.get('etag');

    return {
      success: true,
      loadTime: Math.round(loadTime),
      size,
      contentType,
      cacheControl,
      etag,
      location: location.name,
    };
  } catch (error) {
    const endTime = performance.now();
    const loadTime = endTime - startTime;

    return {
      success: false,
      loadTime: Math.round(loadTime),
      error: error.message,
      location: location.name,
    };
  }
}

async function getCDNStats() {
  console.log('📊 CDN Performance Report');
  console.log('=========================\n');

  try {
    // List all files in the social-cards bucket
    const { data: files, error } = await supabase.storage.from('social-cards').list('', {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error) {
      console.error('Error listing files:', error);
      return;
    }

    if (!files || files.length === 0) {
      console.log('No social cards found in storage');
      return;
    }

    console.log(`📁 Found ${files.length} social cards\n`);

    // Test performance for each file
    const results = [];

    for (const file of files.slice(0, 5)) {
      // Test first 5 files
      console.log(`🧪 Testing: ${file.name}`);

      const {
        data: { publicUrl },
      } = supabase.storage.from('social-cards').getPublicUrl(file.name);

      const fileResults = [];

      // Test from multiple locations (simulated)
      for (const location of testLocations) {
        const result = await testImagePerformance(publicUrl, location);
        fileResults.push(result);

        if (result.success) {
          console.log(
            `  ✅ ${location.name}: ${result.loadTime}ms (${Math.round(result.size / 1024)}KB)`
          );
        } else {
          console.log(`  ❌ ${location.name}: ${result.error}`);
        }
      }

      results.push({
        fileName: file.name,
        publicUrl,
        fileSize: file.metadata?.size || 0,
        results: fileResults,
      });

      console.log(''); // Empty line for readability
    }

    // Generate summary statistics
    console.log('📈 Performance Summary');
    console.log('=====================\n');

    const allLoadTimes = results.flatMap((r) =>
      r.results.filter((res) => res.success).map((res) => res.loadTime)
    );

    if (allLoadTimes.length > 0) {
      const avgLoadTime = allLoadTimes.reduce((a, b) => a + b, 0) / allLoadTimes.length;
      const minLoadTime = Math.min(...allLoadTimes);
      const maxLoadTime = Math.max(...allLoadTimes);

      console.log(`Average load time: ${Math.round(avgLoadTime)}ms`);
      console.log(`Fastest load time: ${minLoadTime}ms`);
      console.log(`Slowest load time: ${maxLoadTime}ms`);

      // Performance scoring
      let score = 'Good';
      if (avgLoadTime > 1000) score = 'Poor';
      else if (avgLoadTime > 500) score = 'Fair';
      else if (avgLoadTime < 100) score = 'Excellent';

      console.log(`Overall performance: ${score}`);
    }

    // Check cache headers
    console.log('\n🗄️ Cache Analysis');
    console.log('==================\n');

    const cacheResults = results.flatMap((r) => r.results.filter((res) => res.success));
    const uniqueCacheControls = [...new Set(cacheResults.map((r) => r.cacheControl))];

    uniqueCacheControls.forEach((cc) => {
      const count = cacheResults.filter((r) => r.cacheControl === cc).length;
      console.log(`Cache-Control: ${cc || 'None'} (${count} responses)`);
    });

    // Storage usage
    console.log('\n💾 Storage Usage');
    console.log('================\n');

    const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
    const avgFileSize = totalSize / files.length;

    console.log(`Total files: ${files.length}`);
    console.log(`Total storage: ${Math.round((totalSize / 1024 / 1024) * 100) / 100} MB`);
    console.log(`Average file size: ${Math.round(avgFileSize / 1024)} KB`);

    // Recommendations
    console.log('\n💡 Recommendations');
    console.log('==================\n');

    if (avgLoadTime > 500) {
      console.log('• Consider optimizing image compression');
      console.log('• Implement WebP format for better compression');
    }

    if (!uniqueCacheControls.some((cc) => cc && cc.includes('max-age'))) {
      console.log('• Set longer cache control headers for better CDN performance');
    }

    if (avgFileSize > 500000) {
      // 500KB
      console.log('• Social card file sizes are large - consider optimization');
    }

    console.log('• Monitor CDN cache hit rates via Supabase dashboard');
    console.log('• Set up monitoring alerts for performance degradation');
  } catch (error) {
    console.error('Error analyzing CDN performance:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  getCDNStats().catch(console.error);
}

export default getCDNStats;
