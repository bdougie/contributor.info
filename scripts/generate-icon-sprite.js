#!/usr/bin/env node

/**
 * Generate SVG sprite from lucide-react icons
 * This script extracts only the icons we use and creates an optimized sprite
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import SVGSpriter from 'svg-sprite';
import { optimize } from 'svgo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// List of icons we actually use (extracted from codebase)
const USED_ICONS = [
  'activity', 'alert-circle', 'alert-triangle', 'arrow-left', 'arrow-right',
  'ban', 'bar-chart-3', 'book', 'bot', 'brain', 'bug', 'calculator', 'calendar', 
  'check', 'check-circle', 'check-circle-2', 'chevron-down', 'chevron-left', 
  'chevron-right', 'chevrons-up-down', 'chevron-up', 'circle', 'clock', 'code', 
  'copy', 'crown', 'database', 'download', 'external-link', 'eye', 'file', 
  'file-text', 'filter', 'git-branch', 'git-commit', 'git-fork', 'github', 
  'git-pull-request', 'git-pull-request-draft', 'globe', 'grip-vertical', 
  'heart', 'help-circle', 'image', 'info', 'key', 'layout', 'lightbulb', 
  'link', 'link-2', 'loader-2', 'lock', 'log-in', 'log-out', 'mail', 'menu', 
  'message-circle', 'message-square', 'minus', 'monitor', 'moon', 
  'more-horizontal', 'package', 'palette', 'percent', 'pie-chart', 'play', 
  'plus', 'refresh-cw', 'rotate-ccw', 'rss', 'search', 'settings', 'share-2',
  'shield', 'smartphone', 'sparkles', 'star', 'sun', 'target', 'terminal',
  'test-tube', 'trash-2', 'tree-pine', 'trending-down', 'trending-up', 'trophy', 
  'unlock', 'upload', 'user', 'user-check', 'user-plus', 'users', 'wifi', 
  'wifi-off', 'x', 'x-circle', 'zap'
];

// SVGO configuration for maximum optimization
const svgoConfig = {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeViewBox: false,
          cleanupIds: false
        }
      }
    },
    'removeStyleElement',
    'removeScriptElement',
    'removeXMLNS',
    {
      name: 'removeAttrs',
      params: {
        attrs: ['class', 'data-*', 'fill', 'stroke']
      }
    }
  ]
};

// SVG Sprite configuration
const spriteConfig = {
  mode: {
    symbol: {
      dest: '.',
      sprite: 'icons.svg',
      example: false
    }
  },
  shape: {
    id: {
      generator: (name) => `icon-${name.replace('.svg', '')}`
    },
    transform: [
      {
        svgo: svgoConfig
      }
    ]
  }
};

async function loadLucideIcon(iconName) {
  try {
    // Try to load from lucide package
    const lucidePath = path.join(__dirname, '..', 'node_modules', 'lucide-static', 'icons', `${iconName}.svg`);
    
    // First check if lucide-static exists, if not we'll need to extract from lucide-react
    try {
      const iconContent = await fs.readFile(lucidePath, 'utf8');
      return iconContent;
    } catch {
      // Fallback: extract from @iconify/json which includes lucide icons
      const iconifyPath = path.join(__dirname, '..', 'node_modules', '@iconify', 'json', 'json', 'lucide.json');
      const iconifyData = JSON.parse(await fs.readFile(iconifyPath, 'utf8'));
      
      if (iconifyData.icons[iconName]) {
        const iconData = iconifyData.icons[iconName];
        const width = iconData.width || iconifyData.width || 24;
        const height = iconData.height || iconifyData.height || 24;
        const body = iconData.body;
        
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not load icon "${iconName}":`, error.message);
    return null;
  }
}

async function generateSprite() {
  console.log('🎨 Generating SVG sprite with', USED_ICONS.length, 'icons...');
  
  const spriter = new SVGSpriter(spriteConfig);
  let loadedCount = 0;
  
  for (const iconName of USED_ICONS) {
    const svgContent = await loadLucideIcon(iconName);
    
    if (svgContent) {
      // Optimize the SVG before adding to sprite
      const optimized = optimize(svgContent, svgoConfig);
      spriter.add(`${iconName}.svg`, null, optimized.data);
      loadedCount++;
    }
  }
  
  console.log(`✅ Loaded ${loadedCount}/${USED_ICONS.length} icons`);
  
  return new Promise((resolve, reject) => {
    spriter.compile((error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

async function main() {
  try {
    // First install lucide-static for SVG files
    console.log('📦 Installing lucide-static for SVG files...');
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      await execAsync('npm install --no-save lucide-static');
    } catch (error) {
      console.log('⚠️  Could not install lucide-static, trying with @iconify/json fallback');
    }
    
    const result = await generateSprite();
    
    // Write the sprite to public directory
    const outputPath = path.join(__dirname, '..', 'public', 'icons.svg');
    await fs.writeFile(outputPath, result.symbol.sprite.contents);
    
    // Calculate file size
    const stats = await fs.stat(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    console.log(`\n🎉 SVG sprite generated successfully!`);
    console.log(`📍 Location: public/icons.svg`);
    console.log(`📏 Size: ${sizeKB} KB (was ~100KB with lucide-react)`);
    console.log(`📊 Icons included: ${USED_ICONS.length}`);
    
    // Generate TypeScript types for icons
    const iconTypes = USED_ICONS.map(icon => `  | '${icon}'`).join('\n');
    const typeDefinition = `// Auto-generated icon types
export type IconName =
${iconTypes};

export const AVAILABLE_ICONS = [
${USED_ICONS.map(icon => `  '${icon}'`).join(',\n')}
] as const;
`;
    
    await fs.writeFile(
      path.join(__dirname, '..', 'src', 'types', 'icons.ts'),
      typeDefinition
    );
    
    console.log('📝 TypeScript types generated: src/types/icons.ts');
    
  } catch (error) {
    console.error('❌ Error generating sprite:', error);
    process.exit(1);
  }
}

main();