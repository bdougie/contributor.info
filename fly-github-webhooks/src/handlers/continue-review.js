import Logger from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Continue Review Handler
 * Handles AI-powered code reviews using Continue Agent
 * Triggers on PR opened/synchronize/ready_for_review and @continue-agent comments
 */

const CONTINUE_MARKER = '<!-- continue-agent-review -->';

export async function handleContinueReview(payload, githubApp, supabase, parentLogger) {
  const logger = parentLogger ? parentLogger.child('ContinueReview') : new Logger('ContinueReview');

  const { pull_request: pr, repository: repo, installation, action } = payload;

  // Only process opened, synchronize, and ready_for_review events
  if (!['opened', 'synchronize', 'ready_for_review'].includes(action)) {
    logger.info('Skipping action %s - only handling opened/synchronize/ready_for_review', action);
    return { success: true, skipped: true };
  }

  // Skip if PR is still a draft
  if (pr.draft) {
    logger.info('Skipping draft PR #%s', pr.number);
    return { success: true, skipped: true };
  }

  logger.info('Processing Continue review for PR #%s in %s', pr.number, repo.full_name);

  try {
    // Get installation Octokit
    const octokit = await githubApp.getInstallationOctokit(installation.id);

    // Check if Continue API is configured
    if (!process.env.CONTINUE_API_KEY) {
      logger.warn('CONTINUE_API_KEY not configured, skipping review');
      return { success: true, skipped: true };
    }

    // Post progress comment
    const progressCommentId = await postProgressComment(octokit, repo, pr.number, logger);

    // Get PR files
    const files = await getPRFiles(octokit, repo, pr.number, logger);

    // Load rules from repository
    const rules = await loadRules(octokit, repo, files, logger);

    // Generate review
    const review = await generateReview(
      {
        pr: {
          number: pr.number,
          title: pr.title,
          body: pr.body || '',
          author: pr.user.login,
          files,
        },
        rules,
        repository: repo.full_name,
      },
      logger
    );

    // Post final review
    await postFinalReview(octokit, repo, pr.number, review, progressCommentId, logger);

    logger.info('✅ Posted Continue review on PR #%s', pr.number);

    return { success: true, reviewed: true };
  } catch (error) {
    logger.error('Error handling Continue review:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle issue comment events for @continue-agent commands
 */
export async function handleContinueReviewComment(payload, githubApp, supabase, parentLogger) {
  const logger = parentLogger
    ? parentLogger.child('ContinueReviewComment')
    : new Logger('ContinueReviewComment');

  const { issue, comment, repository: repo, installation, action } = payload;

  // Only process created comments on PRs
  if (action !== 'created' || !issue.pull_request) {
    return { success: true, skipped: true };
  }

  // Check for @continue-agent mention
  if (!comment.body.includes('@continue-agent')) {
    return { success: true, skipped: true };
  }

  logger.info('Processing @continue-agent comment on PR #%s', issue.number);

  try {
    const octokit = await githubApp.getInstallationOctokit(installation.id);

    // Check if Continue API is configured
    if (!process.env.CONTINUE_API_KEY) {
      logger.warn('CONTINUE_API_KEY not configured, skipping review');
      return { success: true, skipped: true };
    }

    // Add 👀 reaction
    await octokit.rest.reactions.createForIssueComment({
      owner: repo.owner.login,
      repo: repo.name,
      comment_id: comment.id,
      content: 'eyes',
    });

    // Get PR details
    const { data: pr } = await octokit.rest.pulls.get({
      owner: repo.owner.login,
      repo: repo.name,
      pull_number: issue.number,
    });

    // Get PR files
    const files = await getPRFiles(octokit, repo, issue.number, logger);

    // Load rules
    const rules = await loadRules(octokit, repo, files, logger);

    // Extract command
    const commandMatch = comment.body.match(/@continue-agent\s+(.+)/);
    const command = commandMatch ? commandMatch[1].trim() : undefined;

    // Generate review with command
    const review = await generateReview(
      {
        pr: {
          number: pr.number,
          title: pr.title,
          body: pr.body || '',
          author: pr.user.login,
          files,
        },
        rules,
        command,
        repository: repo.full_name,
      },
      logger
    );

    // Post as reply comment (not sticky, conversational)
    await postReplyComment(octokit, repo, issue.number, review, command, logger);

    logger.info('✅ Posted Continue review from comment on PR #%s', issue.number);

    return { success: true, reviewed: true };
  } catch (error) {
    logger.error('Error handling Continue review comment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Post progress comment
 */
async function postProgressComment(octokit, repo, prNumber, logger) {
  const body = `${CONTINUE_MARKER}
🔄 **Review in Progress**

✨ Analyzing codebase patterns and conventions...
📊 Generating contextual insights...
🎯 Preparing strategic feedback...

*This review considers your project's specific patterns and architecture.*`;

  try {
    const { data: comment } = await octokit.rest.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: prNumber,
      body,
    });

    logger.info('Posted progress comment %d', comment.id);
    return comment.id;
  } catch (error) {
    logger.warn('Failed to post progress comment:', error.message);
    return undefined;
  }
}

/**
 * Get PR files
 */
async function getPRFiles(octokit, repo, prNumber, logger) {
  const allFiles = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner: repo.owner.login,
      repo: repo.name,
      pull_number: prNumber,
      per_page: 100,
      page,
    });

    allFiles.push(
      ...files.map((f) => ({
        filename: f.filename,
        patch: f.patch || '',
        additions: f.additions,
        deletions: f.deletions,
      }))
    );

    hasMore = files.length === 100;
    page++;
  }

  logger.info('PR #%d has %d files', prNumber, allFiles.length);
  return allFiles;
}

/**
 * Load rules from .continue/rules/*.md
 */
async function loadRules(octokit, repo, files, logger) {
  const rules = [];

  try {
    // Get rules directory contents
    const { data: contents } = await octokit.rest.repos.getContent({
      owner: repo.owner.login,
      repo: repo.name,
      path: '.continue/rules',
    }).catch(() => ({ data: [] }));

    if (!Array.isArray(contents)) {
      return rules;
    }

    // Filter for .md files
    const ruleFiles = contents.filter((file) => file.name.endsWith('.md'));

    // Load each rule file
    for (const file of ruleFiles) {
      try {
        const { data: fileData } = await octokit.rest.repos.getContent({
          owner: repo.owner.login,
          repo: repo.name,
          path: file.path,
        });

        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
        const rule = parseRule(file.name, content, files);

        if (rule) {
          rules.push(rule);
        }
      } catch (error) {
        logger.warn('Failed to load rule %s:', file.name, error.message);
      }
    }

    logger.info('Loaded %d applicable rules', rules.length);
  } catch (error) {
    logger.warn('Failed to load rules:', error.message);
  }

  return rules;
}

/**
 * Parse a rule file with YAML frontmatter
 */
function parseRule(filename, content, changedFiles) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return null;
  }

  try {
    // Simple YAML parsing for our use case
    const frontmatter = {};
    const lines = frontmatterMatch[1].split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        frontmatter[match[1]] = match[2].replace(/^["'](.+)["']$/, '$1');
      }
    }

    const ruleContent = frontmatterMatch[2].trim();
    const globs = frontmatter.globs || '**/*';
    const alwaysApply = frontmatter.alwaysApply === 'true';

    // Check if rule applies
    if (!alwaysApply) {
      const applies = changedFiles.some((file) =>
        matchesGlob(file.filename, globs)
      );

      if (!applies) {
        return null;
      }
    }

    return {
      file: filename,
      globs,
      description: frontmatter.description,
      content: ruleContent,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Simple glob matching
 */
function matchesGlob(filepath, pattern) {
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
async function generateReview(context, logger) {
  const startTime = Date.now();

  try {
    // Build prompt
    let prompt = `You are reviewing a pull request. Provide helpful, context-aware feedback.

CONTEXT:
- Repository: ${context.repository}
- PR Title: ${context.pr.title}
- Files Changed: ${context.pr.files.length}
- Author: ${context.pr.author}

REVIEW APPROACH:
1. Understand what this PR is trying to accomplish
2. Check for actual issues that affect functionality
3. Be constructive and suggest solutions

FOCUS ON:
- Bugs that will cause failures
- Security vulnerabilities
- Breaking changes
- Performance issues with real impact
- Missing tests for new features

SKIP:
- Style and formatting (handled by linters)
- Alternative approaches unless current is broken

PR Description: ${context.pr.body || 'No description provided'}
`;

    if (context.command) {
      prompt = `User Request: "${context.command}"\n\n${prompt}`;
    }

    // Add rules
    if (context.rules.length > 0) {
      prompt += '\n\nProject Rules:\n';
      for (const rule of context.rules) {
        prompt += `### ${rule.description || rule.file}\n${rule.content}\n\n`;
      }
    }

    // Add code changes
    prompt += '\nCode Changes:\n';
    let diffContent = '';

    for (const file of context.pr.files) {
      if (file.patch) {
        diffContent += `\n=== ${file.filename} ===\n${file.patch}\n`;
      }
    }

    if (diffContent.length > 12000) {
      diffContent = diffContent.substring(0, 11000) + '\n... (truncated)';
    }

    prompt += diffContent;
    prompt += '\n\nProvide your review with a TLDR at the top.';

    // Write prompt to temp file
    const tempFile = join(tmpdir(), `continue-review-${Date.now()}.txt`);
    await writeFile(tempFile, prompt);

    // Execute Continue CLI
    const continueConfig = process.env.CONTINUE_CONFIG || 'continuedev/review-bot';
    const command = `cn --config ${continueConfig} -p @${tempFile} --allow Bash`;

    logger.info('Executing Continue CLI...');

    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        CONTINUE_API_KEY: process.env.CONTINUE_API_KEY,
      },
      timeout: 420000, // 7 minutes
      maxBuffer: 15 * 1024 * 1024,
    });

    // Clean up temp file
    await unlink(tempFile).catch(() => {});

    if (stderr) {
      logger.warn('Continue CLI stderr:', stderr);
    }

    // Remove ANSI codes
    let review = stdout.trim().replace(/\x1b\[[0-9;]*m/g, '');

    const processingTime = Math.round((Date.now() - startTime) / 1000);
    logger.info('Review generated in %ds', processingTime);

    return review || 'Review completed but no specific feedback was generated.';
  } catch (error) {
    logger.error('Failed to generate review:', error.message);
    throw error;
  }
}

/**
 * Post final review
 */
async function postFinalReview(octokit, repo, prNumber, review, progressCommentId, logger) {
  const timestamp = new Date().toISOString();
  const body = `${CONTINUE_MARKER}
${review}

---
<!-- ${timestamp} | Powered by Continue (https://continue.dev) -->`;

  try {
    if (progressCommentId) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner: repo.owner.login,
        repo: repo.name,
        comment_id: progressCommentId,
        body,
      });
      logger.info('Updated comment %d', progressCommentId);
    } else {
      // Create new comment
      const { data: comment } = await octokit.rest.issues.createComment({
        owner: repo.owner.login,
        repo: repo.name,
        issue_number: prNumber,
        body,
      });
      logger.info('Posted comment %d', comment.id);
    }
  } catch (error) {
    logger.error('Failed to post review:', error.message);
    throw error;
  }
}

/**
 * Post reply comment (for @continue-agent mentions)
 * Creates a new comment thread rather than editing sticky comment
 */
async function postReplyComment(octokit, repo, prNumber, review, command, logger) {
  const timestamp = new Date().toISOString();
  const commandText = command ? `\n**Request**: ${command}\n` : '';
  const body = `${CONTINUE_MARKER}
${commandText}
${review}

---
<!-- ${timestamp} | Powered by Continue (https://continue.dev) -->`;

  try {
    const { data: comment } = await octokit.rest.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: prNumber,
      body,
    });
    logger.info('Posted reply comment %d', comment.id);
  } catch (error) {
    logger.error('Failed to post reply comment:', error.message);
    throw error;
  }
}