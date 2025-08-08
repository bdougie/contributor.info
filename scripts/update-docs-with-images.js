#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Image mappings for each documentation file
const IMAGE_MAPPINGS = {
  'feature-repository-search.md': [
    {
      after: '## Featured Repositories',
      content: '\n![Homepage with featured repositories](/docs/images/features/repository-search/homepage-featured.png)\n*Featured repositories showcase popular open source projects*\n'
    },
    {
      after: '### URL Input',
      content: '\n![Repository search input](/docs/images/features/repository-search/search-input.png)\n*Enter repository URLs or owner/repo format*\n'
    },
    {
      after: '### Multi-Tab Analysis',
      content: '\n![Multi-tab navigation](/docs/images/features/repository-search/multi-tab-navigation.png)\n*Navigate between Contributions, Health, Distribution, and Feed tabs*\n'
    }
  ],
  
  'feature-contribution-analytics.md': [
    {
      after: '### The Four Contribution Quadrants',
      content: '\n![Contribution quadrant visualization](/docs/images/features/contribution-analytics/quadrant-scatter-plot.png)\n*Contributors mapped by impact and effort metrics*\n'
    },
    {
      after: '### Time Series Analysis',
      content: '\n![Time range selector](/docs/images/features/contribution-analytics/time-range-selector.png)\n*Analyze contributions across different time periods*\n'
    }
  ],
  
  'feature-repository-health.md': [
    {
      after: '## What is the Lottery Factor?',
      content: '\n![Lottery factor visualization](/docs/images/features/repository-health/lottery-factor-visualization.png)\n*Risk assessment based on contributor concentration*\n'
    },
    {
      after: '### YOLO Coders Feature',
      content: '\n![YOLO coders section](/docs/images/features/repository-health/yolo-coders.png)\n*Contributors with direct commit access*\n'
    },
    {
      after: '### Color-Coded Status System',
      content: '\n![Health status indicators](/docs/images/features/repository-health/health-indicators.png)\n*Visual indicators for repository health metrics*\n'
    }
  ],
  
  'feature-distribution-charts.md': [
    {
      after: '### Language Distribution Treemap',
      content: '\n![Language distribution treemap](/docs/images/features/distribution-charts/language-treemap.png)\n*Interactive treemap showing code distribution by language*\n'
    },
    {
      after: '### Contribution Patterns',
      content: '\n![Contribution patterns analysis](/docs/images/features/distribution-charts/contribution-patterns.png)\n*Visualize how contributions are distributed*\n'
    }
  ],
  
  'feature-activity-feed.md': [
    {
      after: '### Pull Request Timeline',
      content: '\n![Pull request activity timeline](/docs/images/features/activity-feed/pr-timeline.png)\n*Real-time feed of repository activity*\n'
    },
    {
      after: '### Velocity Indicators',
      content: '\n![Velocity metrics](/docs/images/features/activity-feed/velocity-indicators.png)\n*Track development velocity and trends*\n'
    }
  ],
  
  'feature-contributor-profiles.md': [
    {
      after: '### Hover Cards',
      content: '\n![Contributor hover card](/docs/images/features/contributor-profiles/hover-card.png)\n*Quick contributor information on hover*\n'
    },
    {
      after: '### Contribution Statistics',
      content: '\n![Contributor statistics](/docs/images/features/contributor-profiles/profile-stats.png)\n*Detailed contribution metrics and patterns*\n'
    }
  ],
  
  'feature-contributor-of-month.md': [
    {
      after: '### Winner Announcement Phase',
      content: '\n![Contributor of the month winner](/docs/images/features/contributor-of-month/winner-display.png)\n*Monthly recognition for top contributors*\n'
    },
    {
      after: '### Leaderboard Phase',
      content: '\n![Monthly leaderboard](/docs/images/features/contributor-of-month/leaderboard.png)\n*Track top contributors throughout the month*\n'
    }
  ],
  
  'feature-time-range-analysis.md': [
    {
      after: '### 30-Day Analysis (Recent Focus)',
      content: '\n![30-day analysis view](/docs/images/features/time-range-analysis/30-day-view.png)\n*Recent activity and current patterns*\n'
    },
    {
      after: '### 90-Day Analysis (Strategic Perspective)',
      content: '\n![90-day analysis view](/docs/images/features/time-range-analysis/90-day-view.png)\n*Long-term trends and evolution*\n'
    }
  ],
  
  'feature-authentication.md': [
    {
      after: '### GitHub OAuth Integration',
      content: '\n![GitHub login button](/docs/images/features/authentication/github-login-button.png)\n*Sign in with GitHub for enhanced features*\n'
    }
  ],
  
  'feature-social-cards.md': [
    {
      after: '### Home Page Cards',
      content: '\n![Homepage social card](/docs/images/features/social-cards/home-card.png)\n*Social preview for the contributor.info homepage*\n'
    },
    {
      after: '### Repository-Specific Cards',
      content: '\n![Repository social card](/docs/images/features/social-cards/repository-card.png)\n*Dynamic social cards for each repository*\n'
    }
  ],
  
  'insight-needs-attention.md': [
    {
      after: '## Information Displayed',
      content: '\n![Needs attention scoring](/docs/images/insights/needs-attention/scoring-display.png)\n*Visual scoring system for repository attention needs*\n'
    }
  ],
  
  'insight-pr-activity.md': [
    {
      after: '### Color-Coded Performance',
      content: '\n![PR activity metrics](/docs/images/insights/pr-activity/metrics-dashboard.png)\n*Key pull request metrics at a glance*\n'
    },
    {
      after: '### Velocity Insights',
      content: '\n![Weekly velocity comparison](/docs/images/insights/pr-activity/weekly-velocity.png)\n*Compare current week to previous week*\n'
    }
  ],
  
  'insight-recommendations.md': [
    {
      after: '## AI Integration',
      content: '\n![AI-powered recommendations](/docs/images/insights/recommendations/ai-suggestions.png)\n*Smart suggestions for repository improvement*\n'
    }
  ],
  
  'insight-repository-health.md': [
    {
      after: '## Visual Indicators',
      content: '\n![Repository health summary](/docs/images/insights/repository-health/summary-dashboard.png)\n*Comprehensive health metrics dashboard*\n'
    }
  ],
  
  'contributor-confidence-guide.md': [
    {
      after: '## Confidence Levels & Meanings',
      content: '\n![Confidence level indicators](/docs/images/guides/contributor-confidence/confidence-indicators.png)\n*Color-coded confidence levels for contributors*\n'
    }
  ]
};

async function updateDocumentationWithImages() {
  console.log('📝 Updating documentation files with images...\n');
  
  const docsDir = path.join(__dirname, '..', 'public', 'docs');
  let updatedCount = 0;
  let errorCount = 0;
  
  for (const [filename, imageMappings] of Object.entries(IMAGE_MAPPINGS)) {
    const filePath = path.join(docsDir, filename);
    
    try {
      console.log(`📄 Processing: ${filename}`);
      
      // Read the current content
      let content = await fs.readFile(filePath, 'utf-8');
      let modified = false;
      
      // Process each image mapping
      for (const mapping of imageMappings) {
        // Check if image already exists
        if (content.includes(mapping.content.trim())) {
          console.log(`   ⏭️  Image already exists after "${mapping.after.substring(0, 30)}..."`);
          continue;
        }
        
        // Find the position to insert the image
        const afterIndex = content.indexOf(mapping.after);
        if (afterIndex === -1) {
          console.log(`   ⚠️  Could not find text: "${mapping.after}"`);
          continue;
        }
        
        // Find the end of the line
        const lineEnd = content.indexOf('\n', afterIndex + mapping.after.length);
        const insertPosition = lineEnd !== -1 ? lineEnd : content.length;
        
        // Insert the image content
        content = content.slice(0, insertPosition) + mapping.content + content.slice(insertPosition);
        modified = true;
        console.log(`   ✅ Added image after "${mapping.after.substring(0, 30)}..."`);
      }
      
      // Write back if modified
      if (modified) {
        await fs.writeFile(filePath, content, 'utf-8');
        updatedCount++;
        console.log(`   💾 Saved changes to ${filename}\n`);
      } else {
        console.log(`   ℹ️  No changes needed for ${filename}\n`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error processing ${filename}: ${error.message}\n`);
      errorCount++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   ✅ Updated: ${updatedCount} files`);
  console.log(`   ❌ Errors: ${errorCount} files`);
  console.log(`   📁 Documentation directory: ${docsDir}`);
}

// Mobile view notice to add at the end of applicable docs
const MOBILE_NOTICE = `
## Mobile Experience

contributor.info is fully responsive and optimized for mobile devices:

![Mobile homepage view](/docs/images/mobile/homepage-mobile.png)
*Mobile-optimized interface*

![Mobile repository view](/docs/images/mobile/repository-mobile.png)
*Repository analysis on mobile devices*

All features are accessible on mobile devices with touch-optimized interactions and responsive layouts.`;

// Run the script
updateDocumentationWithImages().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});