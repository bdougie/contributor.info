import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import * as yaml from 'js-yaml';

interface Rule {
  globs?: string[];
  description: string;
  content: string;
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
    // Find all .md files in the rules directory
    const ruleFiles = await glob(`${rulesPath}/*.md`);

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

        rules.push({
          globs: frontmatter.globs,
          description: frontmatter.description,
          content: ruleContent,
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
  const token = process.env.GITHUB_TOKEN || '';
  const octokit = github.getOctokit(token);
  const context = github.context;

  if (!context.payload.pull_request) {
    core.info('Not running in a pull request context');
    return [];
  }

  const { data: files } = await octokit.rest.pulls.listFiles({
    ...context.repo,
    pull_number: context.payload.pull_request.number,
  });

  // Filter for documentation files
  const docFiles = files
    .filter(
      (file) =>
        file.filename.endsWith('.md') &&
        (file.filename.startsWith('docs/') ||
          file.filename.startsWith('public/docs/') ||
          file.filename === 'CONTRIBUTING.md' ||
          file.filename === 'README.md')
    )
    .map((file) => file.filename);

  core.info(`Found ${docFiles.length} documentation files changed`);
  return docFiles;
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
          const matches = await glob(rule.globs);
          if (!matches.includes(file)) {
            continue;
          }
        }

        // Basic checks based on common documentation issues

        // Check for multiple consecutive paragraphs without visual breaks
        let consecutiveParagraphs = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const nextLine = lines[i + 1]?.trim() || '';

          if (
            line &&
            !line.startsWith('#') &&
            !line.startsWith('-') &&
            !line.startsWith('*') &&
            !line.startsWith('```') &&
            !line.startsWith('|') &&
            !line.startsWith('>')
          ) {
            if (
              nextLine &&
              !nextLine.startsWith('#') &&
              !nextLine.startsWith('-') &&
              !nextLine.startsWith('*') &&
              !nextLine.startsWith('```') &&
              !nextLine.startsWith('|') &&
              !nextLine.startsWith('>')
            ) {
              consecutiveParagraphs++;
              if (consecutiveParagraphs >= 2) {
                issues.push({
                  file,
                  line: i + 1,
                  message:
                    'Multiple consecutive paragraphs without visual breaks. Add code examples, bullet points, or other visual elements.',
                  severity: 'warning',
                  rule: 'documentation-scannable-format',
                });
              }
            } else {
              consecutiveParagraphs = 0;
            }
          } else {
            consecutiveParagraphs = 0;
          }
        }

        // Check for passive voice patterns
        const passivePatterns = [
          /\b(is|are|was|were|been|being)\s+\w+ed\b/gi,
          /\b(has|have|had)\s+been\s+\w+ed\b/gi,
        ];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const pattern of passivePatterns) {
            if (pattern.test(line)) {
              issues.push({
                file,
                line: i + 1,
                message: 'Consider using active voice instead of passive voice',
                severity: 'info',
                rule: 'copywriting',
              });
              break;
            }
          }
        }

        // Check for marketing speak and fluff
        const fluffPatterns = [
          /\b(unlock|unleash|empower|revolutionize|transform)\b/gi,
          /\b(blazingly|incredibly|amazingly|extremely)\s+fast\b/gi,
          /\b(100%|completely|totally)\s+(secure|safe|reliable)\b/gi,
        ];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const pattern of fluffPatterns) {
            if (pattern.test(line)) {
              issues.push({
                file,
                line: i + 1,
                message: 'Avoid marketing speak and fluff. Use clear, direct language.',
                severity: 'warning',
                rule: 'copywriting',
              });
              break;
            }
          }
        }

        // Check for TODO comments
        if (/TODO|FIXME|XXX/.test(content)) {
          for (let i = 0; i < lines.length; i++) {
            if (/TODO|FIXME|XXX/.test(lines[i])) {
              issues.push({
                file,
                line: i + 1,
                message: 'Documentation contains TODO/FIXME comments. Please complete or remove.',
                severity: 'warning',
                rule: 'documentation-completeness',
              });
            }
          }
        }

        // Check for missing examples in feature documentation
        if (file.includes('feature-') || file.includes('insight-')) {
          const hasCodeExample = content.includes('```');
          if (!hasCodeExample) {
            issues.push({
              file,
              message: 'Feature documentation should include code examples',
              severity: 'info',
              rule: 'documentation-examples',
            });
          }
        }
      }
    } catch (error) {
      core.warning(`Failed to analyze ${file}: ${error}`);
    }
  }

  return issues;
}

async function postReviewComments(issues: DocumentationIssue[]): Promise<void> {
  const token = process.env.GITHUB_TOKEN || '';
  const octokit = github.getOctokit(token);
  const context = github.context;

  if (!context.payload.pull_request) {
    core.info('Not in a pull request context, skipping comment posting');
    return;
  }

  // Group issues by file
  const issuesByFile = new Map<string, DocumentationIssue[]>();
  for (const issue of issues) {
    if (!issuesByFile.has(issue.file)) {
      issuesByFile.set(issue.file, []);
    }
    issuesByFile.get(issue.file)!.push(issue);
  }

  // Create a review comment
  let reviewBody = '## 📚 Documentation Review\n\n';

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
      pull_number: context.payload.pull_request.number,
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
    // Get configuration
    const rulesPath = process.env.INPUT_RULES_PATH || '.continue/rules';

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
