const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  let renderCount = 0;
  let lastRenderTime = Date.now();
  let rapidRenders = 0;
  
  // Monitor console logs
  page.on('console', msg => {
    const text = msg.text();
    
    // Look for render indicators
    if (text.includes('WorkspacePage rendered') || 
        text.includes('useEffect') || 
        text.includes('render')) {
      
      const now = Date.now();
      const timeSinceLastRender = now - lastRenderTime;
      
      renderCount++;
      
      // If renders are happening within 50ms of each other, it's likely a loop
      if (timeSinceLastRender < 50) {
        rapidRenders++;
        console.log(`⚠️  Rapid render #${rapidRenders} detected! Time since last: ${timeSinceLastRender}ms`);
        
        if (rapidRenders > 10) {
          console.log('\n🚨 INFINITE RENDER LOOP DETECTED! 🚨');
          console.log(`Total renders: ${renderCount}`);
          console.log(`Rapid renders: ${rapidRenders}`);
        }
      } else {
        // Reset rapid render counter if enough time has passed
        if (rapidRenders > 0) {
          console.log(`✅ Render stabilized after ${rapidRenders} rapid renders`);
        }
        rapidRenders = 0;
      }
      
      lastRenderTime = now;
    }
    
    // Log all console messages for debugging
    if (!text.includes('[HMR]') && !text.includes('[vite]')) {
      console.log(`Console: ${text}`);
    }
  });
  
  console.log('🔍 Navigating to workspace page...');
  await page.goto('http://localhost:5174/i/test');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  console.log('\n📊 Monitoring for 10 seconds...\n');
  
  // Monitor for 10 seconds
  await page.waitForTimeout(10000);
  
  console.log('\n📈 Final Report:');
  console.log(`Total renders detected: ${renderCount}`);
  console.log(`Rapid render sequences: ${rapidRenders > 0 ? 'YES ⚠️' : 'NO ✅'}`);
  
  if (renderCount < 10) {
    console.log('✅ No infinite render loop detected - page appears stable!');
  } else if (renderCount < 50) {
    console.log('⚠️  Higher than normal render count, but not infinite');
  } else {
    console.log('🚨 Excessive renders detected - possible performance issue');
  }
  
  await browser.close();
})();