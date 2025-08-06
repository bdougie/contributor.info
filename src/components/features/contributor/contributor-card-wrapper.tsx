/**
 * Production wrapper for ContributorCard
 * Connects the simple component to real dependencies
 */
import { useMemo, useContext } from "react";
import { ContributorCardSimple } from "./contributor-card-simple";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ContributorHoverCard } from "./contributor-hover-card";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { createContributorStats } from "@/lib/contributor-utils";
import { GitPullRequest, MessageSquare, GitPullRequestDraft, Trophy } from "lucide-react";
import type { MonthlyContributor } from "@/lib/types";

interface ContributorCardProps {
  contributor: MonthlyContributor;
  showRank?: boolean;
  isWinner?: boolean;
  className?: string;
}

const iconMap = {
  GitPullRequest,
  GitPullRequestDraft,
  MessageSquare,
  Trophy,
};

export function ContributorCard(props: ContributorCardProps) {
  const { stats } = useContext(RepoStatsContext);
  const { contributor } = props;

  // Create contributor data for hover card
  const contributorData = useMemo(() => {
    return createContributorStats(
      stats.pullRequests,
      contributor.login,
      contributor.avatar_url,
      contributor.login // using login as ID since we don't have the actual ID
    );
  }, [contributor.login, contributor.avatar_url, stats.pullRequests]);

  const renderIcon = (iconName: string, className?: string) => {
    const IconComponent = iconMap[iconName as keyof typeof iconMap];
    if (!IconComponent) return <span>{iconName}</span>;
    return <IconComponent className={className} />;
  };

  const renderAvatar = ({ src, alt, fallback, className }: any) => (
    <Avatar className={className}>
      <AvatarImage 
        src={src}
        alt={alt}
        loading="lazy"
        width={40}
        height={40}
      />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );

  const renderTooltip = ({ trigger, content, side, className }: any) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {trigger}
        </TooltipTrigger>
        <TooltipContent side={side} className={className}>
          <div className="space-y-1">
            <div className="font-medium">{content.title}</div>
            <div className="text-xs space-y-1">
              {content.items.map((item: any, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  {renderIcon(item.iconName, "h-3 w-3")}
                  <span>{item.count} {item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const renderBadge = ({ children, variant, className }: any) => (
    <Badge variant={variant} className={className}>
      {children}
    </Badge>
  );

  const renderHoverCard = ({ children }: any) => (
    <ContributorHoverCard contributor={contributorData}>
      {children}
    </ContributorHoverCard>
  );

  return (
    <ContributorCardSimple
      {...props}
      renderIcon={renderIcon}
      renderAvatar={renderAvatar}
      renderTooltip={renderTooltip}
      renderBadge={renderBadge}
      renderHoverCard={renderHoverCard}
    />
  );
}