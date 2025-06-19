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
import { RepositoryHealthCore } from "@/components/insights/sections/repository-health-core";
import { LotteryFactorContent } from "./lottery-factor";
import { RepoStatsContext } from "@/lib/repo-stats-context";

export function RepositoryHealthCard() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const { stats, lotteryFactor, directCommitsData, includeBots } =
    useContext(RepoStatsContext);

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
          Analyze the distribution of contributions and maintainer activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lottery Factor Content - Left Side */}
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

          {/* Repository Health Score and Factors - Right Side */}
          <div>
            <RepositoryHealthCore stats={stats} timeRange={timeRange} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
