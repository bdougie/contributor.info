"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const glob_1 = require("glob");
/**
 * Load and parse rules from .continue/rules directory
 */
async function loadRules(changedFiles) {
    const rules = [];
    const rulesDir = '.continue/rules';
    try {
        const ruleFiles = await (0, glob_1.glob)(`${rulesDir}/*.md`);
        for (const ruleFile of ruleFiles) {
            const content = await fs.readFile(ruleFile, 'utf-8');
            const rule = parseRule(ruleFile, content);
            if (rule && shouldApplyRule(rule, changedFiles)) {
                rules.push(rule);
            }
        }
    }
    catch (error) {
        core.warning(`Failed to load rules: ${error}`);
    }
    return rules;
}
/**
 * Parse a rule file with YAML frontmatter
 */
function parseRule(filepath, content) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
        return null;
    }
    try {
        const frontmatter = yaml.load(frontmatterMatch[1]);
        const ruleContent = frontmatterMatch[2].trim();
        return {
            file: path.basename(filepath),
            globs: String(frontmatter.globs || '**/*'),
            description: frontmatter.description,
            alwaysApply: frontmatter.alwaysApply,
            content: ruleContent,
        };
    }
    catch (error) {
        core.warning(`Failed to parse rule ${filepath}: ${error}`);
        return null;
    }
}
/**
 * Check if a rule should apply to the changed files
 */
function shouldApplyRule(rule, changedFiles) {
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
function matchesPattern(filepath, pattern) {
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
async function generateReview(context, continueConfig, continueApiKey) {
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
    // Write prompt to temp file
    const tempFile = path.join('/tmp', `continue-review-${Date.now()}.txt`);
    await fs.writeFile(tempFile, prompt);
    try {
        // Call Continue CLI
        core.info('Calling Continue CLI for review...');
        core.info(`Using Continue config: ${continueConfig}`);
        // Use stdin to pass the prompt
        const { stdout, stderr } = await new Promise((resolve, reject) => {
            const child = (0, child_process_1.exec)(`cn --config ${continueConfig}`, {
                env: {
                    ...process.env,
                    CONTINUE_API_KEY: continueApiKey,
                },
                timeout: 120000, // 2 minutes
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve({ stdout, stderr });
                }
            });
            // Write prompt to stdin
            if (child.stdin) {
                child.stdin.write(prompt);
                child.stdin.end();
            }
        });
        if (stderr) {
            core.warning(`Continue CLI stderr: ${stderr}`);
        }
        // Clean up temp file
        await fs.unlink(tempFile).catch(() => { });
        // Clean up the response
        let review = stdout.trim();
        // Remove ANSI codes
        // eslint-disable-next-line no-control-regex
        review = review.replace(/\x1b\[[0-9;]*m/g, '');
        if (!review) {
            return 'Continue CLI returned an empty response. Please check the configuration.';
        }
        return review;
    }
    catch (error) {
        // Clean up temp file
        await fs.unlink(tempFile).catch(() => { });
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('not found') || errorMessage.includes('ENOENT')) {
            return 'Continue CLI is not properly installed. Please ensure @continuedev/cli is installed globally.';
        }
        else if (errorMessage.includes('config') || errorMessage.includes('assistant')) {
            return `Continue configuration error. Please verify that the assistant '${continueConfig}' exists in Continue Hub.`;
        }
        else if (errorMessage.includes('api') || errorMessage.includes('auth')) {
            return 'Continue API authentication failed. Please check your CONTINUE_API_KEY.';
        }
        return `Failed to generate review. Error: ${errorMessage}`;
    }
}
/**
 * Post or update review comment
 */
async function postReview(octokit, owner, repo, prNumber, review, isProgress = false, updateCommentId) {
    const marker = '<!-- continue-agent-review -->';
    const timestamp = new Date().toISOString();
    let body = `## 🤖 Continue Agent Review\n\n`;
    if (isProgress) {
        body += review;
    }
    else {
        body += '**✅ Review Complete**\n\n';
        body += review;
        body += `\n\n---\n*Last updated: ${timestamp} | Powered by [Continue](https://continue.dev)*`;
    }
    body = `${marker}\n${body}`;
    try {
        if (updateCommentId) {
            // Update existing comment
            await octokit.rest.issues.updateComment({
                owner,
                repo,
                comment_id: updateCommentId,
                body,
            });
            return updateCommentId;
        }
        else {
            // Try to find existing comment
            const { data: comments } = await octokit.rest.issues.listComments({
                owner,
                repo,
                issue_number: prNumber,
                per_page: 100,
            });
            const existingComment = comments.find(c => c.body?.includes(marker));
            if (existingComment) {
                // Update existing comment
                await octokit.rest.issues.updateComment({
                    owner,
                    repo,
                    comment_id: existingComment.id,
                    body,
                });
                return existingComment.id;
            }
            else {
                // Create new comment
                const { data: newComment } = await octokit.rest.issues.createComment({
                    owner,
                    repo,
                    issue_number: prNumber,
                    body,
                });
                return newComment.id;
            }
        }
    }
    catch (error) {
        core.error(`Failed to post review: ${error}`);
        throw error;
    }
}
/**
 * Extract command from comment
 */
function extractCommand(comment) {
    const match = comment.match(/@continue-agent\s+(.+)/);
    return match ? match[1].trim() : undefined;
}
/**
 * Main action entry point
 */
async function run() {
    try {
        // Get inputs
        const githubToken = core.getInput('github-token', { required: true });
        const continueApiKey = core.getInput('continue-api-key', { required: true });
        const continueConfig = core.getInput('continue-config', { required: true });
        // Get context
        const context = github.context;
        const { owner, repo } = context.repo;
        core.info(`Repository: ${owner}/${repo}`);
        core.info(`Event: ${context.eventName}`);
        // Determine PR number
        let prNumber;
        if (context.eventName === 'pull_request') {
            prNumber = context.payload.pull_request?.number;
        }
        else if (context.eventName === 'issue_comment') {
            prNumber = context.payload.issue?.number;
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
        }
        if (!prNumber) {
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
        let command;
        if (context.eventName === 'issue_comment') {
            const commentBody = context.payload.comment?.body || '';
            command = extractCommand(commentBody);
        }
        // Create review context
        const reviewContext = {
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
        const progressCommentId = await postReview(octokit, owner, repo, prNumber, '🔄 **Review in progress...**\n\nI\'m analyzing the changes in this pull request. This may take a moment.', true);
        // Generate review using Continue
        const review = await generateReview(reviewContext, continueConfig, continueApiKey);
        // Post final review
        await postReview(octokit, owner, repo, prNumber, review, false, // isProgress
        progressCommentId);
        core.info('Review completed successfully');
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed('An unknown error occurred');
        }
    }
}
// Run the action
run();
