import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.SUPABASE_TOKEN || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Error: SUPABASE_TOKEN or VITE_SUPABASE_ANON_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:4173',
  outputDir: path.join(__dirname, '../temp-social-cards'),
  cards: [
    {
      name: 'home',
      url: '/social-cards/home',
      fileName: 'home-card.png'
    },
    // Add repository cards dynamically based on your needs
  ]
};

// Popular repositories to generate cards for
const popularRepos = [
  { owner: 'facebook', repo: 'react' },
  { owner: 'vuejs', repo: 'vue' },
  { owner: 'angular', repo: 'angular' },
  { owner: 'vercel', repo: 'next.js' },
  { owner: 'sveltejs', repo: 'svelte' },
  { owner: 'microsoft', repo: 'vscode' },
  { owner: 'torvalds', repo: 'linux' },
  { owner: 'nodejs', repo: 'node' },
  // Additional popular/demo repos
  { owner: 'continuedev', repo: 'continue' },
  { owner: 'supabase', repo: 'supabase' },
  { owner: 'tailwindlabs', repo: 'tailwindcss' },
  { owner: 'anthropics', repo: 'anthropic-sdk-typescript' },
];

async function generateCard(browser, cardConfig) {
  console.log(`Generating card: ${cardConfig.name}`);
  
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 630 });
  
  try {
    // Navigate to the card page with timeout
    const url = `${config.baseUrl}${cardConfig.url}`;
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 // 30 second timeout
    });
    
    // Wait a bit for any animations or async content
    await page.waitForTimeout(2000);
    
    // Hide any potential sharing elements that might appear
    await page.addStyleTag({
      content: `
        [data-shareable-card] { display: none !important; }
        .shareable-card { display: none !important; }
        button[title*="Copy"] { display: none !important; }
        button[title*="Share"] { display: none !important; }
        button[title*="Download"] { display: none !important; }
        .lucide-copy, .lucide-share-2, .lucide-download, .lucide-link { display: none !important; }
      `
    });
    
    // Wait a bit more to ensure styles are applied
    await page.waitForTimeout(500);
    
    // Take screenshot
    const screenshotPath = path.join(config.outputDir, cardConfig.fileName);
    await page.screenshot({ 
      path: screenshotPath,
      type: 'png',
      fullPage: false
    });
    
    // Upload to Supabase Storage
    const fileBuffer = await fs.readFile(screenshotPath);
    const { data, error } = await supabase.storage
      .from('social-cards')
      .upload(cardConfig.fileName, fileBuffer, {
        contentType: 'image/png',
        cacheControl: '86400', // 1 day cache (reduced from 1 year for easier updates)
        upsert: true
      });
      
    if (error) {
      console.error(`Error uploading ${cardConfig.name}:`, error);
    } else {
      console.log(`Successfully uploaded ${cardConfig.name}`);
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('social-cards')
        .getPublicUrl(cardConfig.fileName);
        
      console.log(`Public URL: ${publicUrl}`);
    }
    
  } catch (error) {
    console.error(`Error generating card ${cardConfig.name}:`, error);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('Starting social card generation...');
  
  // Set a maximum execution time of 10 minutes
  const timeoutId = setTimeout(() => {
    console.error('Social card generation timed out after 10 minutes');
    process.exit(1);
  }, 10 * 60 * 1000);
  
  try {
    // Create temp directory
    await fs.mkdir(config.outputDir, { recursive: true });
    
    // Launch browser
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      // Generate home card
      await generateCard(browser, config.cards[0]);
      
      // Generate repo cards (configurable count via REPO_COUNT env var)
      const repoCount = parseInt(process.env.REPO_COUNT) || 5; // Increased default to include continuedev/continue
      const limitedRepos = popularRepos.slice(0, repoCount);
      console.log(`Generating cards for ${limitedRepos.length} repositories`);
      for (const { owner, repo } of limitedRepos) {
        const cardConfig = {
          name: `${owner}-${repo}`,
          url: `/social-cards/${owner}/${repo}`,
          fileName: `repo-${owner}-${repo}.png`
        };
        await generateCard(browser, cardConfig);
      }
      
    } finally {
      await browser.close();
      
      // Clean up temp directory
      await fs.rm(config.outputDir, { recursive: true, force: true });
    }
    
    console.log('Social card generation complete!');
    
  } finally {
    // Clear the timeout
    clearTimeout(timeoutId);
  }
}

// Run the script
main().catch(console.error);