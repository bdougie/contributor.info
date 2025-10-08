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

interface ValidationSuccess {
  file: string;
  rule: string;
  message: string;
  examples?: string[];
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

interface PRFiles {
  docFiles: string[];
  allFiles: { filename: string; additions: number; deletions: number; status: string }[];
  prTitle: string;
  prBody: string;
}

async function getChangedFiles(): Promise<PRFiles> {
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
    return { docFiles: [], allFiles: [], prTitle: '', prBody: '' };
  }

  const { data: pr } = await octokit.rest.pulls.get({
    ...context.repo,
    pull_number: pullNumber,
  });

  const { data: files } = await octokit.rest.pulls.listFiles({
    ...context.repo,
    pull_number: pullNumber,
  });

  // Filter for all markdown files
  const docFiles = files
    .filter((file) => file.filename.endsWith('.md'))
    .map((file) => file.filename);

  const allFiles = files.map((file) => ({
    filename: file.filename,
    additions: file.additions,
    deletions: file.deletions,
    status: file.status,
  }));

  core.info(`Found ${docFiles.length} documentation files changed`);
  core.info(`Total files in PR: ${allFiles.length}`);

  return {
    docFiles,
    allFiles,
    prTitle: pr.title || '',
    prBody: pr.body || '',
  };
}

async function checkAgainstRule(
  content: string,
  lines: string[],
  file: string,
  rule: Rule
): Promise<DocumentationIssue[]> {
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

  // Add purpose-specific checks based on file location
  issues.push(...checkDocumentationPurpose(content, lines, file));

  return issues;
}

function checkDocumentationPurpose(
  content: string,
  lines: string[],
  file: string
): DocumentationIssue[] {
  const issues: DocumentationIssue[] = [];

  // Determine documentation type
  const isUserDoc = file.includes('mintlify-docs') || file.includes('public/docs');
  const isDevDoc = file.includes('docs/') && !file.includes('mintlify-docs');
  const isArchitectureDoc =
    file.includes('architecture') ||
    file.includes('infrastructure') ||
    file.includes('database') ||
    file.includes('setup');
  const isFeatureDoc = file.includes('features/') || file.includes('implementations/');

  // User documentation checks - focus on "how to use"
  if (isUserDoc) {
    // Check for step-by-step instructions
    const hasSteps =
      /\b(step|follow|instructions|how to)\b/i.test(content) || /^\d+\.\s/m.test(content);
    const hasCodeExample = content.includes('```');

    if (!hasSteps && !hasCodeExample) {
      issues.push({
        file,
        message:
          'User documentation should include step-by-step instructions or code examples showing how to use the feature',
        severity: 'warning',
        rule: 'documentation-purpose',
      });
    }

    // Check for prerequisites
    if (
      !content.toLowerCase().includes('prerequisite') &&
      !content.toLowerCase().includes('requirements') &&
      !content.toLowerCase().includes('before you begin')
    ) {
      issues.push({
        file,
        message: 'User documentation should clarify prerequisites or requirements upfront',
        severity: 'info',
        rule: 'documentation-purpose',
      });
    }

    // Check for expected outcomes
    const hasOutcome = /\b(result|output|expect|should see|you will)\b/i.test(content);
    if (!hasOutcome && hasCodeExample) {
      issues.push({
        file,
        message:
          'User documentation with code examples should explain the expected result or outcome',
        severity: 'info',
        rule: 'documentation-purpose',
      });
    }
  }

  // Architecture/infrastructure documentation checks - focus on "how it works"
  if (isArchitectureDoc) {
    // Check for architecture explanation
    const hasArchitectureTerms =
      /\b(architecture|design|structure|flow|diagram|component|system)\b/i.test(content);
    if (!hasArchitectureTerms) {
      issues.push({
        file,
        message:
          'Architecture documentation should explain system design, structure, or component relationships',
        severity: 'warning',
        rule: 'documentation-purpose',
      });
    }

    // Check for technical decisions or rationale
    const hasRationale = /\b(because|rationale|reason|why|decision|trade-off|chosen)\b/i.test(
      content
    );
    if (!hasRationale) {
      issues.push({
        file,
        message:
          'Architecture documentation should explain technical decisions and rationale for future developers',
        severity: 'info',
        rule: 'documentation-purpose',
      });
    }

    // Check for infrastructure details
    if (file.includes('infrastructure') || file.includes('deployment')) {
      const hasInfraDetails =
        /\b(server|deploy|environment|config|variable|secret|scaling|monitoring)\b/i.test(content);
      if (!hasInfraDetails) {
        issues.push({
          file,
          message:
            'Infrastructure documentation should include deployment, configuration, or environment details',
          severity: 'warning',
          rule: 'documentation-purpose',
        });
      }
    }
  }

  // Feature/implementation documentation checks
  if (isFeatureDoc) {
    const hasCodeExample = content.includes('```');
    const hasUsageInfo = /\b(use|usage|how to|example|implement)\b/i.test(content);
    const hasArchitectureInfo = /\b(architecture|design|how it works|implementation)\b/i.test(
      content
    );

    if (!hasCodeExample) {
      issues.push({
        file,
        message:
          'Feature documentation should include code examples showing how to use the feature',
        severity: 'warning',
        rule: 'documentation-purpose',
      });
    }

    if (!hasUsageInfo && !hasArchitectureInfo) {
      issues.push({
        file,
        message:
          'Feature documentation should explain either how to use the feature (for users) or how it works internally (for developers)',
        severity: 'warning',
        rule: 'documentation-purpose',
      });
    }
  }

  // General developer documentation checks
  if (isDevDoc && !isArchitectureDoc) {
    // Check for context about file locations or structure
    const hasFileReferences =
      /`[^`]*\.(ts|tsx|js|jsx|json|yml|yaml)`/g.test(content) ||
      /\bfile|directory|folder|path\b/i.test(content);

    if (!hasFileReferences && content.includes('```')) {
      issues.push({
        file,
        message:
          'Developer documentation with code examples should reference file locations to help developers navigate the codebase',
        severity: 'info',
        rule: 'documentation-purpose',
      });
    }
  }

  return issues;
}

function checkScannableFormat(
  content: string,
  lines: string[],
  file: string
): DocumentationIssue[] {
  const issues: DocumentationIssue[] = [];

  // Check for multiple consecutive paragraphs without visual breaks
  let consecutiveParagraphs = 0;
  let paragraphStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || '';

    const isTextLine =
      line &&
      !line.startsWith('#') &&
      !line.startsWith('-') &&
      !line.startsWith('*') &&
      !line.startsWith('```') &&
      !line.startsWith('|') &&
      !line.startsWith('>') &&
      !line.startsWith('<') &&
      !line.match(/^\d+\./);

    const isNextTextLine =
      nextLine &&
      !nextLine.startsWith('#') &&
      !nextLine.startsWith('-') &&
      !nextLine.startsWith('*') &&
      !nextLine.startsWith('```') &&
      !nextLine.startsWith('|') &&
      !nextLine.startsWith('>') &&
      !nextLine.startsWith('<') &&
      !nextLine.match(/^\d+\./);

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
  const isTechnicalDoc =
    file.includes('feature') ||
    file.includes('setup') ||
    file.includes('guide') ||
    file.includes('implementation') ||
    file.includes('api');

  if (isTechnicalDoc && !hasCodeExample) {
    issues.push({
      file,
      message:
        'Technical documentation should include code examples to improve clarity and scannability',
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
    {
      pattern: /\b(is|are|was|were|been|being)\s+\w+ed\b/i,
      example: 'Use active voice: "Deploy the app" instead of "The app is deployed"',
    },
    {
      pattern: /\b(has|have|had)\s+been\s+\w+ed\b/i,
      example:
        'Use active voice: "We updated the feature" instead of "The feature has been updated"',
    },
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
    {
      pattern: /\b(unlock|unleash|empower|revolutionize|transform|supercharge)\b/i,
      message: 'Avoid marketing speak. Be clear and direct.',
    },
    {
      pattern: /\b(blazingly|incredibly|amazingly|extremely)\s+(fast|powerful|simple)\b/i,
      message: 'Remove hyperbolic adjectives. State facts instead.',
    },
    {
      pattern: /\b(100%|completely|totally)\s+(secure|safe|reliable|guaranteed)\b/i,
      message: 'Avoid absolute claims. Be precise and realistic.',
    },
    {
      pattern: /\b(seamless|cutting-edge|state-of-the-art|next-generation|world-class)\b/i,
      message: 'Avoid vague buzzwords. Use specific, measurable descriptions.',
    },
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

async function analyzeDocumentation(
  files: string[],
  rules: Rule[]
): Promise<{ issues: DocumentationIssue[]; validations: ValidationSuccess[] }> {
  const issues: DocumentationIssue[] = [];
  const validations: ValidationSuccess[] = [];

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

        // Track successful validations with examples
        if (ruleIssues.length === 0) {
          const successExamples = getValidationExamples(content, lines, file, rule);
          validations.push(...successExamples);
        }
      }
    } catch (error) {
      core.warning(`Failed to analyze ${file}: ${error}`);
    }
  }

  return { issues, validations };
}

function getValidationExamples(
  content: string,
  lines: string[],
  file: string,
  rule: Rule
): ValidationSuccess[] {
  const validations: ValidationSuccess[] = [];
  const ruleName = rule.name;

  switch (ruleName) {
    case 'documentation-scannable-format': {
      // Find examples of good structure
      const examples: string[] = [];
      let hasCodeBlocks = false;
      let hasBulletPoints = false;
      let hasNumberedLists = false;
      let codeBlockCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('```')) {
          hasCodeBlocks = true;
          codeBlockCount++;
          const lineNum = i + 1;
          // Get a snippet of the code block
          const nextLine = lines[i + 1]?.trim() || '';
          if (nextLine && !nextLine.startsWith('```')) {
            examples.push(`Line ${lineNum}: Code example found`);
          }
        } else if (line.startsWith('-') || line.startsWith('*')) {
          hasBulletPoints = true;
        } else if (line.match(/^\d+\./)) {
          hasNumberedLists = true;
        }
      }

      let message = '✅ Document is properly structured with ';
      const structureElements: string[] = [];
      if (hasCodeBlocks) structureElements.push(`${codeBlockCount} code block(s)`);
      if (hasBulletPoints) structureElements.push(`bullet points`);
      if (hasNumberedLists) structureElements.push(`numbered lists`);
      message += structureElements.join(', ');

      validations.push({
        file,
        rule: 'documentation-scannable-format',
        message,
        examples: examples.slice(0, 3), // Limit to 3 examples
      });
      break;
    }

    case 'copywriting': {
      // Check for good copywriting practices
      const examples: string[] = [];
      let activeVoiceCount = 0;
      let noTodos = true;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#') || line.startsWith('```')) continue;

        // Check for active voice (action verbs at start)
        if (
          /^(Install|Deploy|Configure|Run|Create|Update|Set|Use|Add|Remove|Delete|Build)/i.test(
            line
          )
        ) {
          activeVoiceCount++;
          if (examples.length < 3) {
            examples.push(`Line ${i + 1}: Active voice - "${line.substring(0, 60)}..."`);
          }
        }

        // Check for TODO markers
        if (/\b(TODO|FIXME|XXX|HACK|WIP)\b/i.test(line)) {
          noTodos = false;
        }
      }

      const messages: string[] = [];
      if (activeVoiceCount > 0) messages.push(`${activeVoiceCount} active voice instances`);
      if (noTodos) messages.push('no TODO markers');

      if (messages.length > 0) {
        validations.push({
          file,
          rule: 'copywriting',
          message: `✅ Clear writing with ${messages.join(', ')}`,
          examples,
        });
      }
      break;
    }

    case 'documentation-purpose': {
      // Validate purpose-specific content
      const isUserDoc = file.includes('mintlify-docs') || file.includes('public/docs');
      const isArchitectureDoc =
        file.includes('architecture') ||
        file.includes('infrastructure') ||
        file.includes('database') ||
        file.includes('setup');

      const examples: string[] = [];

      if (isUserDoc) {
        const hasSteps =
          /\b(step|follow|instructions|how to)\b/i.test(content) || /^\d+\.\s/m.test(content);
        const hasCodeExample = content.includes('```');
        const hasPrerequisites =
          content.toLowerCase().includes('prerequisite') ||
          content.toLowerCase().includes('requirements') ||
          content.toLowerCase().includes('before you begin');

        if (hasSteps) examples.push('Step-by-step instructions found');
        if (hasCodeExample) examples.push('Code examples included');
        if (hasPrerequisites) examples.push('Prerequisites documented');

        if (examples.length > 0) {
          validations.push({
            file,
            rule: 'documentation-purpose',
            message: `✅ User-focused documentation with ${examples.length} key element(s)`,
            examples,
          });
        }
      } else if (isArchitectureDoc) {
        const hasArchitecture =
          /\b(architecture|design|structure|flow|diagram|component|system)\b/i.test(content);
        const hasRationale = /\b(because|rationale|reason|why|decision|trade-off|chosen)\b/i.test(
          content
        );
        const hasInfraDetails =
          /\b(server|deploy|environment|config|variable|secret|scaling|monitoring)\b/i.test(
            content
          );

        if (hasArchitecture) examples.push('Architecture explained');
        if (hasRationale) examples.push('Technical decisions documented');
        if (hasInfraDetails) examples.push('Infrastructure details included');

        if (examples.length > 0) {
          validations.push({
            file,
            rule: 'documentation-purpose',
            message: `✅ Architecture documentation with ${examples.length} key element(s)`,
            examples,
          });
        }
      }
      break;
    }
  }

  return validations;
}

interface DocReview {
  relevantDocs: string[];
  reviewSuggestions: string[];
}

async function findAffectedDocs(prFiles: PRFiles): Promise<DocReview> {
  const { allFiles } = prFiles;
  const relevantDocs: Set<string> = new Set();
  const reviewSuggestions: string[] = [];

  // Map code changes to documentation areas
  const codeFiles = allFiles.filter(
    (f) =>
      (f.filename.endsWith('.ts') ||
        f.filename.endsWith('.tsx') ||
        f.filename.endsWith('.js') ||
        f.filename.endsWith('.jsx')) &&
      !f.filename.includes('.test.') &&
      !f.filename.includes('.spec.') &&
      !f.filename.includes('__tests__') &&
      !f.filename.includes('.stories.')
  );

  // Check for workspace-related changes
  const hasWorkspaceChanges = codeFiles.some(
    (f) =>
      f.filename.includes('/workspace/') ||
      f.filename.includes('workspace.service') ||
      f.filename.includes('workspace-')
  );

  // Check for health/lottery factor changes
  const hasHealthChanges = codeFiles.some(
    (f) =>
      f.filename.includes('/health/') ||
      f.filename.includes('health-metrics') ||
      f.filename.includes('lottery-factor') ||
      f.filename.includes('repository-health')
  );

  // Check for contribution/activity changes
  const hasActivityChanges = codeFiles.some(
    (f) =>
      f.filename.includes('/activity/') ||
      f.filename.includes('contributions') ||
      f.filename.includes('contributor')
  );

  // Check for notification changes
  const hasNotificationChanges = codeFiles.some(
    (f) => f.filename.includes('notification') || f.filename.includes('invite')
  );

  // Check for authentication changes
  const hasAuthChanges = codeFiles.some(
    (f) => f.filename.includes('/auth/') || f.filename.includes('auth-')
  );

  // Map changes to potential documentation
  try {
    // Check if docs directory exists
    try {
      await fs.access('docs');

      // Look for feature docs
      const featureDocs = glob.sync('docs/features/*.md');
      const architectureDocs = glob.sync('docs/architecture/*.md');

      if (hasWorkspaceChanges) {
        const workspaceDocs = featureDocs.filter((f) => f.includes('workspace'));
        workspaceDocs.forEach((doc) => relevantDocs.add(doc));
        reviewSuggestions.push(
          '📝 **Workspace changes detected** - Review `docs/features/workspace-*.md` for accuracy'
        );
      }

      if (hasHealthChanges) {
        const healthDocs = featureDocs.filter((f) => f.includes('health') || f.includes('lottery'));
        healthDocs.forEach((doc) => relevantDocs.add(doc));
        reviewSuggestions.push(
          '📝 **Health metrics changes** - Verify `docs/features/*health*.md` still matches implementation'
        );
      }

      if (hasActivityChanges) {
        const activityDocs = featureDocs.filter(
          (f) => f.includes('activity') || f.includes('contribution')
        );
        activityDocs.forEach((doc) => relevantDocs.add(doc));
        reviewSuggestions.push(
          '📝 **Activity/contribution changes** - Check if `docs/features/*activity*.md` needs updates'
        );
      }

      if (hasNotificationChanges) {
        const notificationDocs = featureDocs.filter(
          (f) => f.includes('notification') || f.includes('invite')
        );
        notificationDocs.forEach((doc) => relevantDocs.add(doc));
        reviewSuggestions.push(
          '📝 **Notification changes** - Review notification docs for accuracy'
        );
      }

      if (hasAuthChanges) {
        const authDocs = [...featureDocs, ...architectureDocs].filter((f) => f.includes('auth'));
        authDocs.forEach((doc) => relevantDocs.add(doc));
        reviewSuggestions.push('📝 **Auth changes** - Verify authentication documentation');
      }

      // Check README for general feature mentions
      try {
        await fs.access('README.md');
        relevantDocs.add('README.md');
        if (
          hasWorkspaceChanges ||
          hasHealthChanges ||
          hasActivityChanges ||
          hasNotificationChanges
        ) {
          reviewSuggestions.push('📝 Review `README.md` for affected feature descriptions');
        }
      } catch {
        // README doesn't exist, skip
      }
    } catch {
      // docs directory doesn't exist
      core.info('No docs directory found');
    }
  } catch (error) {
    core.warning(`Error finding affected docs: ${error}`);
  }

  return {
    relevantDocs: Array.from(relevantDocs),
    reviewSuggestions,
  };
}

function needsDocumentation(prFiles: PRFiles): {
  needed: boolean;
  reason: string;
  suggestions: string[];
} {
  const { allFiles, docFiles, prTitle, prBody } = prFiles;

  // If there are already docs, skip this check
  if (docFiles.length > 0) {
    return { needed: false, reason: '', suggestions: [] };
  }

  const suggestions: string[] = [];
  let reason = '';

  // Check for PR keywords
  const featureKeywords = /\b(feat|feature|add|new|implement|create)\b/i;
  const breakingKeywords = /\b(breaking|remove|delete|rename|deprecate|BREAKING CHANGE)\b/i;
  const fixKeywords = /\b(fix|bug|issue|patch)\b/i;
  const isFeaturePR = featureKeywords.test(prTitle) || featureKeywords.test(prBody);
  const isBreakingChange = breakingKeywords.test(prTitle) || breakingKeywords.test(prBody);
  const isBugFix = fixKeywords.test(prTitle) || fixKeywords.test(prBody);

  // Categorize code files
  const codeFiles = allFiles.filter(
    (f) =>
      (f.filename.endsWith('.ts') ||
        f.filename.endsWith('.tsx') ||
        f.filename.endsWith('.js') ||
        f.filename.endsWith('.jsx')) &&
      !f.filename.includes('.test.') &&
      !f.filename.includes('.spec.') &&
      !f.filename.includes('__tests__') &&
      !f.filename.includes('.stories.')
  );

  const totalAdditions = codeFiles.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = codeFiles.reduce((sum, f) => sum + f.deletions, 0);
  const newFiles = codeFiles.filter((f) => f.status === 'added');
  const removedFiles = codeFiles.filter((f) => f.status === 'removed');
  const modifiedFiles = codeFiles.filter((f) => f.status === 'modified');

  // Detect specific code changes
  const hasMigrations = allFiles.some((f) => f.filename.includes('supabase/migrations/'));
  const hasNewServices = newFiles.some(
    (f) => f.filename.includes('/services/') || f.filename.includes('/api/')
  );
  const hasNewComponents = newFiles.some(
    (f) => f.filename.includes('/components/') && f.filename.endsWith('.tsx')
  );
  const hasNewHooks = newFiles.some(
    (f) => f.filename.includes('/hooks/') && /use-?[A-Z]/.test(f.filename)
  );
  const hasLibChanges = allFiles.some(
    (f) => f.filename.includes('/lib/') && f.status !== 'removed'
  );
  const hasConfigChanges = allFiles.some(
    (f) =>
      f.filename.includes('.env') ||
      f.filename.endsWith('config.ts') ||
      f.filename.endsWith('config.json') ||
      f.filename.includes('vite.config') ||
      f.filename.includes('tsconfig')
  );
  const hasRemovedExports = removedFiles.length > 0 || totalDeletions > 100;

  // Detect environment variable changes
  const hasEnvChanges = allFiles.some(
    (f) =>
      f.filename.includes('.env.example') ||
      (f.filename.includes('lib/env') &&
        modifiedFiles.some((mf) => mf.filename === f.filename && mf.additions > 5))
  );

  // Determine if docs are needed
  let needed = false;

  // Priority 1: Breaking changes (CRITICAL)
  if (isBreakingChange || (hasRemovedExports && !isBugFix)) {
    needed = true;
    reason = 'This PR contains breaking changes that affect existing functionality';
    suggestions.push(
      '⚠️ **CRITICAL**: Create migration guide in `docs/migration/` explaining what changed and how to update'
    );
    suggestions.push('Update `CHANGELOG.md` with breaking change details');
    if (hasRemovedExports) {
      suggestions.push('Document removed/renamed APIs and provide alternatives');
    }
  }

  // Priority 2: Database migrations
  if (hasMigrations) {
    needed = true;
    if (!reason) reason = 'This PR includes database schema changes';
    suggestions.push(
      'Document schema changes in `docs/database/schema.md` with table/column details'
    );
    suggestions.push('Update `docs/database/migrations.md` with migration instructions');
    if (totalAdditions > 50) {
      suggestions.push('Add architecture doc in `docs/architecture/` if this changes data flow');
    }
  }

  // Priority 3: New features with components/hooks
  if (isFeaturePR && (hasNewComponents || hasNewHooks) && totalAdditions > 50) {
    needed = true;
    if (!reason) reason = 'This PR introduces new user-facing features';

    if (hasNewComponents) {
      const componentFiles = newFiles.filter((f) => f.filename.includes('/components/'));
      suggestions.push(
        `Add feature documentation in \`docs/features/\` for ${componentFiles.length} new component(s)`
      );
      suggestions.push('Include usage examples and props/API documentation');
    }

    if (hasNewHooks) {
      const hookFiles = newFiles.filter((f) => f.filename.includes('/hooks/'));
      suggestions.push(
        `Document ${hookFiles.length} new hook(s) in \`docs/api/hooks.md\` with usage examples`
      );
    }
  }

  // Priority 4: New services/API endpoints
  if (hasNewServices && totalAdditions > 100) {
    needed = true;
    if (!reason) reason = 'This PR adds new backend services or APIs';
    suggestions.push(
      'Add architecture documentation in `docs/architecture/` explaining service design'
    );
    suggestions.push('Document API endpoints with request/response examples in `docs/api/`');
    suggestions.push('Add integration guide if this changes how other services interact');
  }

  // Priority 5: Configuration or environment changes
  if (hasEnvChanges || (hasConfigChanges && !isBugFix)) {
    needed = true;
    if (!reason) reason = 'This PR modifies configuration or environment setup';
    suggestions.push('Update `docs/setup/` with new environment variables and their purpose');
    suggestions.push('Update `.env.example` and document required vs optional variables');
    if (hasConfigChanges) {
      suggestions.push(
        'Document configuration changes in `docs/configuration/` if behavior changes'
      );
    }
  }

  // Priority 6: Significant library/core changes
  if (hasLibChanges && totalAdditions > 150 && !isBugFix) {
    needed = true;
    if (!reason) reason = 'This PR makes significant changes to core library code';
    suggestions.push(
      'Add architecture documentation in `docs/architecture/` explaining technical design decisions'
    );
    suggestions.push('Document any new utilities or helpers in `docs/development/`');
  }

  // Fallback: Large feature without specific indicators
  if (!needed && isFeaturePR && totalAdditions > 200) {
    needed = true;
    reason = 'This PR adds substantial new functionality';
    suggestions.push(
      'Add feature documentation in `docs/features/` explaining what this does and why'
    );
    suggestions.push(
      'Consider architecture docs in `docs/architecture/` if this changes system design'
    );
  }

  return { needed, reason, suggestions };
}

async function postReviewComments(
  issues: DocumentationIssue[],
  validations: ValidationSuccess[],
  prFiles: PRFiles,
  affectedDocs: DocReview
): Promise<void> {
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

  // Check if documentation is needed
  const docsNeeded = needsDocumentation(prFiles);

  // Create a review comment with a unique identifier
  let reviewBody = '## 📚 Documentation Review\n\n';
  reviewBody += '<!-- docs-review-action -->\n\n';

  // If docs are needed but missing, call it out first
  if (docsNeeded.needed) {
    reviewBody += '### ⚠️ Documentation Needed\n\n';
    reviewBody += `${docsNeeded.reason}. Consider adding documentation:\n\n`;
    for (const suggestion of docsNeeded.suggestions) {
      reviewBody += `- ${suggestion}\n`;
    }
    reviewBody += '\n---\n\n';
  }

  if (issues.length === 0 && prFiles.docFiles.length === 0) {
    // No docs in PR at all
    if (docsNeeded.needed) {
      reviewBody += '**No documentation files found in this PR.**\n\n';
      reviewBody += 'Please add documentation following the suggestions above.\n';
    } else if (affectedDocs.reviewSuggestions.length > 0) {
      // Code changes detected that might affect existing docs
      reviewBody += '✅ **No documentation changes in this PR.**\n\n';
      reviewBody +=
        'However, your code changes may affect existing documentation. Please verify:\n\n';
      for (const suggestion of affectedDocs.reviewSuggestions) {
        reviewBody += `- ${suggestion}\n`;
      }
      if (affectedDocs.relevantDocs.length > 0) {
        reviewBody += '\n**Potentially affected documentation:**\n';
        for (const doc of affectedDocs.relevantDocs) {
          reviewBody += `- \`${doc}\`\n`;
        }
      }
      reviewBody += '\n';
    } else {
      reviewBody += '✅ **No documentation changes in this PR.**\n\n';
      reviewBody +=
        'Code changes detected with no obvious documentation impact. If your changes affect user-facing features or APIs, please verify relevant documentation is still accurate.\n';
    }
  } else if (issues.length === 0) {
    reviewBody += '✅ **All documentation checks passed!**\n\n';

    // Group validations by file
    const validationsByFile = new Map<string, ValidationSuccess[]>();
    for (const validation of validations) {
      if (!validationsByFile.has(validation.file)) {
        validationsByFile.set(validation.file, []);
      }
      validationsByFile.get(validation.file)!.push(validation);
    }

    if (validationsByFile.size > 0) {
      reviewBody += '### What we validated:\n\n';

      for (const [file, fileValidations] of validationsByFile) {
        reviewBody += `**${file}:**\n`;
        for (const validation of fileValidations) {
          reviewBody += `- ${validation.message}\n`;
          if (validation.examples && validation.examples.length > 0) {
            for (const example of validation.examples) {
              reviewBody += `  - ${example}\n`;
            }
          }
        }
        reviewBody += '\n';
      }

      reviewBody += '### Rules applied:\n\n';
      reviewBody += '- **Copywriting**: Active voice, no marketing fluff, clear error messages\n';
      reviewBody += '- **Scannable Format**: Visual breaks, code examples, bullet points\n';
      reviewBody +=
        '- **Documentation Purpose**: User docs show "how to use", dev docs explain "how it works"\n\n';
    } else {
      reviewBody += 'The documentation follows the copywriting and formatting guidelines.\n\n';
    }

    reviewBody += '_For full guidelines, see `.continue/rules/`_\n';
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

    reviewBody += '### 📖 Documentation Purpose\n\n';
    reviewBody += '**User Documentation** (`/mintlify-docs`):\n';
    reviewBody += '- Show **how to use** the product with step-by-step instructions\n';
    reviewBody += '- Include **prerequisites** and expected **outcomes**\n';
    reviewBody += '- Add **code examples** users can copy and run\n\n';
    reviewBody += '**Developer Documentation** (`/docs`):\n';
    reviewBody +=
      '- Explain **how the architecture works** (system design, component relationships)\n';
    reviewBody += '- Document **technical decisions** and rationale\n';
    reviewBody += '- Include **file locations** and navigation hints\n';
    reviewBody += '- Explain **infrastructure and deployment** details\n\n';
    reviewBody += 'For full guidelines, see `.continue/rules/`\n';
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

    // Get changed files
    const prFiles = await getChangedFiles();

    // Always run the review to check if docs are needed
    let issues: DocumentationIssue[] = [];
    let validations: ValidationSuccess[] = [];

    if (prFiles.docFiles.length > 0) {
      // Analyze documentation if docs exist
      const analysis = await analyzeDocumentation(prFiles.docFiles, rules);
      issues = analysis.issues;
      validations = analysis.validations;
      core.info(`Found ${issues.length} documentation issue(s)`);
      core.info(`Found ${validations.length} successful validation(s)`);
    } else {
      core.info('No documentation files in PR');
    }

    // Find documentation that might be affected by code changes
    const affectedDocs = await findAffectedDocs(prFiles);
    core.info(`Found ${affectedDocs.relevantDocs.length} potentially affected docs`);
    core.info(`Generated ${affectedDocs.reviewSuggestions.length} review suggestions`);

    // Post review comments (including "docs needed" check and affected docs)
    await postReviewComments(issues, validations, prFiles, affectedDocs);

    core.info('Documentation review completed');
  } catch (error) {
    core.setFailed(`Documentation review failed: ${error}`);
  }
}

// Run the action
run();
