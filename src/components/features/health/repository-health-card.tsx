import { useParams } from "react-router-dom";
import { useContext, useState, useEffect, useRef } from "react";
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
import { Bot } from "lucide-react";
import { useTimeRangeStore } from "@/lib/time-range-store";
import { RepositoryHealthOverall } from "@/components/insights/sections/repository-health-overall";
import { RepositoryHealthFactors } from "@/components/insights/sections/repository-health-factors";
import { LotteryFactorContent } from "./lottery-factor";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { SelfSelectionRate } from "@/components/features/contributor/self-selection-rate";
import { useAutoTrackRepository } from "@/hooks/use-auto-track-repository";
import { ContributorConfidenceCard } from "./contributor-confidence-card";

export function RepositoryHealthCard() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const { stats, lotteryFactor, directCommitsData, includeBots } =
    useContext(RepoStatsContext);

  // Auto-track repository when user visits it
  useAutoTrackRepository({
    owner: owner || '',
    repo: repo || '',
    enabled: !!(owner && repo)
  });

  // Local state for bot toggle to avoid page refresh
  const [localIncludeBots, setLocalIncludeBots] = useState(includeBots);
  const functionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Sync local state with context when it changes
  useEffect(() => {
    setLocalIncludeBots(includeBots);
  }, [includeBots]);

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
    <Card>
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
                confidenceScore={75} // TODO: Replace with actual calculation
                className="w-full"
                onLearnMoreClick={() => {
                  // TODO: Implement learn more functionality
                  console.log("Learn more clicked");
                }}
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
