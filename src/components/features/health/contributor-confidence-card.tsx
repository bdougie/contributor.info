import { useState, memo, useMemo, useCallback } from "react";
import { UserPlus, RefreshCw, Database, LogIn, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnDemandSync } from "@/hooks/use-on-demand-sync";
import { useGitHubAuth } from "@/hooks/use-github-auth";
import { ConfidenceBreakdownTooltip } from "./confidence-breakdown-tooltip";
import { ContributorConfidenceLearnMore } from "./contributor-confidence-learn-more";
import { ConfidenceSkeleton } from "./confidence-skeleton";

// Semicircle progress component that grows from left to right
const SemicircleProgress = memo(function SemicircleProgress({ value }: { value: number }) {
  // Scale the 0-50% score to 0-100% for semicircle display
  const scaledValue = (value / 50) * 100;
  const normalizedValue = Math.min(Math.max(scaledValue, 0), 100);
  
  // Color based on confidence level  
  const getProgressColor = (value: number) => {
    if (value <= 5) return "#FB3748"; // Red
    if (value <= 15) return "#FFA500"; // Orange
    if (value <= 35) return "#0EA5E9"; // Blue
    return "#00C851"; // Green
  };

  // Generate progress path that grows from left to right
  const getProgressPath = (percentage: number) => {
    if (percentage <= 0) return "";
    
    if (percentage >= 100) {
      // Full semicircle - complete path from left to right
      return "M0 49C0 36.0044 5.16249 23.541 14.3518 14.3518C23.5411 5.16248 36.0044 0 49 0C61.9956 0 74.459 5.16249 83.6482 14.3518C92.8375 23.5411 98 36.0044 98 49H90.16C90.16 38.0837 85.8235 27.6145 78.1045 19.8955C70.3855 12.1765 59.9163 7.84 49 7.84C38.0837 7.84 27.6145 12.1765 19.8955 19.8955C12.1765 27.6145 7.84 38.0837 7.84 49H0Z";
    }
    
    // Calculate the angle for the percentage - start from left (π) and move to right (0)
    const angleRadians = Math.PI - (percentage / 100) * Math.PI;
    
    // Outer arc points (radius = 49, center at 49,49)
    const outerStartX = 0;  // Left edge
    const outerStartY = 49; // Center height
    const outerEndX = 49 + 49 * Math.cos(angleRadians);
    const outerEndY = 49 - 49 * Math.sin(angleRadians);
    
    // Inner arc points (radius = 41.16, center at 49,49)
    const innerStartX = 7.84;  // Left edge of inner circle
    const innerStartY = 49;    // Center height
    const innerEndX = 49 + 41.16 * Math.cos(angleRadians);
    const innerEndY = 49 - 41.16 * Math.sin(angleRadians);
    
    // Determine if we need the large arc flag
    const largeArcFlag = percentage > 50 ? 1 : 0;
    
    // Build the path: outer arc from left to calculated point, then inner arc back
    let path = `M${outerStartX} ${outerStartY}`; // Move to outer start (left edge)
    path += ` A49 49 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY}`; // Outer arc clockwise
    path += ` L${innerEndX} ${innerEndY}`; // Line to inner arc end
    path += ` A41.16 41.16 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY}`; // Inner arc counter-clockwise
    path += ` Z`; // Close path
    
    return path;
  };

  return (
    <path
      d={getProgressPath(normalizedValue)}
      fill={getProgressColor(normalizedValue)}
    />
  );
});

export interface ContributorConfidenceCardProps {
  confidenceScore: number | null; // 0-100 or null when no data
  loading?: boolean;
  error?: string | null;
  className?: string;
  owner?: string;
  repo?: string;
  onRefresh?: () => void;
  breakdown?: {
    starForkConfidence: number;
    engagementConfidence: number;
    retentionConfidence: number;
    qualityConfidence: number;
    totalStargazers: number;
    totalForkers: number;
    contributorCount: number;
    conversionRate: number;
  };
}

interface ConfidenceLevel {
  level: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  color: string;
}

function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score <= 5) {
    return {
      level: 'low',
      title: 'Your project can be Intimidating',
      description: 'Almost no stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-red-600'
    };
  } else if (score <= 15) {
    return {
      level: 'medium', 
      title: 'Your project is challenging',
      description: 'Few stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-orange-600'
    };
  } else if (score <= 35) {
    return {
      level: 'medium', 
      title: 'Your project is approachable!',
      description: 'Some stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-blue-600'
    };
  } else {
    return {
      level: 'high',
      title: 'Your project is welcoming!',
      description: 'Many stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-green-600'
    };
  }
}

export const ContributorConfidenceCard = memo(function ContributorConfidenceCard({
  confidenceScore,
  loading = false,
  error = null,
  className,
  owner,
  repo,
  onRefresh,
  breakdown,
}: ContributorConfidenceCardProps) {
  // Local state for Learn More modal
  const [showLearnMore, setShowLearnMore] = useState(false);

  // Authentication hook
  const { isLoggedIn, login } = useGitHubAuth();

  // On-demand sync hook
  const { hasData, syncStatus, triggerSync } = useOnDemandSync({
    owner: owner || '',
    repo: repo || '',
    enabled: !!(owner && repo),
    autoTriggerOnEmpty: false // Don't auto-trigger, let user decide
  });

  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    }
    triggerSync();
  }, [onRefresh, triggerSync]);

  // Move useMemo to top level to ensure it's called on every render
  const confidence = useMemo(() => getConfidenceLevel(confidenceScore ?? 0), [confidenceScore]);
  // Show skeleton loading state when calculating or when sync is in progress
  if (loading || syncStatus.isTriggering || syncStatus.isInProgress) {
    const message = syncStatus.isTriggering || syncStatus.isInProgress ? 'Syncing data...' : 'Calculating...';
    return <ConfidenceSkeleton className={className} message={message} />;
  }

  if (error || (confidenceScore === null && !loading && !syncStatus.isTriggering && !syncStatus.isInProgress)) {
    return (
      <Card className={cn("w-full overflow-hidden", className)}>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 w-full">
            <div className="flex items-center gap-2 py-1 flex-1">
              <UserPlus className="w-[18px] h-[18px]" />
              <div className="font-semibold text-foreground text-sm whitespace-nowrap">
                Contributor Confidence
              </div>
              <button
                onClick={() => setShowLearnMore(true)}
                className="ml-auto font-medium text-opensauced-orange text-xs whitespace-nowrap hover:underline"
              >
                Learn More
              </button>
            </div>
          </div>
          <div className="flex items-start gap-4 w-full">
            <div className="relative w-[98px] h-[52px]">
              <div className="relative h-[98px] mb-[46px]">
                <div className="absolute w-[98px] h-[98px] top-0 left-0">
                  <div className="relative h-[49px]">
                    {/* Background semicircle */}
                    <svg
                      width="98"
                      height="49"
                      viewBox="0 0 98 49"
                      className="absolute top-0 left-0"
                    >
                      <path
                        d="M98 49C98 36.0044 92.8375 23.5411 83.6482 14.3518C74.459 5.16249 61.9956 9.81141e-07 49 0C36.0044 -9.81141e-07 23.5411 5.16248 14.3518 14.3518C5.16249 23.541 1.96228e-06 36.0044 0 49H7.84C7.84 38.0837 12.1765 27.6145 19.8955 19.8955C27.6145 12.1765 38.0837 7.84 49 7.84C59.9163 7.84 70.3855 12.1765 78.1045 19.8955C85.8235 27.6145 90.16 38.0837 90.16 49H98Z"
                        className="fill-muted"
                      />
                    </svg>
                  </div>
                </div>
                <div className="absolute w-14 top-7 left-[21px] font-normal text-muted-foreground text-[28px] text-center leading-5">
                  <span className="font-bold tracking-[-0.05px]">--</span>
                  <span className="font-bold text-xs tracking-[-0.01px]">%</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start gap-1 flex-1">
              <div className="font-semibold text-muted-foreground text-xs leading-4">
                Data not available
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                {error}
              </div>
              
              {/* Authentication and sync trigger */}
              {hasData === false && !syncStatus.error && (
                <div className="flex flex-col items-start gap-2 pt-2 mt-2 border-t w-full">
                  {!isLoggedIn ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Log in with GitHub to analyze this repository's contributor data.
                      </p>
                      <Button 
                        onClick={login}
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-1 h-7 px-2 text-xs"
                      >
                        <LogIn className="h-3 w-3" />
                        Log in
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        This repository hasn't been analyzed yet.
                      </p>
                      <Button 
                        onClick={triggerSync}
                        variant="outline" 
                        size="sm"
                        disabled={syncStatus.isTriggering || syncStatus.isInProgress}
                        className="flex items-center gap-1 h-7 px-2 text-xs"
                      >
                        <Database className="h-3 w-3" />
                        Analyze Repository
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Sync error state */}
              {syncStatus.error && (
                <div className="flex flex-col items-start gap-2 pt-2 mt-2 border-t w-full">
                  <p className="text-xs text-red-500">
                    {syncStatus.error}
                  </p>
                  <Button 
                    onClick={triggerSync}
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-1 h-7 px-2 text-xs"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry Analysis
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full overflow-hidden", className)}>
      <CardContent className="p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 w-full">
          <div className="flex items-center gap-2 py-1 flex-1">
            <UserPlus className="w-[18px] h-[18px]" />
            <div className="font-semibold text-foreground text-sm whitespace-nowrap">
              Contributor Confidence
            </div>
            {breakdown && (
              <ConfidenceBreakdownTooltip breakdown={breakdown}>
                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
              </ConfidenceBreakdownTooltip>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowLearnMore(true)}
                className="font-medium text-opensauced-orange text-xs whitespace-nowrap hover:underline"
              >
                Learn More
              </button>
              <Button
                onClick={handleRefresh}
                variant="ghost"
                size="sm"
                disabled={syncStatus.isTriggering || syncStatus.isInProgress || loading}
                className="h-8 w-8 p-0"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${(syncStatus.isTriggering || syncStatus.isInProgress || loading) ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4 w-full">
          <div className="relative w-[98px] h-[52px]">
            <div className="relative h-[98px] mb-[46px]">
              <div className="absolute w-[98px] h-[98px] top-0 left-0">
                <div className="relative h-[49px]">
                  {/* Background semicircle */}
                  <svg
                    width="98"
                    height="49"
                    viewBox="0 0 98 49"
                    className="absolute top-0 left-0"
                  >
                    <path
                      d="M98 49C98 36.0044 92.8375 23.5411 83.6482 14.3518C74.459 5.16249 61.9956 9.81141e-07 49 0C36.0044 -9.81141e-07 23.5411 5.16248 14.3518 14.3518C5.16249 23.541 1.96228e-06 36.0044 0 49H7.84C7.84 38.0837 12.1765 27.6145 19.8955 19.8955C27.6145 12.1765 38.0837 7.84 49 7.84C59.9163 7.84 70.3855 12.1765 78.1045 19.8955C85.8235 27.6145 90.16 38.0837 90.16 49H98Z"
                      className="fill-muted"
                    />
                  </svg>
                  
                  {/* Progress overlay */}
                  <svg
                    width="98"
                    height="49"
                    viewBox="0 0 98 49"
                    className="absolute top-0 left-0"
                  >
                    <SemicircleProgress value={confidenceScore ?? 0} />
                  </svg>
                </div>
              </div>

              <ConfidenceBreakdownTooltip breakdown={breakdown}>
                <div className="absolute w-14 top-7 left-[21px] font-normal text-foreground text-[28px] text-center leading-5 cursor-help">
                  <span className="font-bold tracking-[-0.05px]">{Math.round(confidenceScore ?? 0)}</span>
                  <span className="font-bold text-xs tracking-[-0.01px]">%</span>
                </div>
              </ConfidenceBreakdownTooltip>
            </div>
          </div>

          <div className="flex flex-col items-start gap-1 flex-1">
            <div className="font-semibold text-muted-foreground text-xs leading-4 whitespace-nowrap">
              {confidence.title}
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              {confidence.description}
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* Learn More Modal */}
      <ContributorConfidenceLearnMore 
        open={showLearnMore} 
        onOpenChange={setShowLearnMore} 
      />
    </Card>
  );
});