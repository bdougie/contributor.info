import type { PullRequestEvent } from '../types/github';
import { githubAppAuth } from '../lib/auth';
import { findSimilarIssues } from '../services/similarity';
import { CheckRunManager } from '../services/check-runs/check-run-manager';
import type { Octokit } from '@octokit/rest';

/**
 * PR Check Runs handler for GitHub Check Runs API
 * Provides similarity checks and performance monitoring via GitHub Check Runs
 *
 * Migrated from fly-github-webhooks/src/handlers/pr-check-runs.js with:
 * - TypeScript conversion for type safety
 * - ENABLED similarity search using app/services/similarity.ts
 * - CheckRunManager for reusable Check Runs API operations
 */

/**
 * Handle PR events for check runs (similarity & performance)
 */
export async function handlePRCheckRuns(event: PullRequestEvent): Promise<void> {
  const { pull_request: pr, repository: repo, installation, action } = event;

  // Only process on PR opened, synchronize, or ready_for_review
  if (!['opened', 'synchronize', 'ready_for_review'].includes(action)) {
    console.log('Skipping check runs for action: %s', action);
    return;
  }

  // Skip draft PRs
  if (pr.draft) {
    console.log('Skipping check runs for draft PR #%s', pr.number);
    return;
  }

  console.log('Running checks for PR #%s in %s', pr.number, repo.full_name);

  try {
    // Get installation Octokit
    const installationId = installation?.id;
    if (!installationId) {
      console.error('No installation ID found');
      return;
    }

    const octokit = await githubAppAuth.getInstallationOctokit(installationId);

    // Run checks in parallel
    const [similarityResult, performanceResult] = await Promise.allSettled([
      runSimilarityCheck(pr, repo, octokit),
      runPerformanceCheck(pr, repo, octokit),
    ]);

    // Log results
    if (similarityResult.status === 'rejected') {
      console.error('Similarity check failed: %o', similarityResult.reason);
    }
    if (performanceResult.status === 'rejected') {
      console.error('Performance check failed: %o', performanceResult.reason);
    }

    console.log(
      '✅ Check runs completed for PR #%s (similarity: %s, performance: %s)',
      pr.number,
      similarityResult.status,
      performanceResult.status
    );
  } catch (error) {
    console.error('Error handling PR check runs: %o', error);
    // Don't throw - we don't want GitHub to retry
  }
}

/**
 * Run similarity check and post results as GitHub Check Run
 * NOW ENABLED with ML-powered similarity from app/services/similarity.ts
 */
async function runSimilarityCheck(
  pr: any,
  repo: any,
  octokit: Octokit
): Promise<{ similar_issues: number; conclusion: string }> {
  const checkRunName = 'Similarity Analysis';
  const checkRunManager = new CheckRunManager(octokit, repo.owner.login, repo.name, pr.head.sha);

  // Create check run
  const checkRunId = await checkRunManager.create({
    name: checkRunName,
    head_sha: pr.head.sha,
    status: 'in_progress',
  });

  try {
    // Find similar issues using ML-powered similarity service (ENABLED!)
    const similarIssues = await findSimilarIssues(pr, repo, {
      useSemantic: true,
      useCache: true,
      maxResults: 5,
      minScore: 0.5,
    });

    // Prepare check run output
    let conclusion: 'success' | 'neutral' | 'failure' = 'success';
    let summary = '';
    let text = '';
    const annotations: Array<{
      path: string;
      start_line: number;
      end_line: number;
      annotation_level: 'notice' | 'warning' | 'failure';
      message: string;
      title?: string;
    }> = [];

    if (similarIssues.length > 0) {
      conclusion = 'neutral';
      summary = `Found ${similarIssues.length} similar issue(s)`;

      text = '## 🔍 Similar Issues Found\n\n';
      text += 'The following issues appear to be related to this PR:\n\n';

      for (const similar of similarIssues) {
        const similarity = Math.round(similar.similarityScore * 100);
        const stateEmoji = similar.issue.state === 'open' ? '🟢' : '🔴';
        const relationshipEmoji =
          similar.relationship === 'fixes'
            ? '🔧'
            : similar.relationship === 'implements'
              ? '⚡'
              : similar.relationship === 'relates_to'
                ? '🔗'
                : '💭';

        text += `### ${stateEmoji} ${relationshipEmoji} Issue #${similar.issue.number}\n`;
        text += `- **Title**: ${similar.issue.title}\n`;
        text += `- **Similarity**: ${similarity}%\n`;
        text += `- **Relationship**: ${similar.relationship}\n`;
        text += `- **Status**: ${similar.issue.state}\n`;
        text += `- **Link**: [View Issue](${similar.issue.html_url})\n`;

        if (similar.reasons.length > 0) {
          text += `- **Reasons**: ${similar.reasons.join(', ')}\n`;
        }

        text += '\n';

        // Add annotation for high similarity
        if (similarity >= 80) {
          annotations.push({
            path: '.github',
            start_line: 1,
            end_line: 1,
            annotation_level: 'warning',
            message: `High similarity (${similarity}%) with issue #${similar.issue.number}: ${similar.issue.title}`,
            title: 'Potential Duplicate',
          });
        }
      }

      text += '\n### 💡 Recommendations\n\n';
      text += '- Review the similar issues to avoid duplicate work\n';
      text +=
        '- Reference related issues in your PR description using `Fixes #123` or `Relates to #456`\n';
      text += '- Consider closing this PR if it duplicates an existing issue\n';
    } else {
      summary = 'No similar issues found';
      text = '## ✅ No Similar Issues Found\n\n';
      text += 'This appears to be addressing a unique issue or feature.\n\n';
      text += '### 📝 Next Steps\n';
      text += '- Ensure your PR description is clear and comprehensive\n';
      text += '- Add relevant labels to help with categorization\n';
      text += '- Link any related issues or discussions\n';
    }

    // Complete check run with results
    await checkRunManager.complete(checkRunId, conclusion, summary);

    console.log(
      '✅ Similarity check completed for PR #%s: %s similar issues',
      pr.number,
      similarIssues.length
    );
    return { similar_issues: similarIssues.length, conclusion };
  } catch (error) {
    // Fail check run with error
    await checkRunManager.fail(checkRunId, (error as Error).message);

    throw error;
  }
}

/**
 * Run performance check and post results as GitHub Check Run
 */
async function runPerformanceCheck(
  pr: any,
  repo: any,
  octokit: Octokit
): Promise<{ has_risks: boolean; conclusion: string }> {
  const checkRunName = 'Performance Impact Analysis';
  const checkRunManager = new CheckRunManager(octokit, repo.owner.login, repo.name, pr.head.sha);

  // Create check run
  const checkRunId = await checkRunManager.create({
    name: checkRunName,
    head_sha: pr.head.sha,
    status: 'in_progress',
  });

  try {
    // Analyze PR changes for performance impact
    const performanceAnalysis = await analyzePerformanceImpact(pr, repo, octokit);

    // Determine conclusion based on analysis
    let conclusion: 'success' | 'neutral' | 'failure' = 'success';
    let summary = '';
    let text = '## ⚡ Performance Impact Analysis\n\n';
    const annotations: Array<{
      path: string;
      start_line: number;
      end_line: number;
      annotation_level: 'notice' | 'warning' | 'failure';
      message: string;
      title?: string;
    }> = [];

    if (performanceAnalysis.hasRisks) {
      conclusion = performanceAnalysis.severity === 'high' ? 'failure' : 'neutral';
      summary = `Found ${performanceAnalysis.risks.length} potential performance issue(s)`;

      text += '### ⚠️ Potential Performance Impacts\n\n';

      for (const risk of performanceAnalysis.risks) {
        const emoji = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢';
        text += `${emoji} **${risk.title}**\n`;
        text += `- File: \`${risk.file}\`\n`;
        text += `- Severity: ${risk.severity}\n`;
        text += `- Description: ${risk.description}\n\n`;

        // Add annotation
        if (risk.line) {
          annotations.push({
            path: risk.file,
            start_line: risk.line,
            end_line: risk.line,
            annotation_level: risk.severity === 'high' ? 'failure' : 'warning',
            message: risk.description,
            title: risk.title,
          });
        }
      }

      text += '\n### 📊 Metrics\n\n';
      text += `- Files changed: ${pr.changed_files}\n`;
      text += `- Lines added: ${pr.additions}\n`;
      text += `- Lines removed: ${pr.deletions}\n`;
      text += `- Bundle size impact: ${performanceAnalysis.bundleSizeImpact || 'Unknown'}\n`;

      text += '\n### 💡 Recommendations\n\n';
      for (const rec of performanceAnalysis.recommendations) {
        text += `- ${rec}\n`;
      }
    } else {
      summary = 'No performance concerns detected';
      text += '### ✅ No Performance Concerns\n\n';
      text += 'This PR appears to have minimal performance impact.\n\n';
      text += '### 📊 Metrics\n\n';
      text += `- Files changed: ${pr.changed_files}\n`;
      text += `- Lines added: ${pr.additions}\n`;
      text += `- Lines removed: ${pr.deletions}\n`;
    }

    // Complete check run with results
    await checkRunManager.complete(checkRunId, conclusion, summary);

    console.log('✅ Performance check completed for PR #%s', pr.number);
    return { has_risks: performanceAnalysis.hasRisks, conclusion };
  } catch (error) {
    // Fail check run with error
    await checkRunManager.fail(checkRunId, (error as Error).message);

    throw error;
  }
}

/**
 * Analyze PR for performance impact
 */
interface PerformanceRisk {
  file: string;
  line?: number;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

interface PerformanceAnalysis {
  hasRisks: boolean;
  severity?: 'high' | 'medium' | 'low';
  risks: PerformanceRisk[];
  recommendations: string[];
  bundleSizeImpact?: string;
}

async function analyzePerformanceImpact(
  pr: any,
  repo: any,
  octokit: Octokit
): Promise<PerformanceAnalysis> {
  const risks: PerformanceRisk[] = [];
  const recommendations: string[] = [];

  try {
    // Get PR files
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner: repo.owner.login,
      repo: repo.name,
      pull_number: pr.number,
      per_page: 100,
    });

    // Analyze each file for performance patterns
    for (const file of files) {
      const filename = file.filename;
      const additions = file.additions || 0;

      // Check for large files
      if (additions > 500) {
        risks.push({
          file: filename,
          title: 'Large file addition',
          description: `File adds ${additions} lines, which may impact bundle size`,
          severity: additions > 1000 ? 'high' : 'medium',
        });
      }

      // Check for performance-sensitive patterns
      if (filename.match(/\.(tsx?|jsx?)$/)) {
        // Would need to fetch file content to check for patterns
        // For now, just check file extensions and sizes
        if (filename.includes('index') && additions > 100) {
          recommendations.push(`Consider code splitting for ${filename}`);
        }
      }

      // Check for dependency additions
      if (filename === 'package.json' && additions > 0) {
        recommendations.push('New dependencies added - verify bundle size impact');
      }
    }

    // Determine overall severity
    let severity: 'high' | 'medium' | 'low' = 'low';
    if (risks.some((r) => r.severity === 'high')) {
      severity = 'high';
    } else if (risks.some((r) => r.severity === 'medium')) {
      severity = 'medium';
    }

    // Estimate bundle size impact
    const totalAdditions = files.reduce((sum, f) => sum + (f.additions || 0), 0);
    let bundleSizeImpact = 'Minimal';
    if (totalAdditions > 1000) {
      bundleSizeImpact = 'Significant';
    } else if (totalAdditions > 500) {
      bundleSizeImpact = 'Moderate';
    }

    return {
      hasRisks: risks.length > 0,
      severity: risks.length > 0 ? severity : undefined,
      risks,
      recommendations,
      bundleSizeImpact,
    };
  } catch (error) {
    console.error('Error analyzing performance impact: %o', error);
    return {
      hasRisks: false,
      risks: [],
      recommendations: ['Unable to analyze performance impact due to an error'],
    };
  }
}
