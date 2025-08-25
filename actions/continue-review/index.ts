import * as core from '@actions/core';
import * as github from '@actions/github';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';

interface Rule {
  file: string;
  globs: string;
  description?: string;
  alwaysApply?: boolean;
  content: string;
}

interface PRFile {
  filename: string;
  patch?: string;
  additions: number;
  deletions: number;
}

interface ReviewContext {
  pr: {
    number: number;
    title: string;
    body: string;
    author: string;
    files: PRFile[];
  };
  rules: Rule[];
  command?: string;
  repository: string;
}

/**
 * Load and parse rules from .continue/rules directory
 */
async function loadRules(changedFiles: string[]): Promise<Rule[]> {
  const rules: Rule[] = [];
  const rulesDir = '.continue/rules';

  try {
    const ruleFiles = await glob(`${rulesDir}/*.md`);
    
    for (const ruleFile of ruleFiles) {
      const content = await fs.readFile(ruleFile, 'utf-8');
      const rule = parseRule(ruleFile, content);
      
      if (rule && shouldApplyRule(rule, changedFiles)) {
        rules.push(rule);
      }
    }
  } catch (error) {
    core.warning(`Failed to load rules: ${error}`);
  }

  return rules;
}

/**
 * Parse a rule file with YAML frontmatter
 */
function parseRule(filepath: string, content: string): Rule | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!frontmatterMatch) {
    return null;
  }

  try {
    const frontmatter = yaml.load(frontmatterMatch[1]) as Record<string, unknown>;
    const ruleContent = frontmatterMatch[2].trim();

    return {
      file: path.basename(filepath),
      globs: String(frontmatter.globs || '**/*'),
      description: frontmatter.description as string | undefined,
      alwaysApply: frontmatter.alwaysApply as boolean | undefined,
      content: ruleContent,
    };
  } catch (error) {
    core.warning(`Failed to parse rule ${filepath}: ${error}`);
    return null;
  }
}

/**
 * Check if a rule should apply to the changed files
 */
function shouldApplyRule(rule: Rule, changedFiles: string[]): boolean {
  if (rule.alwaysApply === false) {
    return false;
  }

  if (rule.alwaysApply === true) {
    return true;
  }

  // Check if any changed file matches the rule's glob pattern
  const patterns = rule.globs.split(',').map(p => p.trim());
  
  for (const file of changedFiles) {
    for (const pattern of patterns) {
      if (matchesPattern(file, pattern)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Simple glob pattern matching
 */
function matchesPattern(filepath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/\{([^}]+)\}/g, (_, group) => `(${group.split(',').join('|')})`);
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filepath);
}

/**
 * Generate review using Continue CLI
 */
async function generateReview(
  context: ReviewContext,
  continueConfig: string,
  continueApiKey: string,
): Promise<string> {
  // Build the review prompt
  let prompt = `You are reviewing a pull request. Please provide constructive feedback.

Pull Request Information
- Title: ${context.pr.title}
- Description: ${context.pr.body || 'No description provided'}
- Files changed: ${context.pr.files.length}
- Repository: ${context.repository}
`;

  if (context.command) {
    prompt = `You are reviewing a pull request. The user has provided a specific request: "${context.command}"

${prompt}

User Request
${context.command}

Please address the user's specific request while reviewing the code changes below.
`;
  }

  // Add applicable rules
  if (context.rules.length > 0) {
    prompt += '\n\nProject Rules to Consider\n';
    prompt += 'The following project-specific rules apply to this review:\n\n';
    
    for (const rule of context.rules) {
      prompt += `### ${rule.description || rule.file}\n`;
      prompt += `${rule.content}\n\n`;
    }
  }

  // Add code changes (truncate if too large)
  prompt += '\nCode Changes\n';
  let diffContent = '';
  
  for (const file of context.pr.files) {
    if (file.patch) {
      diffContent += `\n=== File: ${file.filename} ===\n${file.patch}\n`;
    }
  }

  // Truncate if too large (12KB limit)
  if (diffContent.length > 12000) {
    diffContent = diffContent.substring(0, 11000) + '\n... (diff truncated due to size)';
  }

  prompt += diffContent;
  prompt += '\n\nYour Review\n';
  prompt += 'Please provide your code review feedback below:';

  // Write prompt to temp file for headless mode
  const tempFile = path.join('/tmp', `continue-review-${Date.now()}.txt`);
  await fs.writeFile(tempFile, prompt);

  try {
    // Call Continue CLI
    core.info('Calling Continue CLI for review...');
    core.info(`Using Continue config: ${continueConfig}`);
    core.info(`Prompt length: ${prompt.length} characters`);
    core.info(`Prompt file: ${tempFile}`);

    // First check if Continue CLI is available
    await new Promise<void>((resolve, reject) => {
      exec('which cn', (error, stdout) => {
        if (error) {
          core.error('Continue CLI not found. Make sure @continuedev/cli is installed.');
          reject(new Error('Continue CLI not found'));
        } else {
          core.info(`Continue CLI found at: ${stdout.trim()}`);
          resolve();
        }
      });
    });

    // Use headless mode with -p flag and file input
    const command = `cn --config ${continueConfig} -p @${tempFile}`;
    core.info(`Executing command: cn --config ${continueConfig} -p @${tempFile}`);
    
    const { stdout, stderr } = await new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
      exec(
        command,
        {
          env: {
            ...process.env,
            CONTINUE_API_KEY: continueApiKey,
          },
          timeout: 120000, // 2 minutes
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large responses
        },
        (error, stdout, stderr) => {
          if (error) {
            core.error(`Continue CLI error: ${error.message}`);
            reject(error);
          } else {
            core.info(`Continue CLI completed successfully`);
            resolve({ stdout, stderr });
          }
        }
      );
    });

    if (stderr) {
      core.warning(`Continue CLI stderr: ${stderr}`);
    }

    // Clean up temp file
    await fs.unlink(tempFile).catch(() => {});

    // Clean up the response
    let review = stdout.trim();
    
    core.info(`Raw Continue CLI output length: ${stdout.length} characters`);
    core.info(`First 500 chars of output: ${stdout.substring(0, 500)}`);
    
    // Remove ANSI codes
    // eslint-disable-next-line no-control-regex
    review = review.replace(/\x1b\[[0-9;]*m/g, '');
    
    core.info(`Cleaned review length: ${review.length} characters`);

    if (!review) {
      core.warning('Continue CLI returned an empty response');
      return 'Continue CLI returned an empty response. Please check the configuration.';
    }

    core.info(`Review content preview: ${review.substring(0, 200)}...`);
    return review;
  } catch (error) {
    // Clean up temp file
    await fs.unlink(tempFile).catch(() => {});

    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('not found') || errorMessage.includes('ENOENT')) {
      return 'Continue CLI is not properly installed. Please ensure @continuedev/cli is installed globally.';
    } else if (errorMessage.includes('config') || errorMessage.includes('assistant')) {
      return `Continue configuration error. Please verify that the assistant '${continueConfig}' exists in Continue Hub.`;
    } else if (errorMessage.includes('api') || errorMessage.includes('auth')) {
      return 'Continue API authentication failed. Please check your CONTINUE_API_KEY.';
    }

    return `Failed to generate review. Error: ${errorMessage}`;
  }
}

/**
 * Post or update review comment
 */
async function postReview(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  review: string,
  isProgress: boolean = false,
  updateCommentId?: number,
): Promise<number | undefined> {
  const marker = '<!-- continue-agent-review -->';
  const timestamp = new Date().toISOString();
  
  core.info(`Posting review comment to PR #${prNumber} (isProgress: ${isProgress})`);
  core.info(`Review length: ${review.length} characters`);
  
  let body = `## 🤖 Continue Agent Review\n\n`;
  
  if (isProgress) {
    body += review;
  } else {
    body += '**✅ Review Complete**\n\n';
    body += review;
    body += `\n\n---\n*Last updated: ${timestamp} | Powered by [Continue](https://continue.dev)*`;
  }
  
  body = `${marker}\n${body}`;
  core.info(`Comment body length: ${body.length} characters`);

  try {
    if (updateCommentId) {
      // Update existing comment
      core.info(`Updating existing comment ${updateCommentId}`);
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: updateCommentId,
        body,
      });
      core.info(`Successfully updated comment ${updateCommentId}`);
      return updateCommentId;
    } else {
      // Try to find existing comment
      core.info(`Looking for existing comment with marker`);
      const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
        per_page: 100,
      });
      
      core.info(`Found ${comments.length} existing comments`);

      const existingComment = comments.find(c => 
        c.body?.includes(marker)
      );

      if (existingComment) {
        // Update existing comment
        core.info(`Updating existing comment ${existingComment.id}`);
        await octokit.rest.issues.updateComment({
          owner,
          repo,
          comment_id: existingComment.id,
          body,
        });
        core.info(`Successfully updated comment ${existingComment.id}`);
        return existingComment.id;
      } else {
        // Create new comment
        core.info(`Creating new comment on PR #${prNumber}`);
        const { data: newComment } = await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body,
        });
        core.info(`Successfully created comment ${newComment.id}`);
        return newComment.id;
      }
    }
  } catch (error) {
    core.error(`Failed to post review: ${error}`);
    if (error instanceof Error) {
      core.error(`Error message: ${error.message}`);
      core.error(`Error stack: ${error.stack}`);
    }
    throw error;
  }
}

/**
 * Extract command from comment
 */
function extractCommand(comment: string): string | undefined {
  const match = comment.match(/@continue-agent\s+(.+)/);
  return match ? match[1].trim() : undefined;
}

/**
 * Main action entry point
 */
async function run(): Promise<void> {
  try {
    // Get inputs - in composite actions, inputs are passed as INPUT_ env vars
    const githubToken = process.env.INPUT_GITHUB_TOKEN || core.getInput('github-token', { required: true });
    const continueApiKey = process.env.INPUT_CONTINUE_API_KEY || core.getInput('continue-api-key', { required: true });
    const continueConfig = process.env.INPUT_CONTINUE_CONFIG || core.getInput('continue-config', { required: true });
    const continueOrg = process.env.INPUT_CONTINUE_ORG || core.getInput('continue-org', { required: true });

    // Validate inputs
    if (!githubToken) {
      throw new Error('github-token is required');
    }
    if (!continueApiKey) {
      throw new Error('continue-api-key is required');
    }
    if (!continueConfig) {
      throw new Error('continue-config is required');
    }

    // Get context
    const context = github.context;
    const { owner, repo } = context.repo;
    
    core.info(`Repository: ${owner}/${repo}`);
    core.info(`Event: ${context.eventName}`);
    core.info(`Continue Config: ${continueConfig}`);
    core.info(`Continue Org: ${continueOrg || 'not specified'}`);

    // Determine PR number
    let prNumber: number | undefined;
    
    core.info(`Context payload: ${JSON.stringify(context.payload, null, 2).substring(0, 1000)}`);
    
    if (context.eventName === 'pull_request') {
      prNumber = context.payload.pull_request?.number;
      core.info(`Pull request event, PR number: ${prNumber}`);
    } else if (context.eventName === 'issue_comment') {
      prNumber = context.payload.issue?.number;
      core.info(`Issue comment event, issue number: ${prNumber}`);
      
      // Only process if it's a PR comment with @continue-agent
      if (!context.payload.issue?.pull_request) {
        core.info('Not a pull request comment, skipping');
        return;
      }
      
      const comment = context.payload.comment?.body || '';
      if (!comment.includes('@continue-agent')) {
        core.info('Comment does not mention @continue-agent, skipping');
        return;
      }
    } else if (context.eventName === 'workflow_dispatch') {
      // For manual workflow dispatch, need to find the PR for this branch
      core.info('Workflow dispatch event - searching for associated PR');
      
      // Initialize GitHub client early to search for PR
      const octokit = github.getOctokit(githubToken);
      
      // Get the current branch name
      const branch = context.ref.replace('refs/heads/', '');
      core.info(`Current branch: ${branch}`);
      
      try {
        // Search for open PRs from this branch
        const { data: prs } = await octokit.rest.pulls.list({
          owner,
          repo,
          head: `${owner}:${branch}`,
          state: 'open',
        });
        
        if (prs.length > 0) {
          prNumber = prs[0].number;
          core.info(`Found PR #${prNumber} for branch ${branch}`);
        } else {
          core.warning(`No open PR found for branch ${branch}`);
        }
      } catch (error) {
        core.error(`Failed to search for PRs: ${error}`);
      }
    }

    if (!prNumber) {
      core.error('Could not determine pull request number from context');
      core.error(`Event name: ${context.eventName}`);
      core.error(`Has PR in payload: ${!!context.payload.pull_request}`);
      throw new Error('Could not determine pull request number');
    }

    core.info(`Processing PR #${prNumber}`);

    // Initialize GitHub client
    const octokit = github.getOctokit(githubToken);

    // Get PR details
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Get PR diff
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    // Load rules
    const rules = await loadRules(files.map(f => f.filename));
    core.info(`Loaded ${rules.length} applicable rules`);

    // Extract command from comment if present
    let command: string | undefined;
    if (context.eventName === 'issue_comment') {
      const commentBody = context.payload.comment?.body || '';
      command = extractCommand(commentBody);
    }

    // Create review context
    const reviewContext: ReviewContext = {
      pr: {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        author: pr.user?.login || 'unknown',
        files: files.map(f => ({
          filename: f.filename,
          patch: f.patch || '',
          additions: f.additions,
          deletions: f.deletions,
        })),
      },
      rules,
      command,
      repository: `${owner}/${repo}`,
    };

    // Post initial progress comment
    core.info('Posting initial progress comment...');
    const progressCommentId = await postReview(
      octokit,
      owner,
      repo,
      prNumber,
      '🔄 **Review in progress...**\n\nI\'m analyzing the changes in this pull request. This may take a moment.',
      true, // isProgress
    );
    core.info(`Progress comment ID: ${progressCommentId}`);

    // Generate review using Continue
    core.info('Generating review with Continue CLI...');
    const review = await generateReview(
      reviewContext,
      continueConfig,
      continueApiKey,
    );
    core.info(`Generated review length: ${review.length} characters`);

    // Post final review
    core.info('Posting final review comment...');
    await postReview(
      octokit,
      owner,
      repo,
      prNumber,
      review,
      false, // isProgress
      progressCommentId,
    );

    core.info('Review completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

// Run the action
run();