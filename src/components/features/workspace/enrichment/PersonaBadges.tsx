import { Badge } from '@/components/ui/badge';
import { Crown, Shield, Zap, Book, Bug, Lightbulb, Users } from '@/components/ui/icon';
import type { PersonaType } from '@/lib/llm/contributor-enrichment-types';
import { cn } from '@/lib/utils';

interface PersonaBadgesProps {
  personas: PersonaType[];
  confidence?: number;
  className?: string;
  /** Show confidence score inline */
  showConfidence?: boolean;
  /** Size variant for badges */
  size?: 'sm' | 'md';
}

/**
 * Icon mapping for each persona type
 */
const personaIcons: Record<PersonaType, typeof Crown> = {
  enterprise: Crown,
  security: Shield,
  performance: Zap,
  documentation: Book,
  bug_hunter: Bug,
  feature_requester: Lightbulb,
  community_helper: Users,
};

/**
 * Color mapping for each persona type
 */
const personaColors: Record<PersonaType, string> = {
  enterprise:
    'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  security:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  performance:
    'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
  documentation:
    'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  bug_hunter:
    'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  feature_requester:
    'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  community_helper:
    'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
};

/**
 * Human-readable labels for personas
 */
const personaLabels: Record<PersonaType, string> = {
  enterprise: 'Enterprise',
  security: 'Security',
  performance: 'Performance',
  documentation: 'Documentation',
  bug_hunter: 'Bug Hunter',
  feature_requester: 'Feature Requester',
  community_helper: 'Community Helper',
};

/**
 * Persona badge descriptions for accessibility
 */
const personaDescriptions: Record<PersonaType, string> = {
  enterprise: 'Focuses on enterprise features like SSO, corporate compliance, and scalability',
  security: 'Specializes in security vulnerabilities, authentication, and security best practices',
  performance: 'Optimizes performance through benchmarks, profiling, and efficiency improvements',
  documentation: 'Improves documentation, guides, and helps onboard new contributors',
  bug_hunter: 'Identifies and reports bugs, edge cases, and quality issues',
  feature_requester: 'Proposes new features and enhancements to improve the product',
  community_helper: 'Mentors others, answers questions, and helps build community',
};

export function PersonaBadges({
  personas,
  confidence,
  className,
  showConfidence = false,
  size = 'md',
}: PersonaBadgesProps) {
  if (!personas || personas.length === 0) {
    return null;
  }

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <div
      className={cn('flex flex-wrap gap-1.5', className)}
      role="group"
      aria-label="Contributor personas"
    >
      {personas.map((persona) => {
        const Icon = personaIcons[persona];
        const colorClass = personaColors[persona];
        const label = personaLabels[persona];
        const description = personaDescriptions[persona];

        return (
          <Badge
            key={persona}
            variant="outline"
            className={cn(
              'inline-flex items-center gap-1.5 font-medium transition-colors',
              colorClass,
              sizeClasses
            )}
            title={description}
            aria-label={`${label} persona: ${description}`}
          >
            <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
            <span>{label}</span>
          </Badge>
        );
      })}
      {showConfidence && confidence !== undefined && (
        <Badge
          variant="outline"
          className={cn(
            'inline-flex items-center gap-1 font-medium bg-muted text-muted-foreground border-muted-foreground/20',
            sizeClasses
          )}
          title="Confidence score for persona detection"
          aria-label={`Confidence: ${Math.round(confidence * 100)}%`}
        >
          {Math.round(confidence * 100)}% confident
        </Badge>
      )}
    </div>
  );
}
