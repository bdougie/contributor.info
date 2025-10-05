import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs/promises';
import * as path from 'path';
import glob from 'glob';
import * as yaml from 'js-yaml';

interface Rule {
  globs?: string[];
  description: string;
  content: string;
  name: string;
}

interface DocumentationIssue {
  file: string;
  line?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  rule: string;
}

async function loadRules(rulesPath: string): Promise<Rule[]> {
  const rules: Rule[] = [];

  try {
    // Validate rules path
    if (!rulesPath || typeof rulesPath !== 'string') {
      throw new Error('Invalid rules path provided');
    }

    // Sanitize the path to prevent directory traversal
    const sanitizedPath = path.resolve(rulesPath);
    if (!sanitizedPath.includes(process.cwd())) {
      throw new Error('Rules path must be within the project directory');
    }

    // Find all .md files in the rules directory
    const ruleFiles = glob.sync(`${sanitizedPath}/*.md`);

    for (const file of ruleFiles) {
      const content = await fs.readFile(file, 'utf-8');

      // Parse YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = yaml.load(frontmatterMatch[1]) as {
          globs?: string[];
          description: string;
        };
        const ruleContent = content.replace(/^---\n[\s\S]*?\n---\n/, '');

        const ruleName = path.basename(file, '.md');
        rules.push({
          globs: frontmatter.globs,
          description: frontmatter.description,
          content: ruleContent,
          name: ruleName,
        });

        core.info(`Loaded rule from ${path.basename(file)}: ${frontmatter.description}`);
      }
    }
  } catch (error) {
    core.warning(`Failed to load rules: ${error}`);
  }

  return rules;
}

async function getChangedDocFiles(): Promise<string[]> {
  const token = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN || '';
  const octokit = github.getOctokit(token);
  const context = github.context;

  let pullNumber: number | undefined;

  // Handle different event contexts
  if (context.payload.pull_request) {
    // Direct pull_request event
    pullNumber = context.payload.pull_request.number;
  } else if (context.payload.issue?.pull_request) {
    // issue_comment event on a PR
    pullNumber = context.payload.issue.number;
  } else if (process.env.INPUT_PR_NUMBER) {
    // workflow_dispatch with pr_number input
    pullNumber = parseInt(process.env.INPUT_PR_NUMBER, 10);
    if (isNaN(pullNumber) || pullNumber <= 0) {
      core.warning(`Invalid PR number provided: ${process.env.INPUT_PR_NUMBER}`);
      pullNumber = undefined;
    } else {
      core.info(`Using PR number from workflow_dispatch: #${pullNumber}`);
    }
  }

  if (!pullNumber) {
    core.info('No pull request context found');
    return [];
  }

  const { data: files } = await octokit.rest.pulls.listFiles({
    ...context.repo,
    pull_number: pullNumber,
  });

  // Filter for all markdown files
  const docFiles = files
    .filter((file) => file.filename.endsWith('.md'))
    .map((file) => file.filename);

  core.info(`Found ${docFiles.length} documentation files changed`);
  return docFiles;
}

async function checkAgainstRule(content: string, lines: string[], file: string, rule: Rule): Promise<DocumentationIssue[]> {
  const issues: DocumentationIssue[] = [];
  const ruleName = rule.name;

  // Apply rule-specific checks
  switch (ruleName) {
    case 'documentation-scannable-format':
      issues.push(...checkScannableFormat(content, lines, file));
      break;
    case 'copywriting':
      issues.push(...checkCopywriting(content, lines, file));
      break;
    default:
      // Generic check for other rules
      break;
  }

  return issues;
}

function checkScannableFormat(content: string, lines: string[], file: string): DocumentationIssue[] {
  const issues: DocumentationIssue[] = [];

  // Check for multiple consecutive paragraphs without visual breaks
  let consecutiveParagraphs = 0;
  let paragraphStartLine = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || '';

    const isTextLine = line && !line.startsWith('#') && !line.startsWith('-') && 
                       !line.startsWith('*') && !line.startsWith('```') && 
                       !line.startsWith('|') && !line.startsWith('>') &&
                       !line.startsWith('<') && !line.match(/^\d+\./);
    
    const isNextTextLine = nextLine && !nextLine.startsWith('#') && !nextLine.startsWith('-') && 
                           !nextLine.startsWith('*') && !nextLine.startsWith('```') && 
                           !nextLine.startsWith('|') && !nextLine.startsWith('>') &&
                           !nextLine.startsWith('<') && !nextLine.match(/^\d+\./);

    if (isTextLine) {
      if (consecutiveParagraphs === 0) {
        paragraphStartLine = i + 1;
      }
      
      if (isNextTextLine) {
        consecutiveParagraphs++;
        if (consecutiveParagraphs >= 3) {
          issues.push({
            file,
            line: paragraphStartLine,
            message: `Found ${consecutiveParagraphs + 1} consecutive paragraphs without visual breaks. Add code examples, bullet points, tables, or images to improve scannability.`,
            severity: 'warning',
            rule: 'documentation-scannable-format',
          });
          consecutiveParagraphs = 0; // Reset to avoid duplicate warnings
        }
      } else {
        consecutiveParagraphs = 0;
      }
    } else if (!line) {
      consecutiveParagraphs = 0;
    }
  }

  // Check for lack of code examples in technical documentation
  const hasCodeExample = content.includes('```');
  const isTechnicalDoc = file.includes('feature') || file.includes('setup') || 
                         file.includes('guide') || file.includes('implementation') ||
                         file.includes('api');
  
  if (isTechnicalDoc && !hasCodeExample) {
    issues.push({
      file,
      message: 'Technical documentation should include code examples to improve clarity and scannability',
      severity: 'info',
      rule: 'documentation-scannable-format',
    });
  }

  return issues;
}

function checkCopywriting(content: string, lines: string[], file: string): DocumentationIssue[] {
  const issues: DocumentationIssue[] = [];

  // Check for passive voice patterns
  const passivePatterns = [
    { pattern: /\b(is|are|was|were|been|being)\s+\w+ed\b/i, example: 'Use active voice: "Deploy the app" instead of "The app is deployed"' },
    { pattern: /\b(has|have|had)\s+been\s+\w+ed\b/i, example: 'Use active voice: "We updated the feature" instead of "The feature has been updated"' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip code blocks and headings
    if (line.trim().startsWith('```') || line.trim().startsWith('#')) {
      continue;
    }
    
    for (const { pattern, example } of passivePatterns) {
      if (pattern.test(line)) {
        issues.push({
          file,
          line: i + 1,
          message: `Avoid passive voice. ${example}`,
          severity: 'info',
          rule: 'copywriting',
        });
        break;
      }
    }
  }

  // Check for marketing speak and fluff
  const fluffPatterns = [
    { pattern: /\b(unlock|unleash|empower|revolutionize|transform|supercharge)\b/i, message: 'Avoid marketing speak. Be clear and direct.' },
    { pattern: /\b(blazingly|incredibly|amazingly|extremely)\s+(fast|powerful|simple)\b/i, message: 'Remove hyperbolic adjectives. State facts instead.' },
    { pattern: /\b(100%|completely|totally)\s+(secure|safe|reliable|guaranteed)\b/i, message: 'Avoid absolute claims. Be precise and realistic.' },
    { pattern: /\b(seamless|cutting-edge|state-of-the-art|next-generation|world-class)\b/i, message: 'Avoid vague buzzwords. Use specific, measurable descriptions.' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```') || line.trim().startsWith('#')) {
      continue;
    }
    
    for (const { pattern, message } of fluffPatterns) {
      if (pattern.test(line)) {
        issues.push({
          file,
          line: i + 1,
          message,
          severity: 'warning',
          rule: 'copywriting',
        });
        break;
      }
    }
  }

  // Check for TODO comments
  const todoPattern = /\b(TODO|FIXME|XXX|HACK|WIP)\b/i;
  for (let i = 0; i < lines.length; i++) {
    if (todoPattern.test(lines[i])) {
      const match = lines[i].match(todoPattern);
      issues.push({
        file,
        line: i + 1,
        message: `Documentation contains ${match?.[0] || 'TODO'} marker. Complete or remove before publishing.`,
        severity: 'error',
        rule: 'copywriting',
      });
    }
  }

  // Check for overly long sentences (> 30 words)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('-') || line.startsWith('```')) {
      continue;
    }
    
    const sentences = line.split(/[.!?]+/);
    for (const sentence of sentences) {
      const wordCount = sentence.trim().split(/\s+/).length;
      if (wordCount > 30) {
        issues.push({
          file,
          line: i + 1,
          message: `Sentence is too long (${wordCount} words). Break into smaller sentences for better readability.`,
          severity: 'info',
          rule: 'copywriting',
        });
        break;
      }
    }
  }

  // Check for redundant phrases
  const redundantPhrases = [
    { pattern: /\bin order to\b/gi, replacement: 'to' },
    { pattern: /\bdue to the fact that\b/gi, replacement: 'because' },
    { pattern: /\bat this point in time\b/gi, replacement: 'now' },
    { pattern: /\bfor the purpose of\b/gi, replacement: 'to' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```') || line.trim().startsWith('#')) {
      continue;
    }
    
    for (const { pattern, replacement } of redundantPhrases) {
      if (pattern.test(line)) {
        issues.push({
          file,
          line: i + 1,
          message: `Replace redundant phrase with "${replacement}" for conciseness`,
          severity: 'info',
          rule: 'copywriting',
        });
      }
    }
  }

  return issues;
}

async function analyzeDocumentation(files: string[], rules: Rule[]): Promise<DocumentationIssue[]> {
  const issues: DocumentationIssue[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      // Check each rule
      for (const rule of rules) {
        // Check if this rule applies to this file
        if (rule.globs && rule.globs.length > 0) {
          const matchesAnyGlob = rule.globs.some((pattern) => {
            const matches = glob.sync(pattern);
            return matches.includes(file);
          });
          if (!matchesAnyGlob) {
            continue;
          }
        }

        // Apply rule-specific checks
        const ruleIssues = await checkAgainstRule(content, lines, file, rule);
        issues.push(...ruleIssues);
      }
    } catch (error) {
      core.warning(`Failed to analyze ${file}: ${error}`);
    }
  }

  return issues;
}

async function postReviewComments(issues: DocumentationIssue[]): Promise<void> {
  const token = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN || '';
  if (!token) {
    core.warning('No GitHub token available, skipping review posting');
    return;
  }

  const octokit = github.getOctokit(token);
  const context = github.context;

  let pullNumber: number | undefined;

  // Handle different event contexts (same logic as getChangedDocFiles)
  if (context.payload.pull_request) {
    pullNumber = context.payload.pull_request.number;
  } else if (context.payload.issue?.pull_request) {
    pullNumber = context.payload.issue.number;
  } else if (process.env.INPUT_PR_NUMBER) {
    pullNumber = parseInt(process.env.INPUT_PR_NUMBER, 10);
    if (isNaN(pullNumber) || pullNumber <= 0) {
      core.warning(`Invalid PR number provided: ${process.env.INPUT_PR_NUMBER}`);
      pullNumber = undefined;
    }
  }

  if (!pullNumber) {
    core.info('No pull request context found, skipping comment posting');
    return;
  }

  // Check for ANY existing review from our bot to avoid duplicates
  try {
    const { data: reviews } = await octokit.rest.pulls.listReviews({
      ...context.repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    // Check if we already posted ANY documentation review on this PR
    const existingReview = reviews.find(
      (r) =>
        (r.user?.login === 'github-actions[bot]' ||
          r.user?.login?.includes('continue') ||
          r.user?.login?.includes('docs-review')) &&
        (r.body?.includes('<!-- docs-review-action -->') ||
          r.body?.includes('📚 Documentation Review'))
    );

    if (existingReview) {
      core.info('Documentation review already exists for this PR - skipping duplicate');
      return;
    }

    // Also check comments for existing review
    const { data: comments } = await octokit.rest.issues.listComments({
      ...context.repo,
      issue_number: pullNumber,
      per_page: 100,
    });

    const existingComment = comments.find(
      (c) =>
        (c.user?.login === 'github-actions[bot]' ||
          c.user?.login?.includes('continue') ||
          c.user?.login?.includes('docs-review')) &&
        (c.body?.includes('<!-- docs-review-action -->') ||
          c.body?.includes('📚 Documentation Review'))
    );

    if (existingComment) {
      core.info('Documentation review comment already exists - skipping duplicate');
      return;
    }
  } catch (error) {
    core.warning(`Failed to check existing reviews: ${error}`);
  }

  // Group issues by file
  const issuesByFile = new Map<string, DocumentationIssue[]>();
  for (const issue of issues) {
    if (!issuesByFile.has(issue.file)) {
      issuesByFile.set(issue.file, []);
    }
    issuesByFile.get(issue.file)!.push(issue);
  }

  // Create a review comment with a unique identifier
  let reviewBody = '## 📚 Documentation Review\n\n';
  reviewBody += '<!-- docs-review-action -->\n\n';

  if (issues.length === 0) {
    reviewBody +=
      '✅ All documentation checks passed! The documentation follows the copywriting and formatting guidelines.\n';
  } else {
    reviewBody += `Found ${issues.length} suggestion(s) for documentation improvements:\n\n`;

    // Add summary by severity
    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    const info = issues.filter((i) => i.severity === 'info').length;

    if (errors > 0) reviewBody += `- 🔴 ${errors} error(s)\n`;
    if (warnings > 0) reviewBody += `- 🟡 ${warnings} warning(s)\n`;
    if (info > 0) reviewBody += `- 🔵 ${info} suggestion(s)\n`;

    reviewBody += '\n### Details:\n\n';

    // Add detailed issues
    for (const [file, fileIssues] of issuesByFile) {
      reviewBody += `**${file}:**\n`;
      for (const issue of fileIssues) {
        let icon = '🔵';
        if (issue.severity === 'error') {
          icon = '🔴';
        } else if (issue.severity === 'warning') {
          icon = '🟡';
        }
        const lineRef = issue.line ? `Line ${issue.line}: ` : '';
        reviewBody += `- ${icon} ${lineRef}${issue.message}\n`;
      }
      reviewBody += '\n';
    }

    reviewBody += '### 📖 Documentation Guidelines\n\n';
    reviewBody += '- Keep text **clear and concise** - avoid unnecessary words\n';
    reviewBody += '- Use **active voice** instead of passive voice\n';
    reviewBody += '- Break up text with **visual elements** (code blocks, bullets, images)\n';
    reviewBody += '- Avoid **marketing speak** and technical jargon\n';
    reviewBody += '- Include **examples** for features and complex concepts\n';
    reviewBody += '\nFor full guidelines, see `.continue/rules/`\n';
  }

  // Post the review comment
  try {
    await octokit.rest.pulls.createReview({
      ...context.repo,
      pull_number: pullNumber,
      body: reviewBody,
      event: 'COMMENT', // Non-blocking review
    });

    core.info('Posted documentation review comment');
  } catch (error) {
    core.error(`Failed to post review comment: ${error}`);
  }
}

async function run(): Promise<void> {
  try {
    // Validate environment
    if (!process.env.GITHUB_TOKEN && !process.env.INPUT_GITHUB_TOKEN) {
      throw new Error('GitHub token is required but not provided');
    }

    // Get configuration with validation
    const rulesPath = process.env.INPUT_RULES_PATH || '.continue/rules';

    // Validate rules path format
    if (rulesPath.includes('..') || rulesPath.startsWith('/')) {
      throw new Error('Invalid rules path: must be a relative path within the project');
    }

    core.info('Starting documentation review...');
    core.info(`Rules path: ${rulesPath}`);

    // Load rules
    const rules = await loadRules(rulesPath);
    core.info(`Loaded ${rules.length} rule(s)`);

    // Get changed documentation files
    const changedFiles = await getChangedDocFiles();

    if (changedFiles.length === 0) {
      core.info('No documentation files changed, skipping review');
      return;
    }

    // Analyze documentation
    const issues = await analyzeDocumentation(changedFiles, rules);
    core.info(`Found ${issues.length} documentation issue(s)`);

    // Post review comments
    await postReviewComments(issues);

    core.info('Documentation review completed');
  } catch (error) {
    core.setFailed(`Documentation review failed: ${error}`);
  }
}

// Run the action
run();
