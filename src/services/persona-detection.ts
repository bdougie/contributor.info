/**
 * Persona Detection Service
 *
 * Analyzes real contributor activity patterns to detect personas
 * Uses heuristics based on contribution types, keywords, and behavior
 */

import { supabase } from '@/lib/supabase';
import type {
  PersonaType,
  ContributorPersona,
  ContributionStyle,
  EngagementPattern,
} from '@/lib/llm/contributor-enrichment-types';

/**
 * Activity patterns used for persona detection
 */
interface ActivityPattern {
  pullRequests: number;
  issues: number;
  reviews: number;
  discussions: number;
  comments: number;

  // Keyword presence in titles/descriptions
  securityKeywords: number;
  performanceKeywords: number;
  documentationKeywords: number;
  bugKeywords: number;
  featureKeywords: number;
  enterpriseKeywords: number;

  // Behavioral indicators
  helpfulComments: number; // Comments on others' issues/discussions
  questionsAnswered: number; // Answered discussions
  avgIssueLength: number; // Detailed issue reporting
}

/**
 * Keywords for persona detection
 */
const PERSONA_KEYWORDS = {
  enterprise: [
    'sso',
    'saml',
    'oauth',
    'ldap',
    'enterprise',
    'corporate',
    'compliance',
    'audit',
    'rbac',
    'permissions',
    'roles',
    'tenant',
    'organization',
  ],
  security: [
    'security',
    'vulnerability',
    'cve',
    'xss',
    'csrf',
    'sql injection',
    'authentication',
    'authorization',
    'jwt',
    'token',
    'encryption',
    'https',
    'sanitize',
    'validate',
    'exploit',
    'attack',
  ],
  performance: [
    'performance',
    'optimization',
    'optimize',
    'slow',
    'fast',
    'benchmark',
    'cache',
    'memory',
    'cpu',
    'latency',
    'throughput',
    'scalability',
    'profiling',
    'bottleneck',
    'speed',
  ],
  documentation: [
    'documentation',
    'docs',
    'readme',
    'guide',
    'tutorial',
    'example',
    'comment',
    'docstring',
    'api docs',
    'contributing',
    'getting started',
  ],
  bug_hunter: [
    'bug',
    'fix',
    'issue',
    'error',
    'crash',
    'broken',
    'not working',
    'regression',
    'edge case',
    'reproduce',
    'unexpected',
    'incorrect',
  ],
  feature_requester: [
    'feature',
    'enhancement',
    'request',
    'proposal',
    'idea',
    'suggest',
    'would be nice',
    'could we',
    'ability to',
    'add support',
  ],
};

/**
 * Fetch contributor activity data for persona analysis
 */
async function fetchActivityPatterns(
  contributorId: string,
  workspaceId: string
): Promise<ActivityPattern> {
  // Get workspace repositories
  const { data: workspaceRepos } = await supabase
    .from('workspace_repositories')
    .select('repository_id')
    .eq('workspace_id', workspaceId);

  const repoIds = workspaceRepos?.map((r) => r.repository_id) || [];

  if (repoIds.length === 0) {
    return createEmptyPattern();
  }

  // Fetch activity in last 90 days for better pattern detection
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Fetch all activity types
  const [pullRequests, issues, reviews, discussions, issueComments, discussionComments] =
    await Promise.all([
      // Pull requests
      supabase
        .from('pull_requests')
        .select('id, title, body')
        .eq('author_id', contributorId)
        .in('repository_id', repoIds)
        .gte('created_at', ninetyDaysAgo.toISOString()),

      // Issues
      supabase
        .from('issues')
        .select('id, title, body')
        .eq('author_id', contributorId)
        .in('repository_id', repoIds)
        .gte('created_at', ninetyDaysAgo.toISOString()),

      // Reviews
      supabase
        .from('reviews')
        .select('id, pull_requests!inner(repository_id)')
        .eq('reviewer_id', contributorId)
        .in('pull_requests.repository_id', repoIds)
        .gte('submitted_at', ninetyDaysAgo.toISOString()),

      // Discussions
      supabase
        .from('discussions')
        .select('id, title, body, is_answered')
        .eq('author_id', contributorId)
        .in('repository_id', repoIds)
        .gte('created_at', ninetyDaysAgo.toISOString()),

      // Comments on issues
      supabase
        .from('comments')
        .select('id, body, issues!inner(author_id, repository_id)')
        .eq('commenter_id', contributorId)
        .in('issues.repository_id', repoIds)
        .gte('created_at', ninetyDaysAgo.toISOString()),

      // Comments on discussions
      supabase
        .from('discussion_comments')
        .select('id, body, discussions!inner(author_id, repository_id)')
        .eq('author_id', contributorId)
        .in('discussions.repository_id', repoIds)
        .gte('created_at', ninetyDaysAgo.toISOString()),
    ]);

  // Count activities
  const prCount = pullRequests.data?.length || 0;
  const issueCount = issues.data?.length || 0;
  const reviewCount = reviews.data?.length || 0;
  const discussionCount = discussions.data?.length || 0;
  const issueCommentCount = issueComments.data?.length || 0;
  const discussionCommentCount = discussionComments.data?.length || 0;

  // Analyze text content for keywords
  const allText = [
    ...(pullRequests.data?.map((pr) => `${pr.title} ${pr.body || ''}`) || []),
    ...(issues.data?.map((i) => `${i.title} ${i.body || ''}`) || []),
    ...(discussions.data?.map((d) => `${d.title} ${d.body || ''}`) || []),
  ]
    .join(' ')
    .toLowerCase();

  // Count keyword occurrences
  const securityKeywords = countKeywords(allText, PERSONA_KEYWORDS.security);
  const performanceKeywords = countKeywords(allText, PERSONA_KEYWORDS.performance);
  const documentationKeywords = countKeywords(allText, PERSONA_KEYWORDS.documentation);
  const bugKeywords = countKeywords(allText, PERSONA_KEYWORDS.bug_hunter);
  const featureKeywords = countKeywords(allText, PERSONA_KEYWORDS.feature_requester);
  const enterpriseKeywords = countKeywords(allText, PERSONA_KEYWORDS.enterprise);

  // Behavioral indicators
  const helpfulComments =
    (issueComments.data?.filter((c) => {
      // Comments on others' issues (not their own)
      if (Array.isArray(c.issues)) {
        return c.issues.some((issue: { author_id: string }) => issue.author_id !== contributorId);
      }
      return (c.issues as { author_id: string })?.author_id !== contributorId;
    }).length || 0) +
    (discussionComments.data?.filter((c) => {
      // Comments on others' discussions
      if (Array.isArray(c.discussions)) {
        return c.discussions.some((d: { author_id: string }) => d.author_id !== contributorId);
      }
      return (c.discussions as { author_id: string })?.author_id !== contributorId;
    }).length || 0);

  const questionsAnswered = discussions.data?.filter((d) => d.is_answered).length || 0;

  // Average issue length (detailed reporters write longer issues)
  const totalIssueLength =
    issues.data?.reduce((sum, issue) => sum + (issue.body?.length || 0), 0) || 0;
  const avgIssueLength = issueCount > 0 ? totalIssueLength / issueCount : 0;

  return {
    pullRequests: prCount,
    issues: issueCount,
    reviews: reviewCount,
    discussions: discussionCount,
    comments: issueCommentCount + discussionCommentCount,
    securityKeywords,
    performanceKeywords,
    documentationKeywords,
    bugKeywords,
    featureKeywords,
    enterpriseKeywords,
    helpfulComments,
    questionsAnswered,
    avgIssueLength,
  };
}

/**
 * Count keyword occurrences in text
 */
function countKeywords(text: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => {
    const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    const matches = text.match(regex);
    return count + (matches?.length || 0);
  }, 0);
}

/**
 * Create empty activity pattern
 */
function createEmptyPattern(): ActivityPattern {
  return {
    pullRequests: 0,
    issues: 0,
    reviews: 0,
    discussions: 0,
    comments: 0,
    securityKeywords: 0,
    performanceKeywords: 0,
    documentationKeywords: 0,
    bugKeywords: 0,
    featureKeywords: 0,
    enterpriseKeywords: 0,
    helpfulComments: 0,
    questionsAnswered: 0,
    avgIssueLength: 0,
  };
}

/**
 * Detect personas based on activity patterns
 */
function detectPersonas(pattern: ActivityPattern): PersonaType[] {
  const scores = new Map<PersonaType, number>();

  // Enterprise persona: high enterprise keywords, often combined with auth/security
  const enterpriseScore =
    pattern.enterpriseKeywords * 3 +
    (pattern.securityKeywords > 0 ? pattern.enterpriseKeywords * 2 : 0);
  if (enterpriseScore > 5) {
    scores.set('enterprise', enterpriseScore);
  }

  // Security persona: security keywords + detailed issues
  const securityScore =
    pattern.securityKeywords * 3 +
    (pattern.avgIssueLength > 200 ? 5 : 0) +
    (pattern.issues > 5 ? 5 : 0);
  if (securityScore > 10) {
    scores.set('security', securityScore);
  }

  // Performance persona: performance keywords + PRs
  const performanceScore = pattern.performanceKeywords * 3 + (pattern.pullRequests > 3 ? 5 : 0);
  if (performanceScore > 8) {
    scores.set('performance', performanceScore);
  }

  // Documentation persona: doc keywords + doc PRs
  const documentationScore = pattern.documentationKeywords * 3 + (pattern.pullRequests > 0 ? 5 : 0);
  if (documentationScore > 8) {
    scores.set('documentation', documentationScore);
  }

  // Bug hunter: high bug keywords + issues
  const bugHunterScore =
    pattern.bugKeywords * 2 +
    (pattern.issues > 5 ? 10 : 0) +
    (pattern.avgIssueLength > 150 ? 5 : 0); // Detailed bug reports
  if (bugHunterScore > 10) {
    scores.set('bug_hunter', bugHunterScore);
  }

  // Feature requester: feature keywords + issues (but not many PRs)
  const featureRequesterScore =
    pattern.featureKeywords * 3 + (pattern.issues > 3 ? 5 : 0) + (pattern.pullRequests < 2 ? 5 : 0); // More ideas than code
  if (featureRequesterScore > 10) {
    scores.set('feature_requester', featureRequesterScore);
  }

  // Community helper: helpful comments + answered discussions
  const communityHelperScore =
    pattern.helpfulComments * 2 + pattern.questionsAnswered * 3 + (pattern.discussions > 5 ? 5 : 0);
  if (communityHelperScore > 15) {
    scores.set('community_helper', communityHelperScore);
  }

  // Return top 2 personas
  const sortedPersonas = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([persona]) => persona);

  return sortedPersonas;
}

/**
 * Determine contribution style
 */
function determineContributionStyle(pattern: ActivityPattern): ContributionStyle {
  const codeActivity = pattern.pullRequests + pattern.reviews;
  const discussionActivity = pattern.issues + pattern.discussions + pattern.comments;

  if (codeActivity > discussionActivity * 2) {
    return 'code';
  } else if (discussionActivity > codeActivity * 2) {
    return 'discussion';
  }
  return 'mixed';
}

/**
 * Determine engagement pattern
 */
function determineEngagementPattern(pattern: ActivityPattern): EngagementPattern {
  const totalActivity =
    pattern.pullRequests +
    pattern.issues +
    pattern.reviews +
    pattern.discussions +
    pattern.comments;

  // Mentor: lots of helpful comments and answered questions
  if (pattern.helpfulComments > 10 || pattern.questionsAnswered > 5) {
    return 'mentor';
  }

  // Builder: primarily PRs
  if (pattern.pullRequests > totalActivity * 0.5) {
    return 'builder';
  }

  // Reporter: primarily issues and bugs
  if (pattern.issues > totalActivity * 0.4) {
    return 'reporter';
  }

  // Learner: lots of questions and comments
  return 'learner';
}

/**
 * Calculate detection confidence
 */
function calculateConfidence(pattern: ActivityPattern, personas: PersonaType[]): number {
  const totalActivity =
    pattern.pullRequests +
    pattern.issues +
    pattern.reviews +
    pattern.discussions +
    pattern.comments;

  // More activity = higher confidence
  const activityConfidence = Math.min(totalActivity / 20, 1); // Cap at 20 activities

  // Having clear personas = higher confidence
  const personaConfidence = personas.length > 0 ? 0.8 : 0.4;

  return activityConfidence * 0.6 + personaConfidence * 0.4;
}

/**
 * Extract expertise areas from activity
 */
function extractExpertise(pattern: ActivityPattern): string[] {
  const expertise: string[] = [];

  if (pattern.enterpriseKeywords > 3) {
    expertise.push('Enterprise Features', 'SSO/Authentication');
  }
  if (pattern.securityKeywords > 5) {
    expertise.push('Security', 'Vulnerability Assessment');
  }
  if (pattern.performanceKeywords > 5) {
    expertise.push('Performance Optimization', 'Benchmarking');
  }
  if (pattern.documentationKeywords > 5) {
    expertise.push('Technical Writing', 'Documentation');
  }
  if (pattern.bugKeywords > 10) {
    expertise.push('Bug Detection', 'Quality Assurance');
  }
  if (pattern.featureKeywords > 5) {
    expertise.push('Product Design', 'Feature Planning');
  }

  return expertise;
}

/**
 * Detect contributor persona from real activity data
 */
export async function detectContributorPersona(
  contributorId: string,
  workspaceId: string
): Promise<ContributorPersona> {
  // Fetch activity patterns
  const pattern = await fetchActivityPatterns(contributorId, workspaceId);

  // Detect personas
  const personas = detectPersonas(pattern);

  // Determine contribution style and engagement
  const contributionStyle = determineContributionStyle(pattern);
  const engagementPattern = determineEngagementPattern(pattern);

  // Calculate confidence
  const confidence = calculateConfidence(pattern, personas);

  // Extract expertise
  const expertise = extractExpertise(pattern);

  return {
    type: personas,
    confidence,
    expertise,
    contributionStyle,
    engagementPattern,
  };
}

/**
 * Update contributor persona in database
 */
export async function updateContributorPersona(
  contributorId: string,
  workspaceId: string
): Promise<void> {
  try {
    const persona = await detectContributorPersona(contributorId, workspaceId);

    // Update contributors table
    const { error: updateError } = await supabase
      .from('contributors')
      .update({
        detected_persona: persona.type,
        persona_confidence: persona.confidence,
        expertise_areas: persona.expertise,
        contribution_style: persona.contributionStyle,
        engagement_pattern_type: persona.engagementPattern,
      })
      .eq('id', contributorId);

    if (updateError) {
      console.error('Error updating contributor persona:', updateError);
      throw updateError;
    }

    // Also update contributor_analytics
    const { error: analyticsError } = await supabase.from('contributor_analytics').upsert(
      {
        contributor_id: contributorId,
        workspace_id: workspaceId,
        snapshot_date: new Date().toISOString().split('T')[0],
        detected_persona: persona.type,
        persona_confidence: persona.confidence,
        contribution_style: persona.contributionStyle,
        engagement_pattern_type: persona.engagementPattern,
      },
      {
        onConflict: 'contributor_id,workspace_id,snapshot_date',
      }
    );

    if (analyticsError) {
      console.error('Error updating persona analytics:', analyticsError);
    }
  } catch (error) {
    console.error('Error in updateContributorPersona:', error);
    throw error;
  }
}
