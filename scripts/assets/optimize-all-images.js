import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fsPromises } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../../public');
const QUALITY_SETTINGS = {
  webp: 85,
  png: { compressionLevel: 9, quality: 95 },
  jpg: 85
};

const SIZE_THRESHOLDS = {
  large: 100 * 1024,  // 100KB
  medium: 50 * 1024,  // 50KB
  small: 20 * 1024    // 20KB
};

async function getAllImages(dir, fileList = []) {
  const files = await fsPromises.readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      if (!file.name.startsWith('.') && file.name !== 'node_modules') {
        await getAllImages(filePath, fileList);
      }
    } else if (/\.(png|jpg|jpeg)$/i.test(file.name)) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

async function getImageMetadata(imagePath) {
  try {
    const stats = await fsPromises.stat(imagePath);
    const metadata = await sharp(imagePath).metadata();
    return {
      path: imagePath,
      size: stats.size,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    };
  } catch (error) {
    console.error(`Error getting metadata for ${imagePath}:`, error.message);
    return null;
  }
}

async function optimizeImage(imagePath, metadata) {
  const dir = path.dirname(imagePath);
  const basename = path.basename(imagePath, path.extname(imagePath));
  const results = {
    original: metadata.size,
    optimized: {},
    savings: {}
  };

  try {
    // Create WebP version
    const webpPath = path.join(dir, `${basename}.webp`);
    await sharp(imagePath)
      .webp({ quality: QUALITY_SETTINGS.webp })
      .toFile(webpPath);
    
    const webpStats = await fsPromises.stat(webpPath);
    results.optimized.webp = webpStats.size;
    results.savings.webp = ((metadata.size - webpStats.size) / metadata.size * 100).toFixed(1);

    // Optimize PNG if original is PNG
    if (metadata.format === 'png' && metadata.size > SIZE_THRESHOLDS.small) {
      const optimizedPngPath = path.join(dir, `${basename}.optimized.png`);
      await sharp(imagePath)
        .png(QUALITY_SETTINGS.png)
        .toFile(optimizedPngPath);
      
      const optimizedStats = await fsPromises.stat(optimizedPngPath);
      
      // Only replace if significantly smaller (>10% reduction)
      if (optimizedStats.size < metadata.size * 0.9) {
        await fsPromises.rename(optimizedPngPath, imagePath);
        results.optimized.png = optimizedStats.size;
        results.savings.png = ((metadata.size - optimizedStats.size) / metadata.size * 100).toFixed(1);
      } else {
        await fsPromises.unlink(optimizedPngPath);
        results.optimized.png = metadata.size;
        results.savings.png = '0';
      }
    }

    // Create responsive versions for large images
    if (metadata.width > 1200 || metadata.size > SIZE_THRESHOLDS.large) {
      const sizes = [
        { width: 640, suffix: 'sm' },
        { width: 1024, suffix: 'md' },
        { width: 1440, suffix: 'lg' }
      ];

      for (const size of sizes) {
        if (size.width < metadata.width) {
          const responsivePath = path.join(dir, `${basename}-${size.suffix}.webp`);
          await sharp(imagePath)
            .resize(size.width, null, { withoutEnlargement: true })
            .webp({ quality: QUALITY_SETTINGS.webp })
            .toFile(responsivePath);
        }
      }
      results.hasResponsive = true;
    }

    return results;
  } catch (error) {
    console.error(`Error optimizing ${imagePath}:`, error.message);
    return null;
  }
}

async function generateOptimizationReport(results) {
  let report = '# Image Optimization Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  let totalOriginal = 0;
  let totalOptimized = 0;
  let largeImages = [];
  let convertedCount = 0;
  
  for (const result of results) {
    if (result.results) {
      totalOriginal += result.original.size;
      if (result.results.optimized.webp) {
        totalOptimized += result.results.optimized.webp;
        convertedCount++;
      }
      
      if (result.original.size > SIZE_THRESHOLDS.large) {
        largeImages.push(result);
      }
    }
  }
  
  const totalSavings = ((totalOriginal - totalOptimized) / totalOriginal * 100).toFixed(1);
  
  report += '## Summary\n\n';
  report += `- **Total images processed**: ${results.length}\n`;
  report += `- **Images converted to WebP**: ${convertedCount}\n`;
  report += `- **Original total size**: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB\n`;
  report += `- **Optimized total size**: ${(totalOptimized / 1024 / 1024).toFixed(2)} MB\n`;
  report += `- **Total savings**: ${totalSavings}%\n\n`;
  
  if (largeImages.length > 0) {
    report += '## Large Images Optimized (>100KB)\n\n';
    for (const img of largeImages) {
      const relativePath = path.relative(PUBLIC_DIR, img.original.path);
      report += `- **${relativePath}**\n`;
      report += `  - Original: ${(img.original.size / 1024).toFixed(1)} KB\n`;
      if (img.results.optimized.webp) {
        report += `  - WebP: ${(img.results.optimized.webp / 1024).toFixed(1)} KB (${img.results.savings.webp}% reduction)\n`;
      }
      if (img.results.hasResponsive) {
        report += `  - Created responsive versions (sm, md, lg)\n`;
      }
      report += '\n';
    }
  }
  
  report += '## Next Steps\n\n';
  report += '1. Update HTML/JSX to use `<picture>` elements with WebP and PNG fallback\n';
  report += '2. Implement lazy loading with `loading="lazy"` attribute\n';
  report += '3. Use responsive images with `srcset` for different screen sizes\n';
  report += '4. Consider using a CDN for image delivery\n\n';
  
  report += '## Example Implementation\n\n';
  report += '```jsx\n';
  report += '<picture>\n';
  report += '  <source srcset="/image.webp" type="image/webp" />\n';
  report += '  <source srcset="/image.png" type="image/png" />\n';
  report += '  <img src="/image.png" alt="Description" loading="lazy" />\n';
  report += '</picture>\n';
  report += '```\n';
  
  return report;
}

async function main() {
  console.log('🔍 Scanning for images in public directory...\n');
  
  const images = await getAllImages(PUBLIC_DIR);
  console.log(`Found ${images.length} images to process\n`);
  
  const results = [];
  let processed = 0;
  
  for (const imagePath of images) {
    const metadata = await getImageMetadata(imagePath);
    if (!metadata) continue;
    
    const relativePath = path.relative(PUBLIC_DIR, imagePath);
    const sizeKB = (metadata.size / 1024).toFixed(1);
    
    console.log(`Processing [${++processed}/${images.length}]: ${relativePath} (${sizeKB} KB)`);
    
    const optimizationResults = await optimizeImage(imagePath, metadata);
    
    results.push({
      original: metadata,
      results: optimizationResults
    });
    
    if (optimizationResults) {
      if (optimizationResults.savings.webp) {
        console.log(`  ✅ WebP: ${optimizationResults.savings.webp}% smaller`);
      }
      if (optimizationResults.savings.png) {
        console.log(`  ✅ PNG optimized: ${optimizationResults.savings.png}% smaller`);
      }
      if (optimizationResults.hasResponsive) {
        console.log(`  ✅ Created responsive versions`);
      }
    }
    console.log('');
  }
  
  console.log('\n📊 Generating optimization report...\n');
  const report = await generateOptimizationReport(results);
  
  const reportPath = path.join(__dirname, '../../image-optimization-report.md');
  await fsPromises.writeFile(reportPath, report);
  
  console.log(`✅ Optimization complete! Report saved to: ${reportPath}\n`);
  
  // Show summary
  const lines = report.split('\n');
  const summaryEnd = lines.findIndex(line => line.startsWith('## Large Images'));
  console.log(lines.slice(0, summaryEnd).join('\n'));
}

main().catch(error => {
  console.error('❌ Error during optimization:', error);
  process.exit(1);
});