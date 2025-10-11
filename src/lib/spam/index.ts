// Export all spam detection services and types
export { SpamDetectionService } from './SpamDetectionService.ts';
export { PRAnalysisService } from './PRAnalysisService.ts';
export { AccountAnalysisService } from './AccountAnalysisService.ts';
export {
  TemplateDetector,
  COMMON_SPAM_TEMPLATES,
  SPAM_PATTERNS,
} from './templates/CommonTemplates.ts';

export type { SpamFlags, SpamDetectionResult, PullRequestData, SpamTemplate } from './types.ts';

export {
  SPAM_THRESHOLDS,
  DETECTION_WEIGHTS,
  ACCOUNT_THRESHOLDS,
  CONTENT_THRESHOLDS,
} from './types.ts';
