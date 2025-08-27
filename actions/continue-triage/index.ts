import * as core from '@actions/core';
import * as github from '@actions/github';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';

interface Label {
  name: string;
  description?: string;
}

interface RuleFile {
  globs?: string;
  description: string;
  content?: string;
}

interface TriageConfig {
  labelMappings: {
    [category: string]: {
      [label: string]: {
        patterns: string[];
        description: string;
      };
    };
  };
  tierRules: {
    [tier: string]: {
      patterns: string[];
      description: string;
    };
  };
  behavior: {
    skipIfHasLabels?: string[];
    maxLabelsPerCategory?: number;
    confidenceThreshold?: number;
  };
}

interface TriageAnalysis {
  situation: string;
  complication: string;
  question: string;
  answer: string;
  suggestedLabels: string[];
  reasoning: Record<string, string>;
}

async function run(): Promise<void> {
  try {
    // Get inputs - in composite actions, inputs are passed as INPUT_ env vars with underscores
    const token =
      process.env.INPUT_GITHUB_TOKEN || core.getInput('github-token', { required: true });
    const continueApiKey =
      process.env.INPUT_CONTINUE_API_KEY || core.getInput('continue-api-key', { required: true });
    const continueOrg =
      process.env.INPUT_CONTINUE_ORG || core.getInput('continue-org', { required: true });
    const continueConfig =
      process.env.INPUT_CONTINUE_CONFIG || core.getInput('continue-config', { required: true });
    const issueNumberStr =
      process.env.INPUT_ISSUE_NUMBER || core.getInput('issue-number', { required: true });
    const issueNumber = parseInt(issueNumberStr);
    // Handle dry-run input safely - getBooleanInput is strict about format
    const dryRunInput = process.env.INPUT_DRY_RUN || core.getInput('dry-run') || 'false';
    const dryRun = dryRunInput === 'true' || dryRunInput === 'True' || dryRunInput === 'TRUE';

    // Mask sensitive values in logs
    if (continueApiKey) {
      core.setSecret(continueApiKey);
    }
    if (token) {
      core.setSecret(token);
    }

    if (!token || !continueApiKey || !continueOrg || !continueConfig || !issueNumber) {
      throw new Error('Missing required inputs');
    }

    const octokit = github.getOctokit(token);
    const context = github.context;
    const { owner, repo } = context.repo;

    // Check rate limit before proceeding
    const { data: rateLimitData } = await octokit.rest.rateLimit.get();
    const rateLimit = rateLimitData.resources?.core || rateLimitData.core || rateLimitData;
    console.log('📊 GitHub API Rate Limit: %s/%s', rateLimit.remaining, rateLimit.limit);

    if (rateLimit.remaining < 10) {
      const resetDate = new Date(rateLimit.reset * 1000);
      throw new Error(
        `GitHub API rate limit too low: ${rateLimit.remaining} remaining. Resets at ${resetDate.toISOString()}`
      );
    }

    console.log('🔍 Triaging issue #%s%s...', issueNumber, dryRun ? ' (DRY RUN MODE)' : '');

    // Fetch issue details
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    console.log('📋 Issue: "%s"', issue.title);

    // Fetch all available labels
    const { data: availableLabels } = await octokit.rest.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
    });

    console.log('🏷️ Found %s available labels', availableLabels.length);

    // Load triage configuration
    const triageConfig = await loadTriageConfig();
    if (triageConfig) {
      console.log('⚙️ Loaded triage configuration');
    }

    // Load rules from .continue/rules directory
    const rulesPath = path.join(process.cwd(), '.continue', 'rules');
    const rules = await loadRules(rulesPath);
    console.log('📚 Loaded %s rules for analysis', rules.length);

    // Check if issue already has labels (skip if already triaged)
    const existingLabels = issue.labels.map((l: { name: string }) => l.name);
    const hasNeedsTriageLabel = existingLabels.includes('needs-triage');
    const hasOtherLabels = existingLabels.length > 0 && !hasNeedsTriageLabel;

    if (hasOtherLabels) {
      console.log('✅ Issue already triaged, skipping...');
      return;
    }

    // Add needs-triage label if not present
    if (!hasNeedsTriageLabel && existingLabels.length === 0) {
      if (dryRun) {
        console.log('🏷️ [DRY RUN] Would add "needs-triage" label');
      } else {
        await octokit.rest.issues.addLabels({
          owner,
          repo,
          issue_number: issueNumber,
          labels: ['needs-triage'],
        });
        console.log('🏷️ Added "needs-triage" label');
      }
    }

    // Perform triage analysis using Continue
    const analysis = await performTriageAnalysis(
      issue,
      availableLabels,
      rules,
      continueApiKey,
      continueOrg,
      continueConfig
    );

    // Post SCQA comment
    const comment = generateSCQAComment(analysis, dryRun);
    if (dryRun) {
      console.log('💬 [DRY RUN] Would post comment:');
      console.log(comment);
    } else {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: comment,
      });
      console.log('💬 Posted SCQA analysis comment');
    }

    // Apply suggested labels
    if (analysis.suggestedLabels.length > 0) {
      // Filter to only existing labels
      const labelsToApply = analysis.suggestedLabels.filter((label) =>
        availableLabels.some((l) => l.name === label)
      );

      if (labelsToApply.length > 0) {
        if (dryRun) {
          console.log('🏷️ [DRY RUN] Would apply labels: %s', labelsToApply.join(', '));
        } else {
          await octokit.rest.issues.addLabels({
            owner,
            repo,
            issue_number: issueNumber,
            labels: labelsToApply,
          });
          console.log('🏷️ Applied labels: %s', labelsToApply.join(', '));
        }
      }

      // Remove needs-triage label after successful SCQA analysis
      // Always remove the label when we've completed the analysis, regardless of whether we applied new labels
      if (hasNeedsTriageLabel) {
        try {
          if (dryRun) {
            console.log('🏷️ [DRY RUN] Would remove "needs-triage" label');
          } else {
            await octokit.rest.issues.removeLabel({
              owner,
              repo,
              issue_number: issueNumber,
              name: 'needs-triage',
            });
            console.log('🏷️ Removed "needs-triage" label');
          }
        } catch {
          // Label might not exist, ignore error
        }
      }
    }

    console.log('✅ Triage completed successfully');
  } catch (error) {
    console.error('❌ Triage failed:', error);
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

async function loadTriageConfig(): Promise<TriageConfig | null> {
  try {
    const configPath = path.join(__dirname, 'triage-config.yml');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      return yaml.load(configContent) as TriageConfig;
    }
  } catch (error) {
    console.warn('⚠️ Could not load triage config:', error);
  }
  return null;
}

async function loadRules(rulesPath: string): Promise<RuleFile[]> {
  const rules: RuleFile[] = [];

  try {
    const ruleFiles = await glob('*.md', { cwd: rulesPath });

    for (const file of ruleFiles) {
      const filePath = path.join(rulesPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = yaml.load(frontmatterMatch[1]) as {
          globs?: string;
          description?: string;
        };
        rules.push({
          globs: frontmatter.globs,
          description: frontmatter.description || path.basename(file, '.md'),
          content: content.substring(frontmatterMatch[0].length).trim(),
        });
      } else {
        rules.push({
          description: path.basename(file, '.md'),
          content: content.trim(),
        });
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not load rules:', error);
  }

  return rules;
}

interface IssueData {
  title: string;
  body?: string | null;
  labels: Array<{ name: string }>;
}

async function performTriageAnalysis(
  issue: IssueData,
  availableLabels: Label[],
  rules: RuleFile[],
  apiKey: string,
  org: string,
  config: string
): Promise<TriageAnalysis> {
  // Prepare the prompt for Continue
  const prompt = `
You are an issue triage assistant. Analyze the following GitHub issue and provide structured feedback.

## Issue Details
Title: ${issue.title}
Body: ${issue.body || 'No description provided'}

## Available Labels
${availableLabels.map((l) => `- ${l.name}: ${l.description || 'No description'}`).join('\n')}

## Project Rules
${rules.map((r) => `### ${r.description}\n${r.content}`).join('\n\n')}

## Task
1. Analyze the issue against the project rules
2. Determine appropriate labels from the available list
3. Generate SCQA analysis (Situation, Complication, Question, Answer)
4. Focus on categorizing by:
   - Type: bug, enhancement, documentation, question
   - Area: frontend, components, hooks, lib, database, ci, testing, etc.
   - Tier: tier 1 (major), tier 2 (important), tier 3 (smaller)
   - Technical: security, performance, dependencies, build
   - Complexity: good first issue (if appropriate)

Please respond in the following JSON format:
{
  "situation": "Clear restatement of what the issue is about",
  "complication": "Challenges or blockers identified",
  "question": "First principles hypothesis about the root problem",
  "answer": "Suggested approach or fix",
  "suggestedLabels": ["label1", "label2"],
  "reasoning": {
    "label1": "Why this label applies",
    "label2": "Why this label applies"
  }
}
`;

  // Use Continue CLI to analyze
  let output = '';
  let errorOutput = '';

  try {
    // Write prompt to temporary file
    const tmpPromptFile = path.join(process.cwd(), '.continue-triage-prompt.txt');
    fs.writeFileSync(tmpPromptFile, prompt);

    // Execute Continue CLI with API key as environment variable
    const exitCode = await exec.exec(
      'npx',
      [
        '@continuedev/cli',
        'chat',
        '--config',
        `${org}/${config}`,
        '--model',
        'claude-3-sonnet',
        '--prompt-file',
        tmpPromptFile,
        '--json',
      ],
      {
        env: {
          ...process.env,
          CONTINUE_API_KEY: apiKey, // Pass API key securely via environment variable
        },
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
          stderr: (data: Buffer) => {
            errorOutput += data.toString();
          },
        },
        silent: true,
      }
    );

    // Clean up temp file
    fs.unlinkSync(tmpPromptFile);

    if (exitCode !== 0) {
      throw new Error(`Continue CLI failed: ${errorOutput}`);
    }

    // Parse the response
    const response = JSON.parse(output);
    return response as TriageAnalysis;
  } catch {
    console.error('Continue analysis failed, using fallback analysis');

    // Fallback analysis without Continue
    return performFallbackAnalysis(issue, availableLabels);
  }
}

function performFallbackAnalysis(issue: IssueData, availableLabels: Label[]): TriageAnalysis {
  const title = issue.title.toLowerCase();
  const body = (issue.body || '').toLowerCase();
  const fullText = `${title} ${body}`;

  const suggestedLabels: string[] = [];
  const reasoning: Record<string, string> = {};

  // Type detection
  if (fullText.includes('bug') || fullText.includes('error') || fullText.includes('broken')) {
    suggestedLabels.push('bug');
    reasoning['bug'] = 'Issue describes something not working correctly';
  } else if (
    fullText.includes('feature') ||
    fullText.includes('add') ||
    fullText.includes('implement')
  ) {
    suggestedLabels.push('enhancement');
    reasoning['enhancement'] = 'Issue requests new functionality';
  } else if (fullText.includes('doc') || fullText.includes('readme')) {
    suggestedLabels.push('documentation');
    reasoning['documentation'] = 'Issue relates to documentation';
  }

  // Area detection
  if (fullText.includes('ui') || fullText.includes('frontend') || fullText.includes('component')) {
    suggestedLabels.push('frontend');
    reasoning['frontend'] = 'Issue relates to UI/frontend';
  }
  if (fullText.includes('database') || fullText.includes('supabase') || fullText.includes('sql')) {
    suggestedLabels.push('database');
    reasoning['database'] = 'Issue relates to database operations';
  }
  if (fullText.includes('test') || fullText.includes('spec')) {
    suggestedLabels.push('testing');
    reasoning['testing'] = 'Issue relates to testing';
  }

  // Technical detection
  if (fullText.includes('security') || fullText.includes('vulnerability')) {
    suggestedLabels.push('security');
    reasoning['security'] = 'Issue has security implications';
  }
  if (
    fullText.includes('performance') ||
    fullText.includes('slow') ||
    fullText.includes('optimize')
  ) {
    suggestedLabels.push('performance');
    reasoning['performance'] = 'Issue relates to performance';
  }

  return {
    situation: `The issue "${issue.title}" has been submitted for triage.`,
    complication:
      'The issue needs proper categorization and analysis to determine the appropriate approach.',
    question: 'What is the core problem being reported and how should it be categorized?',
    answer:
      'Based on the content analysis, appropriate labels have been suggested to help categorize and prioritize this issue.',
    suggestedLabels: suggestedLabels.filter((l) => availableLabels.some((al) => al.name === l)),
    reasoning,
  };
}

function generateSCQAComment(analysis: TriageAnalysis, dryRun = false): string {
  // Extract key insights from the SCQA analysis to create a helpful comment
  const labelsList = analysis.suggestedLabels.map((label) => `\`${label}\``).join(', ');

  // Create a conversational, helpful response based on the analysis
  let comment = `Hey there! I've analyzed this issue and here's what I found:\n\n`;

  // Add the main insight from the answer
  comment += `${analysis.answer}\n\n`;

  // If there are specific suggestions or action items in the answer, highlight them
  if (
    analysis.answer.includes('specific') ||
    analysis.answer.includes('suggest') ||
    analysis.answer.includes('should')
  ) {
    comment += `### 💡 Suggestions\n\n`;
    comment += `Based on the issue description, here are some specific areas to investigate:\n\n`;

    // Extract actionable items from the analysis
    if (analysis.suggestedLabels.includes('bug')) {
      comment += `- **Bug Fix**: Check the affected components for missing dependencies in useEffect/useCallback hooks\n`;
      comment += `- Look at files with React Hook warnings in the console\n`;
    }
    if (analysis.suggestedLabels.includes('frontend')) {
      comment += `- **Frontend**: Review React components for proper hook usage patterns\n`;
      comment += `- Consider using the ESLint rule \`react-hooks/exhaustive-deps\` to catch these automatically\n`;
    }
    if (analysis.suggestedLabels.includes('testing')) {
      comment += `- **Testing**: Update test files to handle async operations properly\n`;
      comment += `- Check test utilities for missing act() wrappers\n`;
    }
    if (analysis.suggestedLabels.includes('enhancement')) {
      comment += `- **Enhancement**: Consider implementing this as a new feature module\n`;
      comment += `- Review similar existing features for implementation patterns\n`;
    }
    if (analysis.suggestedLabels.includes('documentation')) {
      comment += `- **Documentation**: Update relevant docs in the \`/docs\` directory\n`;
      comment += `- Consider adding inline code comments for complex logic\n`;
    }
    comment += `\n`;
  }

  // Add labels section if any were applied
  if (labelsList) {
    comment += `### 🏷️ Labels ${dryRun ? 'Suggested' : 'Applied'}\n\n`;
    comment += `I've ${dryRun ? 'suggested' : 'applied'} these labels: ${labelsList}\n\n`;

    // Add reasoning for each label
    if (analysis.reasoning && Object.keys(analysis.reasoning).length > 0) {
      comment += `**Why these labels?**\n`;
      for (const [label, reason] of Object.entries(analysis.reasoning)) {
        comment += `- \`${label}\`: ${reason}\n`;
      }
      comment += `\n`;
    }
  }

  // Add a helpful closing
  comment += `---\n`;
  comment += `*I'm a bot powered by [Continue AI](https://github.com/continuedev/continue) • `;
  comment += `View [triage rules](https://github.com/bdougie/contributor.info/tree/main/.continue/rules)*`;

  if (dryRun) {
    comment += `\n*Note: This is a dry run - no labels were actually applied.*`;
  }

  return comment;
}

// Run the action
run();
