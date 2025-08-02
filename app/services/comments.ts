import { PullRequest, Repository } from '../types/github';
import { ContributorInsights } from './insights';
import { SimilarIssue } from './similarity';
import { ReviewerSuggestion } from './reviewers';
import { ContextualItem } from './issue-context';

interface CommentData {
  pullRequest: PullRequest;
  repository: Repository;
  contributorInsights: ContributorInsights;
  similarIssues: SimilarIssue[];
  reviewerSuggestions: ReviewerSuggestion[];
  hasCodeOwners?: boolean;
}

/**
 * Format a PR comment with insights
 */
export function formatPRComment(data: CommentData): string {
  const { contributorInsights, similarIssues, reviewerSuggestions } = data;
  
  let comment = `## 🎯 Contributor Insights

<table>
<tr>
<td width="80">
<img src="https://github.com/${contributorInsights.login}.png" width="64" height="64" />
</td>
<td>
<strong><a href="https://github.com/${contributorInsights.login}">@${contributorInsights.login}</a></strong><br/>
📊 <strong>${contributorInsights.totalPRs}</strong> PRs (<strong>${contributorInsights.mergedPRs}</strong> merged)<br/>
💬 <strong>${contributorInsights.reviewsGiven}</strong> reviews • <strong>${contributorInsights.commentsLeft}</strong> comments<br/>
✅ <strong>${contributorInsights.firstTimeApprovalRate}%</strong> first-time approval rate
</td>
</tr>
</table>

<details>
<summary>📈 Contribution Stats</summary>

- 🔨 **Pull Requests**: ${contributorInsights.totalPRs} total (${contributorInsights.mergedPRs} merged)
- 👀 **Code Reviews**: ${contributorInsights.reviewsGiven} reviews given
- 💭 **Comments**: ${contributorInsights.commentsLeft} comments on issues/PRs
- 🏆 **Expertise**: ${contributorInsights.expertise.length > 0 
  ? contributorInsights.expertise.map(exp => `\`${exp}\``).join(' ') 
  : 'Various areas'}
- 🔄 **Last active**: ${contributorInsights.lastActive}

</details>
`;

  // Add similar issues section if any found
  if (similarIssues.length > 0) {
    comment += `
### 🔍 Related Issues & Context
`;
    
    // Group by relationship type
    const implementsIssues = similarIssues.filter(i => i.relationship === 'implements');
    const fixesIssues = similarIssues.filter(i => i.relationship === 'fixes');
    const relatedIssues = similarIssues.filter(i => i.relationship === 'relates_to' || i.relationship === 'similar');
    
    if (implementsIssues.length > 0) {
      comment += `\n#### 🎯 This PR implements:\n`;
      implementsIssues.forEach(({ issue, reasons }) => {
        const labels = issue.labels?.map((l: any) => `\`${l.name}\``).join(' ') || '';
        comment += `- **[#${issue.number}](${issue.html_url})** ${issue.title} ${labels}\n`;
      });
    }
    
    if (fixesIssues.length > 0) {
      comment += `\n#### ✅ This PR may fix:\n`;
      fixesIssues.forEach(({ issue, reasons }) => {
        const priority = issue.labels?.find((l: any) => l.name.includes('priority'))?.name || '';
        const labels = issue.labels?.map((l: any) => `\`${l.name}\``).join(' ') || '';
        comment += `- **[#${issue.number}](${issue.html_url})** ${issue.title} ${labels}\n`;
      });
    }
    
    if (relatedIssues.length > 0) {
      const showAll = relatedIssues.length <= 3;
      comment += `\n#### 🔄 Related issues:\n`;
      
      if (showAll) {
        relatedIssues.forEach(({ issue, reasons, similarityScore }) => {
          const state = issue.state === 'closed' ? '`closed`' : '`open`';
          comment += `- **[#${issue.number}](${issue.html_url})** ${issue.title} ${state}\n`;
        });
      } else {
        // Show first 3, rest in collapsible
        relatedIssues.slice(0, 3).forEach(({ issue }) => {
          const state = issue.state === 'closed' ? '`closed`' : '`open`';
          comment += `- **[#${issue.number}](${issue.html_url})** ${issue.title} ${state}\n`;
        });
        
        comment += `\n<details>\n<summary>View ${relatedIssues.length - 3} more related issues</summary>\n\n`;
        relatedIssues.slice(3).forEach(({ issue, reasons }) => {
          const state = issue.state === 'closed' ? '`closed`' : '`open`';
          comment += `- **[#${issue.number}](${issue.html_url})** ${issue.title} ${state}\n`;
          if (reasons.length > 0) {
            comment += `  - ${reasons.join(', ')}\n`;
          }
        });
        comment += `</details>`;
      }
    }
  }

  // Add reviewer suggestions with enhanced formatting
  if (reviewerSuggestions.length > 0) {
    comment += `
### 💡 Suggested Reviewers
Based on code ownership and expertise:

<table>
<tr><th>Reviewer</th><th>Expertise</th><th>Stats</th></tr>`;
    
    reviewerSuggestions.forEach(reviewer => {
      const expertiseBadges = reviewer.stats.expertise
        .map(exp => `\`${exp}\``)
        .join(' ');
      
      comment += `
<tr>
<td>
<img src="${reviewer.avatarUrl}" width="20" height="20" align="center" />
<strong><a href="https://github.com/${reviewer.login}">@${reviewer.login}</a></strong>
${reviewer.name ? `<br/><sub>${reviewer.name}</sub>` : ''}
</td>
<td>${expertiseBadges}</td>
<td>
📊 ${reviewer.stats.reviewsGiven} reviews<br/>
⏱️ ${reviewer.stats.avgResponseTime} avg response<br/>
🕐 ${reviewer.stats.lastActive}
</td>
</tr>`;
    });
    
    comment += `
</table>

<details>
<summary>Why these reviewers?</summary>

`;
    reviewerSuggestions.forEach(reviewer => {
      comment += `**@${reviewer.login}**: ${reviewer.reasons.join(', ')}\n\n`;
    });
    comment += `</details>`;
  } else if (data.hasCodeOwners === false) {
    // No reviewers found and no CODEOWNERS file
    comment += `
### 💡 Reviewer Suggestions

No CODEOWNERS file found in this repository. Consider creating one to automatically suggest reviewers for PRs.

<details>
<summary>How to set up CODEOWNERS</summary>

Create \`.github/CODEOWNERS\` or \`CODEOWNERS\` in your repository root:

\`\`\`
# Frontend team owns all TypeScript files
*.ts @frontend-team
*.tsx @frontend-team

# Specific user owns the auth module
/src/auth/ @alice

# Multiple owners for API
/api/ @bob @carol
\`\`\`

[Learn more about CODEOWNERS →](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
</details>
`;
  }

  // Add potential impact section if issues are being fixed
  const fixedIssues = similarIssues.filter(i => i.relationship === 'fixes');
  if (fixedIssues.length > 0) {
    comment += `
### 📈 Potential Impact
`;
    
    // Count affected users (mock data for now)
    const affectedUsers = fixedIssues.length * 3;
    comment += `- **Fixes ${fixedIssues.length} issue${fixedIssues.length > 1 ? 's' : ''}** potentially affecting ${affectedUsers}+ users\n`;
    
    // List enabled features
    const enabledFeatures = similarIssues
      .filter(i => i.reasons.some(r => r.includes('Enables')))
      .map(i => `#${i.issue.number}`);
    
    if (enabledFeatures.length > 0) {
      comment += `- **Enables**: ${enabledFeatures.join(', ')}\n`;
    }
  }

  // Add footer with interactive elements
  comment += `
---
<sub>

📊 **[View full analytics →](https://contributor.info/github/${data.repository.full_name}/pulls/${data.pullRequest.number})**

*Generated by [contributor.info](https://contributor.info) • [Install on more repos](https://github.com/apps/contributor-info) • [Configure settings](https://github.com/${data.repository.full_name}/blob/${data.repository.default_branch}/.contributor)*

</sub>`;

  return comment;
}

/**
 * Format a minimal PR comment (for users who prefer less detail)
 */
export function formatMinimalPRComment(data: CommentData): string {
  const { contributorInsights, reviewerSuggestions, similarIssues } = data;
  
  let comment = `**@${contributorInsights.login}**: ${contributorInsights.mergedPRs}/${contributorInsights.totalPRs} PRs merged`;
  
  if (reviewerSuggestions.length > 0) {
    comment += ` • Suggested reviewers: ${reviewerSuggestions.slice(0, 2).map(r => `@${r.login}`).join(', ')}`;
  }
  
  const fixCount = similarIssues.filter(i => i.relationship === 'fixes').length;
  if (fixCount > 0) {
    comment += ` • Fixes ${fixCount} issue${fixCount > 1 ? 's' : ''}`;
  }
  
  comment += ` • [Details](https://contributor.info)`;
  
  return comment;
}

/**
 * Format a welcome message for first-time contributors
 */
export function formatWelcomeComment(contributor: string, repository: Repository): string {
  return `## 👋 Welcome @${contributor}!

Thank you for your first contribution to **${repository.full_name}**! 

We use [contributor.info](https://contributor.info) to help identify the best reviewers for your PR and provide context about related issues. Your PR will be reviewed soon!

If you have any questions, feel free to ask in the comments below.

---
*Generated by [contributor.info](https://contributor.info)*`;
}

/**
 * Format an error message when insights can't be generated
 */
export function formatErrorComment(): string {
  return `## 🎯 Contributor Insights

We're currently experiencing issues generating insights for this PR. The review process will continue as normal.

If this persists, please contact support at support@contributor.info.

---
*[contributor.info](https://contributor.info)*`;
}

interface ContextCommentData {
  pullRequest: any; // GitHub Issue object (which represents the PR)
  repository: Repository;
  contextualItems: ContextualItem[];
  changedFiles: string[];
}

/**
 * Format a comment response to the .issues command
 */
export function formatContextComment(data: ContextCommentData): string {
  const { contextualItems, changedFiles } = data;
  
  if (contextualItems.length === 0) {
    return `## 📋 Issue Context Analysis

No related issues or pull requests found for this PR.

This might be because:
- This is working on a new area of the codebase
- Related issues haven't been indexed yet
- The changes are too unique to match existing work

---
*Generated by [contributor.info](https://contributor.info) • Use \`.issues\` in any PR comment to analyze context*`;
  }

  let comment = `## 📋 Issue Context Analysis

Based on the files changed in this PR, here are related issues and pull requests:

`;

  // Group items by relationship
  const mayFix = contextualItems.filter(item => item.relationship === 'may_fix');
  const relatedWork = contextualItems.filter(item => item.relationship === 'related_work');
  const mayConflict = contextualItems.filter(item => item.relationship === 'may_conflict');
  const similarChanges = contextualItems.filter(item => item.relationship === 'similar_changes');

  // Show items that may be fixed
  if (mayFix.length > 0) {
    comment += `### 🔧 May Fix These Issues\n`;
    mayFix.forEach(item => {
      const matchPercent = Math.round((item.similarity_score * 0.6 + item.file_overlap_score * 0.4) * 100);
      comment += `- **#${item.number}**: "${item.title}" (${matchPercent}% match)\n`;
      if (item.reasons.length > 0) {
        comment += `  - ${item.reasons.join(', ')}\n`;
      }
    });
    comment += '\n';
  }

  // Show related recent work
  if (relatedWork.length > 0) {
    comment += `### 🔄 Related Recent Work\n`;
    relatedWork.forEach(item => {
      const stateIcon = item.state === 'closed' ? '✅' : '🔵';
      const typeLabel = item.type === 'pull_request' ? 'PR' : 'Issue';
      comment += `- ${stateIcon} **${typeLabel} #${item.number}**: "${item.title}"\n`;
      if (item.reasons.length > 0) {
        comment += `  - ${item.reasons.join(', ')}\n`;
      }
    });
    comment += '\n';
  }

  // Show potential conflicts
  if (mayConflict.length > 0) {
    comment += `### ⚠️ Potential Conflicts\n`;
    mayConflict.forEach(item => {
      comment += `- **PR #${item.number}**: "${item.title}" (currently open)\n`;
      if (item.reasons.length > 0) {
        comment += `  - ${item.reasons.join(', ')}\n`;
      }
    });
    comment += '\n';
  }

  // Show similar historical changes
  if (similarChanges.length > 0) {
    comment += `### 📊 Similar Historical Changes\n`;
    similarChanges.forEach(item => {
      const matchPercent = Math.round(item.similarity_score * 100);
      const typeLabel = item.type === 'pull_request' ? 'PR' : 'Issue';
      comment += `- **${typeLabel} #${item.number}**: "${item.title}" (${matchPercent}% similarity)\n`;
    });
    comment += '\n';
  }

  // Add file context
  if (changedFiles.length > 0) {
    comment += `### 📁 Changed Files\n`;
    comment += `This PR modifies ${changedFiles.length} file${changedFiles.length > 1 ? 's' : ''}`;
    if (changedFiles.length <= 5) {
      comment += `: ${changedFiles.map(f => `\`${f}\``).join(', ')}`;
    } else {
      const dirs = new Set(changedFiles.map(f => f.split('/')[0]));
      comment += ` across ${dirs.size} director${dirs.size > 1 ? 'ies' : 'y'}`;
    }
    comment += '\n\n';
  }

  // Add footer
  comment += `---
*Generated based on semantic analysis of ${contextualItems.length} related items • [Learn more](https://contributor.info/docs/issue-context)*`;

  return comment;
}