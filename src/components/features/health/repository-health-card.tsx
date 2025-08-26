import { useParams } from "react-router-dom";
import { useContext, useState, useEffect, useRef } from "react"
import { Bot } from '@/components/ui/icon';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTimeRangeStore } from "@/lib/time-range-store";
import { RepositoryHealthOverall } from "@/components/insights/sections/repository-health-overall";
import { RepositoryHealthFactors } from "@/components/insights/sections/repository-health-factors";
import { LotteryFactorContent } from "./lottery-factor";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { SelfSelectionRate } from "@/components/features/contributor/self-selection-rate";
import { ContributorConfidenceCard } from "./contributor-confidence-card";
import { calculateRepositoryConfidence, ConfidenceBreakdown } from "@/lib/insights/health-metrics";
import { useOnDemandSync } from "@/hooks/use-on-demand-sync";

export function RepositoryHealthCard() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const { stats, lotteryFactor, directCommitsData, includeBots } =
    useContext(RepoStatsContext);


  // Local state for bot toggle to avoid page refresh
  const [localIncludeBots, setLocalIncludeBots] = useState(includeBots);
  const functionTimeout = useRef<NodeJS.Timeout | null>(null);

  // State for contributor confidence calculation
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [confidenceLoading, setConfidenceLoading] = useState(false);
  const [confidenceError, setConfidenceError] = useState<string | null>(null);
  const [confidenceBreakdown, setConfidenceBreakdown] = useState<ConfidenceBreakdown['breakdown'] | undefined>(undefined);

  // Sync status for confidence calculation
  const { syncStatus: confidenceSyncStatus } = useOnDemandSync({
    owner: owner || '',
    repo: repo || '',
    enabled: !!(owner && repo),
    autoTriggerOnEmpty: false
  });

  // Sync local state with context when it changes
  useEffect(() => {
    setLocalIncludeBots(includeBots);
  }, [includeBots]);

  // Calculate contributor confidence using the same algorithm as admin dashboard
  const calculateConfidence = async (forceRecalculate: boolean = false) => {
    if (!owner || !repo) return;
    
    setConfidenceLoading(true);
    setConfidenceError(null);
    
    try {
      // Import supabase here to avoid circular dependencies
      const { supabase } = await import('@/lib/supabase');
      
      // Use the same function as the admin dashboard
      const { data, error: _error } = await supabase
        .rpc('get_repository_confidence_summary_simple')
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .maybeSingle();

      if (_error) throw error;
      
      if (data && (_data as any).avg_confidence_score !== null) {
        setConfidenceScore(Number((_data as any).avg_confidence_score));
        // Create a basic breakdown for tooltip compatibility
        setConfidenceBreakdown({
          starForkConfidence: Number((_data as any).avg_confidence_score) * 0.35,
          engagementConfidence: Number((_data as any).avg_confidence_score) * 0.25,
          retentionConfidence: Number((_data as any).avg_confidence_score) * 0.25,
          qualityConfidence: Number((_data as any).avg_confidence_score) * 0.15,
          totalStargazers: 0,
          totalForkers: 0,
          contributorCount: (_data as any).contributor_count || 0,
          conversionRate: Number((_data as any).avg_confidence_score)
        });
      } else {
        // Fallback to the original algorithm if no data in the new system
        const result = await calculateRepositoryConfidence(
          owner, 
          repo, 
          timeRange, 
          forceRecalculate, 
          false, // returnMetadata
          true   // returnBreakdown
        ) as ConfidenceBreakdown;
        
        setConfidenceScore(result.score);
        setConfidenceBreakdown(result.breakdown);
      }
    } catch (_error) {
      console.error('Failed to calculate contributor confidence:', _error);
      setConfidenceError('Repository _data not available. This repository may need to be synced first.');
      setConfidenceScore(null);
      setConfidenceBreakdown(undefined);
    } finally {
      setConfidenceLoading(false);
    }
  };

  // Calculate confidence when component mounts or params change
  useEffect(() => {
    calculateConfidence();
  }, [owner, repo, timeRange]);

  // Reset confidence score when sync starts, recalculate when sync completes
  useEffect(() => {
    if (confidenceSyncStatus.isTriggering || confidenceSyncStatus.isInProgress) {
      // Clear the score to show skeleton while syncing
      setConfidenceScore(null);
      setConfidenceError(null);
    } else if (confidenceSyncStatus.isComplete) {
      // Recalculate confidence after sync completes
      calculateConfidence();
    }
  }, [confidenceSyncStatus.isTriggering, confidenceSyncStatus.isInProgress, confidenceSyncStatus.isComplete]);

  const botCount = stats.pullRequests.filter(
    (pr) => pr.user.type === "Bot"
  ).length;
  const hasBots = botCount > 0;
  // YOLO Coders button should only be visible if there are YOLO pushes
  const showYoloButton = directCommitsData?.hasYoloCoders === true;

  const handleToggleIncludeBots = () => {
    if (functionTimeout.current) {
      clearTimeout(functionTimeout.current);
    }
    functionTimeout.current = setTimeout(() => {
      setLocalIncludeBots(!localIncludeBots);
      // We're not calling setIncludeBots anymore to avoid triggering a global state update
    }, 50);
  };

  if (!owner || !repo) {
    return null;
  }

  return (
    <Card className="health-metrics-container">
      <CardHeader>
        <CardTitle>Repository Health</CardTitle>
        <CardDescription>
          Analyze the distribution of contributions, self-selection rates, and maintainer activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Top Row - Overall Health Score (full width) */}
          <RepositoryHealthOverall stats={stats} timeRange={timeRange} />

          {/* Bottom Row - Two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Lottery Factor */}
            <Card>
              <CardContent className="p-6">
                <LotteryFactorContent
                  stats={stats}
                  lotteryFactor={lotteryFactor}
                  showYoloButton={showYoloButton}
                  includeBots={localIncludeBots}
                />

                {hasBots && (
                  <div className="flex items-center space-x-2 mt-6 pt-4 border-t">
                    <Switch
                      id="show-bots"
                      checked={localIncludeBots}
                      onCheckedChange={handleToggleIncludeBots}
                    />
                    <Label
                      htmlFor="show-bots"
                      className="flex items-center gap-1 cursor-pointer"
                    >
                      <Bot className="h-4 w-4" />
                      Show bots
                      {botCount > 0 && (
                        <Badge variant="outline" className="ml-1">
                          {botCount}
                        </Badge>
                      )}
                    </Label>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Column - Contributor Confidence (top), Health Factors (middle), Self-Selection Rate (bottom) */}
            <div className="space-y-6">
              {/* Contributor Confidence - Top */}
              <ContributorConfidenceCard
                confidenceScore={confidenceScore}
                loading={confidenceLoading || confidenceSyncStatus.isTriggering || confidenceSyncStatus.isInProgress}
                error={confidenceError}
                className="w-full"
                owner={owner}
                repo={repo}
                breakdown={confidenceBreakdown}
                onRefresh={() => calculateConfidence(true)}
              />
              
              {/* Health Factors - Middle */}
              <RepositoryHealthFactors 
                stats={stats} 
                timeRange={timeRange} 
                repositoryName={`${owner}/${repo}`}
              />
              
              {/* Self-Selection Rate - Bottom */}
              <SelfSelectionRate 
                owner={owner} 
                repo={repo}
                daysBack={Number(timeRange)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
