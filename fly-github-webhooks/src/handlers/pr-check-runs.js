import Logger from '../utils/logger.js';

/**
 * PR Check Runs handler for fork PRs
 * Provides similarity checks and performance monitoring via GitHub Check Runs API
 */

/**
 * Handle PR events for check runs (similarity & performance)
 */
export async function handlePRCheckRuns(payload, githubApp, supabase, parentLogger) {
  const logger = parentLogger ? parentLogger.child('PRCheckRuns') : new Logger('PRCheckRuns');
  const { pull_request: pr, repository: repo, installation, action } = payload;

  // Only process on PR opened, synchronize, or ready_for_review
  if (!['opened', 'synchronize', 'ready_for_review'].includes(action)) {
    logger.info('Skipping check runs for action: %s', action);
    return { success: true, skipped: true };
  }

  // Skip draft PRs
  if (pr.draft) {
    logger.info('Skipping check runs for draft PR');
    return { success: true, skipped: true };
  }

  logger.info('Running checks for PR #%s in %s', pr.number, repo.full_name);

  try {
    // Get installation Octokit
    const octokit = await githubApp.getInstallationOctokit(installation.id);

    // Run checks in parallel
    const [similarityResult, performanceResult] = await Promise.allSettled([
      runSimilarityCheck(pr, repo, octokit, supabase, logger),
      runPerformanceCheck(pr, repo, octokit, logger),
    ]);

    // Log results
    if (similarityResult.status === 'rejected') {
      logger.error('Similarity check failed:', similarityResult.reason);
    }
    if (performanceResult.status === 'rejected') {
      logger.error('Performance check failed:', performanceResult.reason);
    }

    return {
      success: true,
      similarity: similarityResult.status === 'fulfilled' ? similarityResult.value : null,
      performance: performanceResult.status === 'fulfilled' ? performanceResult.value : null,
    };
  } catch (error) {
    logger.error('Error handling PR check runs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Run similarity check and post results as GitHub Check Run
 */
async function runSimilarityCheck(pr, repo, octokit, supabase, logger) {
  const checkRunName = 'Similarity Analysis';

  // Create check run
  const { data: checkRun } = await octokit.rest.checks.create({
    owner: repo.owner.login,
    repo: repo.name,
    name: checkRunName,
    head_sha: pr.head.sha,
    status: 'in_progress',
    started_at: new Date().toISOString(),
  });

  try {
    // Find similar issues
    const similarIssues = await findSimilarIssues(
      repo.full_name,
      pr.title,
      pr.body,
      supabase,
      logger
    );

    // Prepare check run output
    let conclusion = 'success';
    let summary = '';
    let text = '';
    let annotations = [];

    if (similarIssues.length > 0) {
      conclusion = 'neutral';
      summary = `Found ${similarIssues.length} similar issue(s)`;

      text = '## 🔍 Similar Issues Found\n\n';
      text += 'The following issues appear to be related to this PR:\n\n';

      for (const issue of similarIssues) {
        const similarity = Math.round(issue.similarity * 100);
        const stateEmoji = issue.state === 'open' ? '🟢' : '🔴';

        text += `### ${stateEmoji} Issue #${issue.number}\n`;
        text += `- **Title**: ${issue.title}\n`;
        text += `- **Similarity**: ${similarity}%\n`;
        text += `- **Status**: ${issue.state}\n`;
        text += `- **Link**: [View Issue](${issue.html_url})\n\n`;

        // Add annotation for high similarity
        if (similarity >= 80) {
          annotations.push({
            path: '.github',
            start_line: 1,
            end_line: 1,
            annotation_level: 'warning',
            message: `High similarity (${similarity}%) with issue #${issue.number}: ${issue.title}`,
            title: 'Potential Duplicate',
          });
        }
      }

      text += '\n### 💡 Recommendations\n\n';
      text += '- Review the similar issues to avoid duplicate work\n';
      text += '- Reference related issues in your PR description\n';
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

    // Update check run with results
    await octokit.rest.checks.update({
      owner: repo.owner.login,
      repo: repo.name,
      check_run_id: checkRun.id,
      status: 'completed',
      conclusion,
      completed_at: new Date().toISOString(),
      output: {
        title: checkRunName,
        summary,
        text,
        annotations: annotations.slice(0, 50), // GitHub limits to 50 annotations
      },
    });

    logger.info('✅ Similarity check completed for PR #%s', pr.number);
    return { similar_issues: similarIssues.length, conclusion };
  } catch (error) {
    // Update check run with error
    await octokit.rest.checks.update({
      owner: repo.owner.login,
      repo: repo.name,
      check_run_id: checkRun.id,
      status: 'completed',
      conclusion: 'failure',
      completed_at: new Date().toISOString(),
      output: {
        title: checkRunName,
        summary: 'Similarity check failed',
        text: `An error occurred during similarity analysis:\n\n\`\`\`\n${error.message}\n\`\`\``,
      },
    });

    throw error;
  }
}

/**
 * Run performance check and post results as GitHub Check Run
 */
async function runPerformanceCheck(pr, repo, octokit, logger) {
  const checkRunName = 'Performance Impact Analysis';

  // Create check run
  const { data: checkRun } = await octokit.rest.checks.create({
    owner: repo.owner.login,
    repo: repo.name,
    name: checkRunName,
    head_sha: pr.head.sha,
    status: 'in_progress',
    started_at: new Date().toISOString(),
  });

  try {
    // Analyze PR changes for performance impact
    const performanceAnalysis = await analyzePerformanceImpact(pr, repo, octokit, logger);

    // Determine conclusion based on analysis
    let conclusion = 'success';
    let summary = '';
    let text = '## ⚡ Performance Impact Analysis\n\n';
    let annotations = [];

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

    // Update check run with results
    await octokit.rest.checks.update({
      owner: repo.owner.login,
      repo: repo.name,
      check_run_id: checkRun.id,
      status: 'completed',
      conclusion,
      completed_at: new Date().toISOString(),
      output: {
        title: checkRunName,
        summary,
        text,
        annotations: annotations.slice(0, 50), // GitHub limits to 50 annotations
      },
    });

    logger.info('✅ Performance check completed for PR #%s', pr.number);
    return { has_risks: performanceAnalysis.hasRisks, conclusion };
  } catch (error) {
    // Update check run with error
    await octokit.rest.checks.update({
      owner: repo.owner.login,
      repo: repo.name,
      check_run_id: checkRun.id,
      status: 'completed',
      conclusion: 'failure',
      completed_at: new Date().toISOString(),
      output: {
        title: checkRunName,
        summary: 'Performance check failed',
        text: `An error occurred during performance analysis:\n\n\`\`\`\n${error.message}\n\`\`\``,
      },
    });

    throw error;
  }
}

/**
 * Find similar issues using embeddings
 * TODO: Re-enable once issue-similarity service is available in webhook context
 */
async function findSimilarIssues(repoFullName, prTitle, prBody, supabase, logger) {
  // Temporarily disabled - similarity check requires ML dependencies not available in webhook server
  logger.info('Similarity check temporarily disabled for webhook server');
  return [];
}

/**
 * Analyze PR for performance impact
 */
async function analyzePerformanceImpact(pr, repo, octokit, logger) {
  const risks = [];
  const recommendations = [];

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
      // Check for large file additions
      if (file.additions > 500) {
        risks.push({
          file: file.filename,
          title: 'Large file addition',
          description: `Added ${file.additions} lines which may impact bundle size`,
          severity: file.additions > 1000 ? 'high' : 'medium',
          line: null,
        });
      }

      // Check for performance-sensitive file patterns
      if (file.filename.match(/\.(jsx?|tsx?)$/)) {
        // Get file content patch
        const patch = file.patch || '';

        // Check for common performance anti-patterns
        if (patch.includes('setTimeout') || patch.includes('setInterval')) {
          risks.push({
            file: file.filename,
            title: 'Timer usage detected',
            description: 'Ensure timers are properly cleaned up to avoid memory leaks',
            severity: 'medium',
            line: null,
          });
        }

        if (patch.includes('.map(') && patch.includes('.map(')) {
          risks.push({
            file: file.filename,
            title: 'Multiple map operations',
            description: 'Consider combining multiple map operations for better performance',
            severity: 'low',
            line: null,
          });
        }

        if (patch.includes('JSON.parse') || patch.includes('JSON.stringify')) {
          risks.push({
            file: file.filename,
            title: 'JSON operations detected',
            description: 'Large JSON operations can block the main thread',
            severity: 'low',
            line: null,
          });
        }

        // Check for large dependencies
        if (file.filename === 'package.json' && file.additions > 0) {
          risks.push({
            file: file.filename,
            title: 'Dependencies added',
            description: 'New dependencies may increase bundle size',
            severity: 'medium',
            line: null,
          });
          recommendations.push('Run bundle size analysis to measure impact');
        }
      }

      // Check for image files
      if (file.filename.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
        risks.push({
          file: file.filename,
          title: 'Image file added',
          description: 'Consider optimizing images for web delivery',
          severity: 'low',
          line: null,
        });
        recommendations.push('Use image optimization tools to reduce file size');
      }
    }

    // Add general recommendations based on PR size
    if (pr.changed_files > 20) {
      recommendations.push('Consider breaking this PR into smaller, focused changes');
    }

    if (pr.additions > 1000) {
      recommendations.push('Large PRs are harder to review - consider splitting if possible');
    }

    return {
      hasRisks: risks.length > 0,
      severity: risks.some((r) => r.severity === 'high')
        ? 'high'
        : risks.some((r) => r.severity === 'medium')
          ? 'medium'
          : 'low',
      risks,
      recommendations:
        recommendations.length > 0 ? recommendations : ['Continue with standard review process'],
      bundleSizeImpact: null, // Could integrate with bundle analysis tools
    };
  } catch (error) {
    logger.error('Error analyzing performance impact:', error);
    return {
      hasRisks: false,
      risks: [],
      recommendations: ['Unable to complete performance analysis'],
    };
  }
}
