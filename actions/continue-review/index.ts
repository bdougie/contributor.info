import * as core from '@actions/core';
import * as github from '@actions/github';
import { exec, execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';
import { getAuthenticatedOctokit } from './github-app-auth';
import { analyzeCodebasePatterns } from './codebase-analyzer';
import { generateEnhancedPrompt } from './enhanced-prompt-generator';
import { ReviewMetricsTracker, parseReviewMetrics, extractProjectType } from './review-metrics';

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

/**
 * Validates that a CLI path is safe to execute
 * @param cliPath The path to validate
 * @returns true if the path is safe, false otherwise
 */
function isValidCliPath(cliPath: string): boolean {
  // Ensure the path doesn't contain dangerous characters
  const dangerousPatterns = [';', '&&', '||', '`', '$', '>', '<', '|', '\n', '\r'];
  for (const pattern of dangerousPatterns) {
    if (cliPath.includes(pattern)) {
      core.error(`CLI path contains dangerous character: ${pattern}`);
      return false;
    }
  }

  // Ensure the path is within expected locations
  const validPrefixes = [
    '/usr/local/bin/',
    '/usr/bin/',
    process.env.GITHUB_ACTION_PATH || process.cwd(),
    'node_modules/.bin/',
  ];

  const isValidLocation = validPrefixes.some(
    (prefix) => cliPath.startsWith(prefix) || cliPath === 'cn'
  );

  if (!isValidLocation) {
    core.error(`CLI path is not in a valid location: ${cliPath}`);
    return false;
  }

  return true;
}

/**
 * Detects and validates the Continue CLI installation
 * @returns Object with availability status and validated path
 */
async function detectContinueCLI(): Promise<{ available: boolean; path: string }> {
  const isDebugMode = process.env.DEBUG_MODE === 'true';

  if (isDebugMode) {
    core.info('Starting Continue CLI detection...');
  }

  // First, try system-wide installation
  const systemCheck = await new Promise<string | null>((resolve) => {
    exec('which cn', (error, stdout) => {
      if (!error && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        resolve(null);
      }
    });
  });

  if (systemCheck) {
    if (isDebugMode) {
      core.info(`System-wide Continue CLI found at: ${systemCheck}`);
    }

    // Verify it's executable
    const versionCheck = await new Promise<boolean>((resolve) => {
      exec('cn --version', (error, output) => {
        if (!error) {
          if (isDebugMode) {
            core.info(`Continue CLI version: ${output.trim()}`);
          }
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });

    if (versionCheck && isValidCliPath('cn')) {
      return { available: true, path: 'cn' };
    }
  }

  // Try local installation
  const actionPath = process.env.GITHUB_ACTION_PATH || process.cwd();
  const localPaths = [
    `${actionPath}/node_modules/.bin/cn`,
    `${process.cwd()}/node_modules/.bin/cn`,
    './node_modules/.bin/cn',
  ];

  for (const localPath of localPaths) {
    if (isDebugMode) {
      core.info(`Checking local path: ${localPath}`);
    }

    const localCheck = await new Promise<boolean>((resolve) => {
      exec(`${localPath} --version`, (error, output) => {
        if (!error) {
          if (isDebugMode) {
            core.info(`Found Continue CLI at ${localPath}: ${output.trim()}`);
          }
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });

    if (localCheck && isValidCliPath(localPath)) {
      return { available: true, path: localPath };
    }
  }

  // Check if package is installed but binary not accessible
  if (isDebugMode) {
    const packageCheck = await new Promise<boolean>((resolve) => {
      exec('npm list @continuedev/cli 2>/dev/null', (error, output) => {
        resolve(!error && output.includes('@continuedev/cli'));
      });
    });

    if (packageCheck) {
      core.warning('Continue CLI package is installed but binary not accessible');
      core.info('PATH: ' + process.env.PATH);
    } else {
      core.error('Continue CLI is not installed');
    }
  }

  return { available: false, path: '' };
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
  const rulesDir = path.join(process.cwd(), '.continue', 'rules');

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
  const patterns = rule.globs.split(',').map((p) => p.trim());

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
 * Generate enhanced review using Continue CLI with codebase analysis
 */
async function generateEnhancedReview(
  context: ReviewContext,
  continueConfig: string,
  continueApiKey: string,
  githubToken: string
): Promise<{ review: string; metrics: any }> {
  const startTime = Date.now();

  try {
    const isDebugMode = process.env.DEBUG_MODE === 'true';

    // Phase 1: Analyze codebase patterns for enhanced context
    if (isDebugMode) {
      core.info('Analyzing codebase patterns for enhanced context...');
    }
    const projectContext = await analyzeCodebasePatterns(context.pr.files.map((f) => f.filename));

    // Phase 2: Generate enhanced prompt with codebase insights
    if (isDebugMode) {
      core.info('Generating enhanced review prompt...');
    }
    const enhancedPrompt = generateEnhancedPrompt(context, projectContext);

    if (isDebugMode) {
      core.info(`Enhanced prompt length: ${enhancedPrompt.length} characters`);
      core.info(`Detected patterns: ${projectContext.patterns.length}`);
      core.info(
        `Project type: ${extractProjectType(
          projectContext.conventions.dependencies.frameworks,
          projectContext.conventions.dependencies.libraries
        )}`
      );
    }

    // Write enhanced prompt to temp file
    const tempFile = path.join('/tmp', `continue-enhanced-review-${Date.now()}.txt`);
    await fs.writeFile(tempFile, enhancedPrompt);

    try {
      // Detect and validate Continue CLI
      const cliDetection = await detectContinueCLI();

      if (!cliDetection.available) {
        throw new Error(
          'Continue CLI could not be found or executed. Please check the action setup.'
        );
      }

      const cliPath = cliDetection.path;

      // Execute enhanced review with Continue CLI
      const command = `${cliPath} --config ${continueConfig} -p @${tempFile} --allow Bash`;

      if (isDebugMode) {
        core.info(`Executing enhanced review: ${command}`);
        core.info(`Continue API Key is set: ${continueApiKey ? 'Yes' : 'No'}`);
        core.info(`GitHub Token is set: ${githubToken ? 'Yes' : 'No'}`);
      } else {
        core.info('Executing enhanced review with Continue CLI...');
      }

      const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>(
        (resolve, reject) => {
          const childProcess = exec(
            command,
            {
              env: {
                ...process.env,
                CONTINUE_API_KEY: continueApiKey,
                GITHUB_TOKEN: githubToken,
                GH_TOKEN: githubToken,
              },
              timeout: 420000, // 7 minutes (increased for enhanced analysis)
              maxBuffer: 15 * 1024 * 1024, // 15MB buffer for larger responses
            },
            (error, stdout, stderr) => {
              if (error) {
                core.error(`Continue CLI error: ${error.message}`);
                if (error.code && error.code.toString() === 'ETIMEDOUT') {
                  core.error('Continue CLI execution timed out after 7 minutes');
                }
                if (error.signal) {
                  core.error(`Process killed with signal: ${error.signal}`);
                }
                if (stderr) {
                  core.error(`Continue CLI stderr: ${stderr}`);
                }
                reject(error);
              } else {
                if (isDebugMode) {
                  core.info(`Enhanced review completed successfully`);
                }
                resolve({ stdout, stderr });
              }
            }
          );

          // Log PID for debugging
          if (childProcess.pid && isDebugMode) {
            core.info(`Continue CLI process started with PID: ${childProcess.pid}`);
          }
        }
      );

      if (stderr) {
        core.warning(`Continue CLI stderr: ${stderr}`);
      }

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {});

      // Process the response
      let review = stdout.trim();

      // Remove ANSI codes
      review = review.replace(/\x1b\[[0-9;]*m/g, '');

      const processingTime = Math.round((Date.now() - startTime) / 1000);
      if (isDebugMode) {
        core.info(`Enhanced review processing time: ${processingTime}s`);
      }

      if (!review) {
        core.warning('Continue CLI returned an empty response');
        return {
          review:
            'Enhanced review analysis completed, but no specific feedback was generated. The code appears to follow established patterns.',
          metrics: {
            processingTime,
            promptLength: enhancedPrompt.length,
            responseLength: 0,
            rulesApplied: context.rules.length,
            patternsDetected: projectContext.patterns.length,
          },
        };
      }

      return {
        review,
        metrics: {
          processingTime,
          promptLength: enhancedPrompt.length,
          responseLength: review.length,
          rulesApplied: context.rules.length,
          patternsDetected: projectContext.patterns.length,
        },
      };
    } catch (error) {
      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {});

      const errorMessage = error instanceof Error ? error.message : String(error);
      core.error(`Enhanced review failed: ${errorMessage}`);

      // Fallback to basic review message
      return {
        review: `Enhanced review analysis encountered an issue: ${errorMessage}. Please verify Continue CLI configuration.`,
        metrics: {
          processingTime: Math.round((Date.now() - startTime) / 1000),
          promptLength: enhancedPrompt.length,
          responseLength: 0,
          rulesApplied: context.rules.length,
          patternsDetected: projectContext.patterns.length,
        },
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(`Codebase analysis failed: ${errorMessage}`);

    // Fallback to original review approach
    core.info('Falling back to standard review approach...');
    return generateStandardReview(context, continueConfig, continueApiKey, githubToken);
  }
}

/**
 * Fallback to standard review if enhanced analysis fails
 */
async function generateStandardReview(
  context: ReviewContext,
  continueConfig: string,
  continueApiKey: string,
  githubToken: string
): Promise<{ review: string; metrics: any }> {
  const startTime = Date.now();

  // Use the original prompt generation logic as fallback
  let prompt = `You are reviewing a pull request. Please provide helpful, context-aware feedback.

CONTEXT:
- Repository: ${context.repository}
- PR Title: ${context.pr.title}
- Files Changed: ${context.pr.files.length}
- Author: ${context.pr.author}

REVIEW APPROACH:
1. First, understand what this PR is trying to accomplish
2. Check if similar patterns exist elsewhere in the codebase
3. Focus on actual issues that affect functionality
4. Be constructive and suggest solutions when possible

FOCUS ON:
- Bugs that will cause failures or incorrect behavior
- Security vulnerabilities (exposed secrets, injection risks)
- Breaking changes that affect other parts of the system
- Performance issues with real impact (memory leaks, O(n²) algorithms)
- Missing tests for new features or bug fixes
- Missing documentation for APIs or complex logic

SKIP COMMENTING ON:
- Style and formatting (handled by linters)
- Alternative approaches unless current is broken
- Minor naming unless genuinely confusing
- Trivial documentation for self-explanatory code

Be specific with line numbers and explain why something is an issue.

PR Description: ${context.pr.body || 'No description provided'}
`;

  if (context.command) {
    prompt = `Review with specific focus requested by user.

User Request: "${context.command}"

${prompt}

Please address the user's specific request while also checking for any significant issues in the code.
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

  // Add code changes
  prompt += '\nCode Changes\n';
  let diffContent = '';
  let isTruncated = false;

  for (const file of context.pr.files) {
    if (file.patch) {
      diffContent += `\n=== File: ${file.filename} ===\n${file.patch}\n`;
    }
  }

  if (diffContent.length > 12000) {
    isTruncated = true;
    diffContent = diffContent.substring(0, 11000) + '\n\n**⚠️ DIFF TRUNCATED**: Review only visible portions.';
  }

  prompt += diffContent;
  
  if (isTruncated) {
    prompt += '\n\n**IMPORTANT**: The diff was truncated due to size. DO NOT mention the truncation in your review. Simply review the visible code and provide actionable feedback on what you can see. If you need to see specific files to provide a complete review, mention viewing them directly in the GitHub PR.';
  }
  prompt += '\n\nYour Review\n';
  prompt += 'IMPORTANT: Start your review with a clear TLDR recommendation at the very top:\n\n';
  prompt += '## 🎯 TLDR\n';
  prompt +=
    "**Recommendation**: [Choose one: MERGE ✅ | DON'T MERGE ❌ | MERGE AFTER CHANGES 🔄]\n";
  prompt +=
    '**Summary**: [One or two lines explaining the main reason for this recommendation]\n\n';
  prompt += '---\n\n';
  prompt += 'Then provide constructive feedback on the code changes.\n';
  prompt += 'Focus on issues that matter for functionality, security, and maintainability.\n';
  prompt += 'If the code looks good overall, acknowledge that while noting any minor suggestions.\n';
  prompt += '\n**DO NOT mention diff truncation** - just review what you can see and provide actionable feedback.';

  // Write prompt to temp file for headless mode
  const tempFile = path.join('/tmp', `continue-review-fallback-${Date.now()}.txt`);
  await fs.writeFile(tempFile, prompt);

  try {
    // Call Continue CLI for fallback review
    core.info('Fallback: Calling Continue CLI for standard review...');

    // Detect and validate Continue CLI
    const cliDetection = await detectContinueCLI();

    if (!cliDetection.available) {
      throw new Error('Continue CLI not found for fallback review');
    }

    const cliPath = cliDetection.path;

    // Execute Continue CLI with the prompt
    const command = `${cliPath} --config ${continueConfig} -p @${tempFile} --allow Bash`;

    const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      exec(
        command,
        {
          env: {
            ...process.env,
            CONTINUE_API_KEY: continueApiKey,
            GITHUB_TOKEN: githubToken,
            GH_TOKEN: githubToken,
          },
          timeout: 360000,
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        }
      );
    });

    // Clean up temp file
    await fs.unlink(tempFile).catch(() => {});

    return {
      review: stdout.trim() || 'Review completed but no output generated.',
      metrics: {
        processingTime: Math.round((Date.now() - startTime) / 1000),
        promptLength: prompt.length,
        responseLength: stdout.length,
        rulesApplied: context.rules.length,
        patternsDetected: 0,
      },
    };
  } catch (error) {
    // Clean up temp file on error
    await fs.unlink(tempFile).catch(() => {});

    core.warning(`Fallback Continue CLI failed: ${error}`);
    return {
      review: 'Unable to generate review. Both enhanced and standard Continue CLI analysis failed.',
      metrics: {
        processingTime: Math.round((Date.now() - startTime) / 1000),
        promptLength: prompt.length,
        responseLength: 0,
        rulesApplied: context.rules.length,
        patternsDetected: 0,
      },
    };
  }
}

/**
 * Post or update review comment with enhanced formatting
 */
async function postEnhancedReview(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  review: string,
  metricsTracker: ReviewMetricsTracker,
  isProgress: boolean = false,
  updateCommentId?: number
): Promise<number | undefined> {
  const marker = '<!-- continue-agent-review -->';
  const timestamp = new Date().toISOString();

  core.info(`Posting enhanced review comment to PR #${prNumber} (isProgress: ${isProgress})`);

  let body = '';

  if (isProgress) {
    body = review;
  } else {
    // Add review content
    body += review;

    body += `\n\n---\n<!-- ${timestamp} | Powered by Continue (https://continue.dev) -->`;
  }

  body = `${marker}\n${body}`;

  try {
    if (updateCommentId) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: updateCommentId,
        body,
      });
      core.info(`Successfully updated enhanced comment ${updateCommentId}`);
      return updateCommentId;
    } else {
      // Find existing comment and update/create as needed
      const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
        per_page: 100,
      });

      const continueComments = comments
        .filter((c) => c.body?.includes(marker))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const existingComment = continueComments[0];

      if (existingComment) {
        const commentAge = Date.now() - new Date(existingComment.created_at).getTime();
        const oneHour = 60 * 60 * 1000;

        if (commentAge < oneHour) {
          await octokit.rest.issues.updateComment({
            owner,
            repo,
            comment_id: existingComment.id,
            body,
          });
          core.info(`Successfully updated existing enhanced comment ${existingComment.id}`);
          return existingComment.id;
        }
      }

      // Create new comment
      const { data: newComment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
      core.info(`Successfully created enhanced comment ${newComment.id}`);
      return newComment.id;
    }
  } catch (error) {
    core.error(`Failed to post enhanced review: ${error}`);
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
 * Main enhanced action entry point
 */
async function run(): Promise<void> {
  try {
    core.info('🚀 Starting Enhanced Continue Review Action...');

    // Debug: Log environment and context
    core.info('=== Debug Information ===');
    core.info(`Action: ${process.env.GITHUB_ACTION}`);
    core.info(`Event Name: ${process.env.GITHUB_EVENT_NAME}`);
    core.info(`Workflow: ${process.env.GITHUB_WORKFLOW}`);
    core.info(`Run ID: ${process.env.GITHUB_RUN_ID}`);
    core.info(`Run Number: ${process.env.GITHUB_RUN_NUMBER}`);

    // Get inputs
    const githubToken =
      process.env.INPUT_GITHUB_TOKEN || core.getInput('github-token', { required: true });
    const continueApiKey =
      process.env.INPUT_CONTINUE_API_KEY || core.getInput('continue-api-key', { required: true });
    const continueConfig =
      process.env.INPUT_CONTINUE_CONFIG || core.getInput('continue-config', { required: true });
    const continueOrg =
      process.env.INPUT_CONTINUE_ORG || core.getInput('continue-org', { required: true });

    // Validate inputs
    if (!githubToken) {
      core.error('GitHub token is missing');
      throw new Error('Required input missing: github-token');
    }
    if (!continueApiKey) {
      core.error('Continue API key is missing');
      throw new Error('Required input missing: continue-api-key');
    }
    if (!continueConfig) {
      core.error('Continue config is missing');
      throw new Error('Required input missing: continue-config');
    }

    const context = github.context;
    const { owner, repo } = context.repo;

    core.info(`Enhanced review for: ${owner}/${repo}`);
    core.info(`Event: ${context.eventName}`);
    core.info(`Event Action: ${context.payload.action || 'N/A'}`);
    core.info(`Continue Config: ${continueConfig}`);

    // Initialize metrics tracker
    const metricsTracker = new ReviewMetricsTracker();

    // Initialize GitHub client early for reactions
    core.info('Initializing GitHub client...');
    const octokit = await getAuthenticatedOctokit(githubToken);
    core.info('GitHub client initialized successfully');

    // Determine PR number (using existing logic)
    let prNumber: number | undefined;

    if (context.eventName === 'pull_request') {
      prNumber = context.payload.pull_request?.number;
      core.info(`Processing pull_request event for PR #${prNumber}`);
    } else if (context.eventName === 'issue_comment') {
      core.info('Processing issue_comment event...');
      prNumber = context.payload.issue?.number;

      // Debug logging for issue comment
      core.info(`Issue number: ${prNumber}`);
      core.info(`Is PR: ${context.payload.issue?.pull_request ? 'Yes' : 'No'}`);
      core.info(`Comment ID: ${context.payload.comment?.id}`);
      core.info(`Comment Author: ${context.payload.comment?.user?.login}`);

      if (!context.payload.issue?.pull_request) {
        core.info('Not a pull request comment, skipping');
        return;
      }

      const comment = context.payload.comment?.body || '';
      core.info(`Comment body (first 200 chars): ${comment.substring(0, 200)}`);

      if (!comment.includes('@continue-agent')) {
        core.info('Comment does not mention @continue-agent, skipping');
        return;
      }

      core.info('Found @continue-agent mention, proceeding with review...');

      // Add 👀 reaction to confirm the bot is processing the request
      const commentId = context.payload.comment?.id;
      if (commentId) {
        try {
          core.info(`Adding reaction to comment ${commentId}...`);
          await octokit.rest.reactions.createForIssueComment({
            owner,
            repo,
            comment_id: commentId,
            content: 'eyes',
          });
          core.info(`✅ Added 👀 reaction to comment ${commentId}`);
        } catch (error) {
          core.warning(`Failed to add reaction: ${error}`);
          // Log more details about the error
          if (error instanceof Error) {
            core.warning(`Error message: ${error.message}`);
            core.warning(`Error stack: ${error.stack}`);
          }
        }
      }
    } else if (context.eventName === 'workflow_dispatch') {
      const branch = context.ref.replace('refs/heads/', '');

      try {
        const { data: prs } = await octokit.rest.pulls.list({
          owner,
          repo,
          head: `${owner}:${branch}`,
          state: 'open',
        });

        if (prs.length > 0) {
          prNumber = prs[0].number;
        }
      } catch (error) {
        core.error(`Failed to search for PRs: ${error}`);
      }
    }

    if (!prNumber) {
      throw new Error('Could not determine pull request number');
    }

    core.info(`Processing enhanced review for PR #${prNumber}`);

    // Get PR details
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    // Load rules
    const rules = await loadRules(files.map((f) => f.filename));
    core.info(`Loaded ${rules.length} applicable rules for enhanced review`);

    // Extract command if present
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
        files: files.map((f) => ({
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
    core.info('Posting enhanced progress indicator...');
    const progressCommentId = await postEnhancedReview(
      octokit,
      owner,
      repo,
      prNumber,
      "🔄 **Review in Progress**\n\n✨ Analyzing codebase patterns and conventions...\n📊 Generating contextual insights...\n🎯 Preparing strategic feedback...\n\n*This review considers your project's specific patterns and architecture.*",
      metricsTracker,
      true
    );

    // Generate enhanced review
    core.info('Generating enhanced review with codebase analysis...');
    const { review, metrics } = await generateEnhancedReview(
      reviewContext,
      continueConfig,
      continueApiKey,
      githubToken
    );

    // Parse review metrics
    const reviewAnalysis = parseReviewMetrics(review);

    // Record metrics
    const reviewMetrics = {
      timestamp: new Date().toISOString(),
      repository: `${owner}/${repo}`,
      prNumber: pr.number,
      prAuthor: pr.user?.login || 'unknown',
      filesChanged: files.length,
      reviewerId: continueConfig,
      metrics: {
        ...metrics,
        issuesFound: reviewAnalysis.issuesFound,
      },
      context: {
        hasCustomCommand: !!command,
        projectType: 'Unknown', // Will be updated by metrics tracker
        mainLanguages: files.map((f) => path.extname(f.filename)).filter(Boolean),
      },
    };

    await metricsTracker.recordReviewMetrics(reviewMetrics);

    // Post final enhanced review
    core.info('Posting final enhanced review...');
    await postEnhancedReview(
      octokit,
      owner,
      repo,
      prNumber,
      review,
      metricsTracker,
      false,
      progressCommentId
    );

    core.info('🎉 Enhanced review completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`Enhanced review failed: ${error.message}`);
    } else {
      core.setFailed('An unknown error occurred during enhanced review');
    }
  }
}

// Run the enhanced action
run();
