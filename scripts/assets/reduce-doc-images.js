#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, '../../public/docs');

// Define which image to keep for each doc (the most representative one)
const IMAGES_TO_KEEP = {
  'feature-activity-feed.md': 'pr-timeline',
  'feature-contribution-analytics.md': 'quadrant-scatter-plot',
  'feature-contributor-of-month.md': 'winner-display',
  'feature-contributor-profiles.md': 'profile-stats',
  'feature-distribution-charts.md': 'contribution-patterns',
  'feature-repository-health.md': 'lottery-factor-visualization',
  'feature-repository-search.md': 'homepage-featured',
  'feature-time-range-analysis.md': '30-day-view',
  'feature-social-cards.md': 'social-card',
  'insight-pr-activity.md': 'pr-activity',
  'contributor-confidence-guide.md': 'confidence-meter',
};

async function processMarkdownFile(filePath) {
  const fileName = path.basename(filePath);
  const content = await fs.readFile(filePath, 'utf-8');

  // Find all image references
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images = [];
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    images.push({
      full: match[0],
      alt: match[1],
      url: match[2],
      index: match.index,
    });
  }

  if (images.length <= 1) {
    return { fileName, originalCount: images.length, kept: images.length, removed: 0 };
  }

  // Determine which image to keep
  const keepPattern = IMAGES_TO_KEEP[fileName];
  let imageToKeep = null;

  if (keepPattern) {
    // Find the first image that matches the pattern
    imageToKeep = images.find((img) => img.url.includes(keepPattern));
  }

  // If no pattern match or no pattern defined, keep the first image
  if (!imageToKeep) {
    imageToKeep = images[0];
  }

  // Remove all images except the one to keep
  let newContent = content;
  let removedCount = 0;

  // Process images in reverse order to maintain correct indexes
  for (let i = images.length - 1; i >= 0; i--) {
    const img = images[i];
    if (img !== imageToKeep) {
      // Remove the image and any surrounding empty lines
      const before = newContent.substring(0, img.index);
      const after = newContent.substring(img.index + img.full.length);

      // Clean up extra newlines
      let cleanBefore = before.replace(/\n\s*\n\s*$/, '\n');
      let cleanAfter = after.replace(/^\s*\n\s*\n/, '\n');

      newContent = cleanBefore + cleanAfter;
      removedCount++;
    }
  }

  // Save the updated content
  await fs.writeFile(filePath, newContent);

  return {
    fileName,
    originalCount: images.length,
    kept: 1,
    removed: removedCount,
    keptImage: imageToKeep ? imageToKeep.url : null,
  };
}

async function main() {
  console.log('📸 Reducing Documentation Images to 1 per Page');
  console.log('==============================================\n');

  // Get all markdown files
  const files = await fs.readdir(DOCS_DIR);
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  const results = [];
  let totalOriginal = 0;
  let totalRemoved = 0;

  for (const file of mdFiles) {
    const filePath = path.join(DOCS_DIR, file);
    try {
      const result = await processMarkdownFile(filePath);
      results.push(result);
      totalOriginal += result.originalCount;
      totalRemoved += result.removed;

      if (result.removed > 0) {
        console.log(
          `✅ ${result.fileName}: Reduced from ${result.originalCount} to ${result.kept} image(s)`
        );
      } else if (result.originalCount === 0) {
        console.log(`⚪ ${result.fileName}: No images`);
      } else {
        console.log(`✓  ${result.fileName}: Already has ${result.originalCount} image(s)`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }

  console.log('\n==============================================');
  console.log('📊 Summary:');
  console.log(`  📁 Files processed: ${mdFiles.length}`);
  console.log(`  🖼️  Original images: ${totalOriginal}`);
  console.log(`  🗑️  Images removed: ${totalRemoved}`);
  console.log(`  ✅ Images remaining: ${totalOriginal - totalRemoved}`);

  // Show which images were kept
  console.log('\n📌 Images kept per file:');
  results
    .filter((r) => r.keptImage)
    .forEach((r) => {
      const imageName = r.keptImage.split('/').pop();
      console.log(`  ${r.fileName}: ${imageName}`);
    });

  console.log('\n✅ Documentation image reduction complete!');
  console.log('\n📝 Next Steps:');
  console.log('1. Review the changes with: git diff public/docs/');
  console.log('2. Build and check bundle size: npm run build');
  console.log('3. Test the documentation locally');
}

main().catch((error) => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
