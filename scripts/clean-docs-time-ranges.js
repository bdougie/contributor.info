#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, '../public/docs');

// Files to process
const FILES_TO_PROCESS = [
  'contributor-confidence-guide.md',
  'feature-activity-feed.md',
  'feature-authentication.md',
  'feature-contribution-analytics.md',
  'feature-contributor-of-month.md',
  'feature-distribution-charts.md',
  'feature-lottery-factor.md',
  'feature-repository-health.md',
  'feature-repository-search.md',
  'feature-time-range-analysis.md',
  'insight-pr-activity.md',
  'insight-repository-health.md'
];

async function cleanTimeReferences(filePath) {
  const fileName = path.basename(filePath);
  let content = await fs.readFile(filePath, 'utf-8');
  let originalContent = content;
  
  // Remove time-based filtering sections
  content = content.replace(/## Time-Based Filtering\n\n### Flexible Time Ranges\n[^#]+?(?=\n## |\n### Real-Time Updates|$)/gm, '');
  
  // Replace time range lists with 30-day default message
  content = content.replace(/- \*\*30 Days?\*\*: [^\n]+\n- \*\*60 Days?\*\*: [^\n]+\n- \*\*90 Days?\*\*: [^\n]+/gm, 
    'The system analyzes the most recent 30 days of activity.');
  
  content = content.replace(/- \*\*30 days?\*\*: [^\n]+\n- \*\*90 days?\*\*: [^\n]+\n- \*\*365 days?\*\*: [^\n]+/gm,
    'The system analyzes the most recent 30 days of activity.');
  
  // Remove standalone time range sections
  content = content.replace(/### (?:Flexible )?Time Ranges?\n[^#]+?(?=\n###|##|$)/gm, '');
  
  // Replace mentions of selecting time ranges
  content = content.replace(/you can select.*?time (?:range|period)s?[^\n.]*\./gi, 
    'the system analyzes the most recent 30 days of activity.');
  
  content = content.replace(/(?:selected|choosing|select a) time (?:range|period)/gi, 
    '30-day period');
  
  // Clean up specific phrases
  content = content.replace(/for different time (?:ranges|periods)/gi, 'for the 30-day period');
  content = content.replace(/across (?:various|different) time (?:ranges|periods)/gi, 'over the 30-day period');
  
  // Remove duplicate sections (common in the docs)
  const sections = content.split(/\n## /);
  const uniqueSections = [];
  const seenSections = new Set();
  
  for (const section of sections) {
    const sectionTitle = section.split('\n')[0];
    const sectionKey = sectionTitle.toLowerCase().trim();
    
    if (!seenSections.has(sectionKey) || sections.length === 1) {
      uniqueSections.push(section);
      seenSections.add(sectionKey);
    }
  }
  
  if (sections.length > 1) {
    content = uniqueSections.join('\n## ');
  }
  
  // Clean up extra newlines
  content = content.replace(/\n{4,}/g, '\n\n\n');
  content = content.replace(/\n{3,}(##)/g, '\n\n$1');
  
  // Special handling for feature-time-range-analysis.md
  if (fileName === 'feature-time-range-analysis.md') {
    // This doc is specifically about time ranges, so update it differently
    content = content.replace(/# Time Range Analysis\n\n## Overview\n[^#]+/m,
      `# Activity Analysis\n\n## Overview\n\nThe activity analysis feature provides insights into repository and contributor patterns over the most recent 30-day period. This focused timeframe gives you current, actionable insights into your project's momentum and health.\n`);
    
    // Remove sections about different time ranges
    content = content.replace(/### \d+-Day Analysis[^#]+/gm, '');
  }
  
  if (content !== originalContent) {
    await fs.writeFile(filePath, content);
    return { fileName, changed: true };
  }
  
  return { fileName, changed: false };
}

async function main() {
  console.log('🧹 Cleaning Time Range References from Documentation');
  console.log('===================================================\n');
  
  let changedCount = 0;
  
  for (const file of FILES_TO_PROCESS) {
    const filePath = path.join(DOCS_DIR, file);
    
    try {
      const result = await cleanTimeReferences(filePath);
      
      if (result.changed) {
        console.log(`✅ ${result.fileName}: Updated`);
        changedCount++;
      } else {
        console.log(`⚪ ${result.fileName}: No changes needed`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`⚠️  ${file}: File not found`);
      } else {
        console.error(`❌ ${file}: ${error.message}`);
      }
    }
  }
  
  console.log('\n===================================================');
  console.log(`📊 Summary: ${changedCount} files updated`);
  console.log('\n✅ Documentation cleaned!');
}

main().catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});