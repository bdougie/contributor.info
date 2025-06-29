// Export all spam detection services and types
export { SpamDetectionService } from './SpamDetectionService';
export { PRAnalysisService } from './PRAnalysisService';
export { AccountAnalysisService } from './AccountAnalysisService';
export { TemplateDetector, COMMON_SPAM_TEMPLATES, SPAM_PATTERNS } from './templates/CommonTemplates';

export type {
  SpamFlags,
  SpamDetectionResult,
  PullRequestData,
  SpamTemplate,
} from './types';

export {
  SPAM_THRESHOLDS,
  DETECTION_WEIGHTS,
  ACCOUNT_THRESHOLDS,
  CONTENT_THRESHOLDS,
} from './types';