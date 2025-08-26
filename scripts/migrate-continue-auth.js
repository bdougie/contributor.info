#!/usr/bin/env node

/**
 * Migration script to update Continue Review workflows to use secure GitHub App authentication
 * Usage: node migrate-continue-auth.js <workflow-file.yml>
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const SECURE_AUTH_TEMPLATE = `
      # Generate secure GitHub App token (recommended)
      - name: Generate App Token
        id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: \${{ vars.CONTINUE_APP_ID }}
          private-key: \${{ secrets.CONTINUE_APP_PRIVATE_KEY }}
`;

function migrateWorkflow(filePath) {
  try {
    console.log(`\n📋 Processing: ${filePath}`);
    
    // Read the workflow file
    const content = fs.readFileSync(filePath, 'utf8');
    const workflow = yaml.load(content);
    
    // Check if this is a Continue Review workflow
    let hasContinueReview = false;
    let updated = false;
    
    // Look for Continue Review action in jobs
    for (const jobName in workflow.jobs) {
      const job = workflow.jobs[jobName];
      if (!job.steps) continue;
      
      for (let i = 0; i < job.steps.length; i++) {
        const step = job.steps[i];
        
        // Check if this is a Continue Review step
        if (step.uses && step.uses.includes('continue-review')) {
          hasContinueReview = true;
          console.log(`  ✓ Found Continue Review action in job: ${jobName}`);
          
          // Check if already using secure auth
          if (step.with && step.with['app-token-generated'] === 'true') {
            console.log(`  ℹ️  Already using secure authentication`);
            continue;
          }
          
          // Check if there's already an app token generation step
          const hasAppToken = job.steps.some(s => 
            s.uses && s.uses.includes('create-github-app-token')
          );
          
          if (!hasAppToken) {
            console.log(`  🔄 Adding GitHub App token generation step`);
            
            // Insert the token generation step before Continue Review
            const tokenStep = {
              name: 'Generate App Token',
              id: 'app-token',
              uses: 'actions/create-github-app-token@v1',
              with: {
                'app-id': '${{ vars.CONTINUE_APP_ID }}',
                'private-key': '${{ secrets.CONTINUE_APP_PRIVATE_KEY }}'
              }
            };
            
            job.steps.splice(i, 0, tokenStep);
            i++; // Adjust index since we inserted a step
          }
          
          // Update Continue Review step to use the App token
          console.log(`  🔄 Updating Continue Review to use App token`);
          
          if (!step.with) step.with = {};
          
          // Update github-token to use the generated token
          step.with['github-token'] = '${{ steps.app-token.outputs.token }}';
          
          // Add flags for secure authentication
          step.with['app-token-generated'] = 'true';
          step.with['disable-embedded-auth'] = 'true';
          
          // Ensure continue-org is set (required parameter)
          if (!step.with['continue-org']) {
            step.with['continue-org'] = 'your-org';
            console.log(`  ⚠️  Added placeholder for 'continue-org' - please update`);
          }
          
          updated = true;
        }
      }
    }
    
    if (!hasContinueReview) {
      console.log(`  ⚠️  No Continue Review action found in this workflow`);
      return false;
    }
    
    if (!updated) {
      console.log(`  ✅ Workflow already using secure authentication`);
      return false;
    }
    
    // Write the updated workflow
    const updatedContent = yaml.dump(workflow, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false
    });
    
    // Create backup
    const backupPath = `${filePath}.backup-${Date.now()}`;
    fs.writeFileSync(backupPath, content);
    console.log(`  📦 Created backup: ${backupPath}`);
    
    // Write updated workflow
    fs.writeFileSync(filePath, updatedContent);
    console.log(`  ✅ Updated workflow saved`);
    
    // Print required secrets/variables
    console.log(`\n📝 Required Configuration:`);
    console.log(`  Repository/Organization Variables:`);
    console.log(`    - CONTINUE_APP_ID: Your GitHub App ID`);
    console.log(`  Repository/Organization Secrets:`);
    console.log(`    - CONTINUE_APP_PRIVATE_KEY: Your GitHub App private key`);
    console.log(`    - CONTINUE_API_KEY: Your Continue API key`);
    
    return true;
  } catch (error) {
    console.error(`  ❌ Error processing workflow: ${error.message}`);
    return false;
  }
}

function findWorkflows(dir) {
  const workflowsDir = path.join(dir, '.github', 'workflows');
  
  if (!fs.existsSync(workflowsDir)) {
    console.log(`No .github/workflows directory found in ${dir}`);
    return [];
  }
  
  return fs.readdirSync(workflowsDir)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map(file => path.join(workflowsDir, file));
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Continue Review Authentication Migration Tool

This tool helps migrate Continue Review workflows to use secure GitHub App authentication.

Usage:
  node migrate-continue-auth.js <workflow-file>     # Migrate specific workflow
  node migrate-continue-auth.js --all               # Migrate all workflows in .github/workflows
  node migrate-continue-auth.js --check             # Check workflows without modifying

For more information, see:
https://github.com/bdougie/contributor.info/blob/main/actions/continue-review/SECURE_AUTH_GUIDE.md
`);
    process.exit(0);
  }
  
  const checkOnly = args.includes('--check');
  let workflows = [];
  
  if (args.includes('--all')) {
    workflows = findWorkflows(process.cwd());
  } else {
    workflows = args.filter(arg => !arg.startsWith('--'));
  }
  
  if (workflows.length === 0) {
    console.log('No workflow files specified or found');
    process.exit(1);
  }
  
  console.log(`\n🔍 Analyzing ${workflows.length} workflow(s)...`);
  
  let migrated = 0;
  for (const workflow of workflows) {
    if (checkOnly) {
      console.log(`\n📋 Checking: ${workflow}`);
      // TODO: Implement check-only mode
    } else {
      if (migrateWorkflow(workflow)) {
        migrated++;
      }
    }
  }
  
  console.log(`\n✨ Migration complete: ${migrated} workflow(s) updated`);
  
  if (migrated > 0) {
    console.log(`\n🔐 Next Steps:`);
    console.log(`1. Create a GitHub App: https://github.com/settings/apps/new`);
    console.log(`2. Configure App permissions (Contents: Read, Issues: Write, PRs: Write)`);
    console.log(`3. Generate and store the private key as CONTINUE_APP_PRIVATE_KEY secret`);
    console.log(`4. Store the App ID as CONTINUE_APP_ID variable`);
    console.log(`5. Install the App on your repositories`);
    console.log(`6. Update 'continue-org' values in migrated workflows`);
    console.log(`7. Test with a sample pull request`);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { migrateWorkflow, findWorkflows };