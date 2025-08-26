/**
 * Simplified, testable version of ContributorCard
 * This is a pure presentational component with no external dependencies
 */
import {
  createTooltipContent,
  getCardClasses,
  getCardAccessibility,
  getAvatarFallback,
  getActivityItems,
  type TooltipContent,
} from '@/lib/contributor-card-config';
import type { MonthlyContributor } from '@/lib/types';

interface ContributorCardSimpleProps {
  contributor: MonthlyContributor;
  showRank?: boolean;
  isWinner?: boolean;
  className?: string;
  // Injected dependencies
  renderIcon?: (iconName: string, className?: string) => React.ReactNode;
  renderAvatar?: (props: {
    src: string;
    alt: string;
    fallback: string;
    className?: string;
  }) => React.ReactNode;
  renderTooltip?: (props: {
    trigger: React.ReactNode;
    content: TooltipContent;
    side?: 'top';
    className?: string;
  }) => React.ReactNode;
  renderBadge?: (props: {
    children: React.ReactNode;
    variant: 'default' | 'secondary';
    className?: string;
  }) => React.ReactNode;
  renderHoverCard?: (props: { children: React.ReactNode; contributor: unknown }) => React.ReactNode;
}

export function ContributorCardSimple({
  contributor,
  showRank = true,
  isWinner = false,
  className,
  renderIcon,
  renderAvatar,
  renderTooltip,
  renderBadge,
  renderHoverCard,
}: ContributorCardSimpleProps) {
  const { login, avatar_url, activity, rank } = contributor;

  // Get business logic values
  const tooltipContent = createTooltipContent(contributor);
  const cardClasses = getCardClasses(isWinner);
  const accessibility = getCardAccessibility(login, activity.totalScore, isWinner);
  const avatarFallback = getAvatarFallback(login);
  const activityItems = getActivityItems(activity);

  // Default renderers for testing
  const iconRenderer = renderIcon || ((name) => <span data-testid={`icon-${name}`}>{name}</span>);
  const avatarRenderer =
    renderAvatar ||
    (({ alt, fallback }) => (
      <div data-testid="avatar" title={alt}>
        {fallback}
      </div>
    ));
  const badgeRenderer =
    renderBadge ||
    (({ children, variant }) => (
      <span data-testid="badge" data-variant={variant}>
        {children}
      </span>
    ));
  const tooltipRenderer =
    renderTooltip ||
    (({ trigger, content }) => (
      <div data-testid="tooltip">
        <div data-testid="tooltip-trigger">{trigger}</div>
        <div data-testid="tooltip-content">
          <div>{content.title}</div>
          {content.items.map((item, index) => (
            <div key={index}>
              {iconRenderer(item.iconName)} {item.count} {item.label}
            </div>
          ))}
        </div>
      </div>
    ));
  const hoverCardRenderer =
    renderHoverCard || (({ children }) => <div data-testid="hover-card">{children}</div>);

  const cardContent = (
    <div
      className={`${cardClasses.container} ${className || ''}`}
      role={accessibility.role}
      aria-label={accessibility.label}
      tabIndex={0}
    >
      {/* Rank Badge */}
      {showRank && (
        <div className="absolute -top-2 -right-2 z-10">
          {badgeRenderer({
            variant: rank === 1 ? 'default' : 'secondary',
            className: 'h-6 w-6 rounded-full p-0 flex items-center justify-center',
            children: rank,
          })}
        </div>
      )}

      <div className="flex items-start gap-3">
        {hoverCardRenderer({
          contributor,
          children: avatarRenderer({
            src: `${avatar_url}?s=80`,
            alt: login,
            fallback: avatarFallback,
            className: 'h-10 w-10 cursor-pointer',
          }),
        })}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{login}</h3>
            {isWinner && (
              <span data-testid="trophy-icon" aria-label="Winner" role="img">
                {iconRenderer('Trophy', 'h-4 w-4 text-yellow-600')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            {activityItems.map((item, index) => (
              <div key={index} className="flex items-center gap-1">
                {iconRenderer(item.iconName, 'h-3 w-3')}
                <span>{item.count}</span>
              </div>
            ))}
          </div>

          <div className="mt-2">
            <span className="text-xs font-medium">Score: {activity.totalScore}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return tooltipRenderer({
    trigger: cardContent,
    content: tooltipContent,
    side: 'top',
    className: 'max-w-xs',
  });
}
