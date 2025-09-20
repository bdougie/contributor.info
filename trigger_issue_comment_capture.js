// Script to log instructions for triggering issue comment capture
// This script provides instructions on how to manually trigger data capture

async function triggerIssueCommentCapture() {
  const owner = 'continuedev';
  const repo = 'continue';

  console.log(`Triggering issue comment capture for ${owner}/${repo}...`);

  // Log the action we would take
  console.log(`
To capture issue comments for this repository, you can:

1. Use the manual trigger in the UI:
   - Go to the repository page
   - Click on the sync/refresh button
   - Select "Sync Issue Comments"

2. Or run this in the browser console:
   await window.ProgressiveCapture.quickFix('${owner}', '${repo}')

3. Or wait for the background processor to pick it up automatically
   (runs periodically based on repository activity)
`);
}

triggerIssueCommentCapture();
