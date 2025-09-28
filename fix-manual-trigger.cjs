#!/usr/bin/env node

const fs = require('fs');

const filePath = 'src/lib/progressive-capture/manual-trigger.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix all the multi-line template literal console.log statements
const fixes = [
  {
    // Line 29-54: analyze() method
    old: /console\.log\(`\n📊 Data Gap Analysis Results:[\s\S]*?\n    `\);/,
    replacement: `console.log(
      '\\n📊 Data Gap Analysis Results:\\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n' +
      '\\n🕐 Stale Data:\\n' +
      '  • %s repositories with data older than 3 days\\n' +
      '\\n📊 Missing Data:\\n' +
      '  • %s PRs without file change data (additions/deletions)\\n' +
      '  • Reviews table: %s\\n' +
      '  • Comments table: %s\\n' +
      '  • Commits table: %s\\n' +
      '\\n⚡ Current Queue Status:\\n' +
      '  • %s jobs pending\\n' +
      '  • %s jobs processing\\n' +
      '  • %s jobs completed\\n' +
      '  • %s jobs failed\\n' +
      '  • 🔄 Inngest: %s pending, %s processing\\n' +
      '  • 🏗️ GitHub Actions: %s pending, %s processing\\n' +
      '\\n💡 Recommendations:\\n' +
      '%s\\n' +
      '%s\\n' +
      '%s',
      gaps.repositoriesWithStaleData,
      gaps.prsWithoutFileChanges,
      gaps.emptyReviewsTable ? '❌ Empty' : '✅ Has data',
      gaps.emptyCommentsTable ? '❌ Empty' : '✅ Has data',
      gaps.emptyCommitsTable ? '❌ Empty' : '✅ Has data',
      queueStats.total.pending,
      queueStats.total.processing,
      queueStats.total.completed,
      queueStats.total.failed,
      queueStats.inngest.pending,
      queueStats.inngest.processing,
      queueStats.github_actions.pending,
      queueStats.github_actions.processing,
      gaps.repositoriesWithStaleData > 0 ? '  • Run bootstrap to queue recent PRs for stale repositories' : '  • ✅ Repository data is fresh',
      gaps.prsWithoutFileChanges > 0 ? '  • Run bootstrap to queue file change updates' : '  • ✅ File change data is complete',
      gaps.emptyReviewsTable ? '  • Consider queuing review data (lower priority)' : '  • ✅ Review data available'
    );`
  },
  {
    // Line 68-79: bootstrap() method
    old: /console\.log\(`\n✅ Bootstrap completed successfully![\s\S]*?\n      `\);/,
    replacement: `console.log(
      '\\n✅ Bootstrap completed successfully!\\n' +
      '\\n📈 Queue Status:\\n' +
      '  • %s jobs queued and ready to process\\n' +
      '  • %s total jobs in queue\\n' +
      '\\n🔄 Next Steps:\\n' +
      '  1. The queue will automatically process jobs when the app is active\\n' +
      '  2. Monitor progress with: ProgressiveCaptureTrigger.status()\\n' +
      '  3. Check rate limits with: ProgressiveCaptureTrigger.rateLimits()',
      queueStats.total.pending,
      queueStats.total.pending + queueStats.total.processing + queueStats.total.completed
    );`
  },
  {
    // Line 93-124: status() method
    old: /console\.log\(`\n📊 Queue Status Report:[\s\S]*?\n    `\);/,
    replacement: `console.log(
      '\\n📊 Queue Status Report:\\n' +
      '━━━━━━━━━━━━━━━━━━━━━\\n' +
      '\\n📋 Job Counts:\\n' +
      '  • Pending: %s\\n' +
      '  • Processing: %s\\n' +
      '  • Completed: %s\\n' +
      '  • Failed: %s\\n' +
      '  • Total: %s\\n' +
      '\\n🔄 Inngest Jobs:\\n' +
      '  • Pending: %s\\n' +
      '  • Processing: %s\\n' +
      '  • Completed: %s\\n' +
      '  • Failed: %s\\n' +
      '\\n🏗️ GitHub Actions Jobs:\\n' +
      '  • Pending: %s\\n' +
      '  • Processing: %s\\n' +
      '  • Completed: %s\\n' +
      '  • Failed: %s\\n' +
      '\\n🔄 Processing Status:\\n' +
      '  • Can make API calls: %s\\n' +
      '  • Queue health: %s\\n' +
      '\\n💡 Actions:\\n' +
      '  • To process manually: ProgressiveCaptureTrigger.processNext()\\n' +
      '  • To check rate limits: ProgressiveCaptureTrigger.rateLimits()\\n' +
      '  • To see detailed monitoring: ProgressiveCaptureTrigger.monitoring()',
      stats.total.pending,
      stats.total.processing,
      stats.total.completed,
      stats.total.failed,
      stats.total.pending + stats.total.processing + stats.total.completed + stats.total.failed,
      stats.inngest.pending,
      stats.inngest.processing,
      stats.inngest.completed,
      stats.inngest.failed,
      stats.github_actions.pending,
      stats.github_actions.processing,
      stats.github_actions.completed,
      stats.github_actions.failed,
      canMakeAPICalls ? '✅ Yes' : '❌ No (rate limited)',
      getQueueHealthStatus(stats.total.pending, stats.total.completed, stats.total.failed || 0)
    );`
  },
  {
    // Line 164-174: rateLimits() method
    old: /console\.log\(`\n🔒 Rate Limit Status:[\s\S]*?\n    `\);/,
    replacement: `console.log(
      '\\n🔒 Rate Limit Status:\\n' +
      '━━━━━━━━━━━━━━━━━━━━\\n' +
      '\\n✅ Can make 1 API call: %s\\n' +
      '⚡ Can make 10 API calls: %s\\n' +
      '🚀 Can make 100 API calls: %s\\n' +
      '\\n💡 Recommendations:\\n' +
      '%s',
      canMake1 ? 'Yes' : 'No',
      canMake10 ? 'Yes' : 'No',
      canMake100 ? 'Yes' : 'No',
      getBatchCapabilityMessage(canMake100, canMake10, !canMake1)
    );`
  },
  {
    // Line 212-217: analyzeCommits() method
    old: /console\.log\(`\n✅ Commit analysis queued for \$\{owner\}\/\$\{repo\}:[\s\S]*?\n      `\);/,
    replacement: `console.log(
      '\\n✅ Commit analysis queued for %s/%s:\\n' +
      '  • %s commits queued for PR association analysis\\n' +
      '  • This will enable YOLO coder detection\\n' +
      '  • Use ProgressiveCapture.processNext() to process manually',
      owner,
      repo,
      queuedCount
    );`
  },
  {
    // Line 348-355: quickFix() method
    old: /console\.log\(`\n✅ Quick fix queued for \$\{owner\}\/\$\{repo\}:[\s\S]*?\n        `\);/,
    replacement: `console.log(
      '\\n✅ Quick fix queued for %s/%s:\\n' +
      '  • Recent data: Queued (%s processor)\\n' +
      '  • Historical data: Queued (%s processor)\\n' +
      '  • AI Summary: %s\\n' +
      '  • Total: %s jobs queued\\n' +
      '  • Smart routing: Recent data → Inngest, Historical data → GitHub Actions',
      owner,
      repo,
      recentJob.processor,
      historicalJob.processor,
      aiSummaryQueued ? 'Queued' : 'Skipped (recent)',
      totalJobs
    );`
  },
  {
    // Line 406-420: routingAnalysis() method
    old: /console\.log\(`\n🎯 Routing Effectiveness Analysis:[\s\S]*?\n      `\);/,
    replacement: `console.log(
      '\\n🎯 Routing Effectiveness Analysis:\\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n' +
      '\\n📈 Routing Accuracy: %s%\\n' +
      '✅ Correct Routing: %s jobs\\n' +
      '⚠️ Suboptimal Routing: %s jobs\\n' +
      '\\n%s',
      routing.routingAccuracy.toFixed(1),
      routing.correctRouting,
      routing.suboptimalRouting,
      routing.suggestions.length > 0
        ? \`💡 Suggestions:\\n\${routing.suggestions.map((s) => \`  • \${s}\`).join('\\n')}\`
        : '✅ No routing issues detected'
    );`
  }
];

// Apply each fix
fixes.forEach((fix, index) => {
  const newContent = content.replace(fix.old, fix.replacement);
  if (newContent === content) {
    console.error('Fix ' + (index + 1) + ' did not match!');
  } else {
    content = newContent;
    console.log('Applied fix ' + (index + 1));
  }
});

// Also fix the template literal console.error/warn statements
content = content.replace(
  /console\.error\(`❌ Commit analysis failed for \$\{owner\}\/\$\{repo\}:`, error\);/g,
  "console.error('❌ Commit analysis failed for %s/%s:', owner, repo, error);"
);

content = content.replace(
  /console\.warn\(`Failed to store PR #\$\{pr\.number\}: \$\{result\.error\}`\);/g,
  "console.warn('Failed to store PR #%s: %s', pr.number, result.error);"
);

content = content.replace(
  /console\.warn\(`Error storing PR #\$\{pr\.number\}:`, prError\);/g,
  "console.warn('Error storing PR #%s:', pr.number, prError);"
);

content = content.replace(
  /console\.log\(\s*`✅ Imported \$\{importedCount\}\/\$\{recentPRs\.length\} recent PRs for \$\{repo\.owner\}\/\$\{repo\.name\}`\s*\);/g,
  "console.log('✅ Imported %s/%s recent PRs for %s/%s', importedCount, recentPRs.length, repo.owner, repo.name);"
);

content = content.replace(
  /console\.error\(`❌ Error processing recent PRs job:`, error\);/g,
  "console.error('❌ Error processing recent PRs job:', error);"
);

content = content.replace(
  /console\.warn\(`⚠️ Large repository detected: \$\{owner\}\/\$\{repo\} has \$\{prCount\} PRs`\);/g,
  "console.warn('⚠️ Large repository detected: %s/%s has %s PRs', owner, repo, prCount);"
);

// Write the fixed content back
fs.writeFileSync(filePath, content);
console.log('\\nFixed all template literal console statements in manual-trigger.ts!');