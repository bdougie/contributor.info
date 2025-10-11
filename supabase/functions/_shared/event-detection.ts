export interface PrivilegedEventDetection {
  isPrivileged: boolean;
  detectionMethod: string;
  confidence: number;
  signals: string[];
}

export interface GitHubEvent {
  type: string;
  id: string;
  actor: {
    login: string;
  };
  repo: {
    name: string;
  };
  payload: any;
  created_at: string;
}

// Bot detection patterns
const BOT_PATTERNS = [
  /\[bot\]$/i,
  /^dependabot/i,
  /^renovate/i,
  /^greenkeeper/i,
  /^snyk/i,
  /^imgbot/i,
  /^allcontributors/i,
  /^github-actions/i,
  /^codecov/i,
  /^coveralls/i,
  /^semantic-release/i,
  /^release-drafter/i,
];

export function isBotAccount(username: string): boolean {
  return BOT_PATTERNS.some((pattern) => pattern.test(username));
}

// Comprehensive event detection with multiple signal types
export function detectPrivilegedEvent(event: GitHubEvent): PrivilegedEventDetection {
  const signals: string[] = [];
  let totalConfidence = 0;
  let detectionMethod = 'none';

  // Skip bot accounts unless they're doing highly privileged actions
  const isBot = isBotAccount(event.actor.login);

  // 1. Pull Request Merge Events (Highest confidence)
  if (
    event.type === 'PullRequestEvent' &&
    event.payload.action === 'closed' &&
    event.payload.pull_request?.merged === true
  ) {
    const merger = event.payload.pull_request.merged_by?.login;
    if (merger === event.actor.login) {
      signals.push('merged_own_pr');
      totalConfidence = Math.max(totalConfidence, 0.95);
      detectionMethod = 'merge_event';
    }
  }

  // 2. Push Events to Protected Branches
  if (event.type === 'PushEvent') {
    const ref = event.payload.ref?.replace('refs/heads/', '');

    // Direct push to main/master
    if (ref === 'main' || ref === 'master') {
      signals.push('push_to_main');
      totalConfidence = Math.max(totalConfidence, 0.9);
      detectionMethod = 'push_to_protected';
    }

    // Force push (high privilege indicator)
    if (event.payload.forced === true) {
      signals.push('force_push');
      totalConfidence = Math.max(totalConfidence, 0.92);
      if (detectionMethod === 'none') detectionMethod = 'force_push';
    }

    // Multiple commits in one push (batch operations)
    if (event.payload.commits?.length > 5) {
      signals.push('batch_push');
      totalConfidence = Math.max(totalConfidence, 0.75);
    }
  }

  // 3. Release Management
  if (event.type === 'ReleaseEvent') {
    if (event.payload.action === 'published') {
      signals.push('release_published');
      totalConfidence = Math.max(totalConfidence, 0.85);
      detectionMethod = 'release_published';
    } else if (event.payload.action === 'created') {
      signals.push('release_created');
      totalConfidence = Math.max(totalConfidence, 0.8);
    }
  }

  // 4. Pull Request Review Dismissal (Admin action)
  if (event.type === 'PullRequestReviewEvent' && event.payload.action === 'dismissed') {
    signals.push('review_dismissed');
    totalConfidence = Math.max(totalConfidence, 0.85);
    detectionMethod = 'review_dismissed';
  }

  // 5. Issue and PR Management
  if (event.type === 'IssuesEvent' || event.type === 'PullRequestEvent') {
    // Closing others' issues/PRs
    if (
      event.payload.action === 'closed' &&
      event.payload.issue?.user?.login !== event.actor.login &&
      event.payload.pull_request?.user?.login !== event.actor.login
    ) {
      signals.push('closed_others_issue');
      totalConfidence = Math.max(totalConfidence, 0.7);
      if (detectionMethod === 'none') detectionMethod = 'issue_management';
    }

    // Locking conversations
    if (event.payload.action === 'locked') {
      signals.push('locked_conversation');
      totalConfidence = Math.max(totalConfidence, 0.75);
      if (detectionMethod === 'none') detectionMethod = 'issue_management';
    }

    // Reopening after close
    if (event.payload.action === 'reopened') {
      signals.push('reopened_issue');
      totalConfidence = Math.max(totalConfidence, 0.65);
    }
  }

  // 6. Label and Milestone Management
  if (event.type === 'IssuesEvent' || event.type === 'PullRequestEvent') {
    if (
      event.payload.action === 'labeled' ||
      event.payload.action === 'unlabeled' ||
      event.payload.action === 'milestoned'
    ) {
      signals.push('label_management');
      totalConfidence = Math.max(totalConfidence, 0.6);
      if (detectionMethod === 'none') detectionMethod = 'triage_actions';
    }
  }

  // 7. Project and Team Events
  if (
    event.type === 'ProjectEvent' ||
    event.type === 'ProjectCardEvent' ||
    event.type === 'ProjectColumnEvent'
  ) {
    signals.push('project_management');
    totalConfidence = Math.max(totalConfidence, 0.7);
    if (detectionMethod === 'none') detectionMethod = 'project_management';
  }

  // 8. Repository Management Events
  if (event.type === 'RepositoryEvent') {
    const adminActions = ['privatized', 'publicized', 'archived', 'unarchived'];
    if (adminActions.includes(event.payload.action)) {
      signals.push('repo_admin_action');
      totalConfidence = Math.max(totalConfidence, 0.95);
      detectionMethod = 'admin_action';
    }
  }

  // 9. Team and Member Events
  if (event.type === 'TeamEvent' || event.type === 'TeamAddEvent' || event.type === 'MemberEvent') {
    signals.push('team_management');
    totalConfidence = Math.max(totalConfidence, 0.9);
    if (detectionMethod === 'none') detectionMethod = 'team_management';
  }

  // 10. Branch Protection Events
  if (event.type === 'BranchProtectionRuleEvent') {
    signals.push('branch_protection');
    totalConfidence = Math.max(totalConfidence, 0.95);
    detectionMethod = 'branch_protection';
  }

  // 7. User Engagement Events (NON-privileged but important for confidence)
  if (event.type === 'WatchEvent') {
    if (event.payload.action === 'started') {
      signals.push('starred_repository');
      if (detectionMethod === 'none') detectionMethod = 'user_engagement';
      // Note: Not setting totalConfidence as this is NOT a privileged action
    }
  }

  if (event.type === 'ForkEvent') {
    signals.push('forked_repository');
    if (detectionMethod === 'none') detectionMethod = 'user_engagement';
    // Note: Not setting totalConfidence as this is NOT a privileged action
  }

  // Comment Events (NON-privileged engagement indicators)
  if (event.type === 'IssueCommentEvent') {
    if (event.payload.action === 'created') {
      signals.push('commented_on_issue');
      if (detectionMethod === 'none') detectionMethod = 'user_engagement';
      // Note: Not setting totalConfidence as this is NOT a privileged action

      // Store issue comment for triager/first responder analysis
      // This is handled in the webhook processing, not here in privilege detection
    }
  }

  if (event.type === 'PullRequestReviewCommentEvent') {
    if (event.payload.action === 'created') {
      signals.push('commented_on_pr_review');
      if (detectionMethod === 'none') detectionMethod = 'user_engagement';
      // Note: Not setting totalConfidence as this is NOT a privileged action
    }
  }

  if (event.type === 'CommitCommentEvent') {
    signals.push('commented_on_commit');
    if (detectionMethod === 'none') detectionMethod = 'user_engagement';
    // Note: Not setting totalConfidence as this is NOT a privileged action
  }

  // Apply bot penalty (reduce confidence for bot accounts)
  if (isBot && totalConfidence < 0.9) {
    totalConfidence *= 0.5;
    signals.push('bot_account');
  }

  return {
    isPrivileged: totalConfidence >= 0.6,
    detectionMethod,
    confidence: totalConfidence,
    signals,
  };
}

// Calculate combined confidence from multiple events
export function calculateAggregateConfidence(
  events: PrivilegedEventDetection[],
  timeSpanDays: number = 30,
): number {
  if (events.length === 0) return 0;

  // Weight recent events higher
  const now = Date.now();
  const timeWeight = 1 / timeSpanDays;

  let weightedSum = 0;
  let totalWeight = 0;

  events.forEach((event, index) => {
    // Recency weight (newer events have higher weight)
    const ageInDays = index * timeWeight * timeSpanDays;
    const recencyWeight = Math.exp(-ageInDays / 30); // Exponential decay

    // Diversity bonus (different signal types add credibility)
    const uniqueSignals = new Set(event.signals).size;
    const diversityBonus = 1 + uniqueSignals * 0.1;

    const weight = recencyWeight * diversityBonus;
    weightedSum += event.confidence * weight;
    totalWeight += weight;
  });

  // Apply confidence formula
  const baseConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Activity modifier (more events increase confidence, with diminishing returns)
  const activityModifier = Math.min(1.2, 1 + Math.log10(events.length + 1) * 0.1);

  return Math.min(1, baseConfidence * activityModifier);
}

// Pattern detection for specific maintainer behaviors
export interface MaintainerPattern {
  pattern: string;
  confidence: number;
  description: string;
}

export function detectMaintainerPatterns(events: GitHubEvent[]): MaintainerPattern[] {
  const patterns: MaintainerPattern[] = [];

  // Group events by type
  const eventsByType = events.reduce(
    (acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Pattern 1: Regular merger
  const mergeCount = eventsByType['PullRequestEvent'] || 0;
  if (mergeCount >= 5) {
    patterns.push({
      pattern: 'regular_merger',
      confidence: Math.min(0.95, 0.7 + mergeCount * 0.05),
      description: `Merged ${mergeCount} pull requests`,
    });
  }

  // Pattern 2: Release manager
  const releaseCount = eventsByType['ReleaseEvent'] || 0;
  if (releaseCount >= 2) {
    patterns.push({
      pattern: 'release_manager',
      confidence: Math.min(0.9, 0.7 + releaseCount * 0.1),
      description: `Published ${releaseCount} releases`,
    });
  }

  // Pattern 3: Active triager
  const triageEvents = (eventsByType['IssuesEvent'] || 0) + (eventsByType['PullRequestEvent'] || 0);
  if (triageEvents >= 10) {
    patterns.push({
      pattern: 'active_triager',
      confidence: 0.75,
      description: `Triaged ${triageEvents} issues/PRs`,
    });
  }

  // Pattern 4: Direct committer
  const pushCount = eventsByType['PushEvent'] || 0;
  if (pushCount >= 3) {
    patterns.push({
      pattern: 'direct_committer',
      confidence: Math.min(0.9, 0.6 + pushCount * 0.1),
      description: `Direct pushes: ${pushCount}`,
    });
  }

  return patterns;
}
