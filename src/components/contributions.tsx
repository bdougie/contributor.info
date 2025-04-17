import React, { useState, useContext } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis as RechartsYAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { humanizeNumber } from "@/lib/utils";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { useTimeRange } from "@/lib/time-range-store";
import type { RepoStats } from "@/lib/types";

// Create a wrapper for YAxis that uses default parameters instead of defaultProps
const YAxis = ({
  allowDecimals = true,
  allowDataOverflow = false,
  allowDuplicatedCategory = true,
  axisLine = true,
  domain,
  dx = 0,
  dy = 0,
  hide = false,
  label,
  minTickGap = 5,
  mirror = false,
  orientation = "left",
  padding = { top: 0, bottom: 0 },
  reversed = false,
  scale = "auto",
  tickCount = 5,
  tickFormatter,
  tickLine = true,
  type = "number",
  width = 60,
  yAxisId = 0,
  ...restProps
}: React.ComponentProps<typeof RechartsYAxis>) => (
  <RechartsYAxis
    allowDecimals={allowDecimals}
    allowDataOverflow={allowDataOverflow}
    allowDuplicatedCategory={allowDuplicatedCategory}
    axisLine={axisLine}
    domain={domain}
    dx={dx}
    dy={dy}
    hide={hide}
    label={label}
    minTickGap={minTickGap}
    mirror={mirror}
    orientation={orientation}
    padding={padding}
    reversed={reversed}
    scale={scale}
    tickCount={tickCount}
    tickFormatter={tickFormatter}
    tickLine={tickLine}
    type={type}
    width={width}
    yAxisId={yAxisId}
    {...restProps}
  />
);

function ContributionsChart({
  stats,
  enhanceView,
  setEnhanceView,
}: {
  stats?: RepoStats;
  enhanceView: boolean;
  setEnhanceView: (value: boolean) => void;
}) {
  // Use default empty values if props are not provided
  const safeStats = stats || { pullRequests: [], loading: false, error: null };
  // Get the mobile-aware time range
  const { effectiveTimeRange } = useTimeRange();
  // For mobile we limit to 7 days regardless of the selected timeRange
  const isMobile = window.innerWidth < 768;
  const mobileMaxDays = 7;

  const getChartData = () => {
    // Sort by created_at and take only the last 50 PRs
    const recentPRs = [...safeStats.pullRequests]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 50);

    return recentPRs
      .map((pr, index) => {
        const daysAgo = Math.floor(
          (new Date().getTime() - new Date(pr.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        // Skip PRs older than our limit (7 days for mobile, effectiveTimeRange for desktop)
        if (
          (isMobile && daysAgo > mobileMaxDays) ||
          (!isMobile && daysAgo > parseInt(effectiveTimeRange, 10))
        ) {
          return null;
        }

        const linesChanged = pr.additions + pr.deletions;

        // Only show avatars for the first 25 PRs
        const showAvatar = index < 25;

        return {
          daysAgo,
          linesChanged: enhanceView
            ? Math.min(
                linesChanged,
                recentPRs[Math.floor(recentPRs.length * 0.25)].additions +
                  recentPRs[Math.floor(recentPRs.length * 0.25)].deletions
              )
            : linesChanged,
          avatar: showAvatar ? pr.user.avatar_url : null,
          state: pr.state,
          merged: pr.merged_at !== null,
          title: pr.title,
          number: pr.number,
          author: pr.user.login,
          repository_owner: pr.repository_owner,
          repository_name: pr.repository_name,
          url: `https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`,
        };
      })
      .filter(Boolean); // Remove null values
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center space-x-2">
        <Switch
          id="enhance-view"
          checked={enhanceView}
          onCheckedChange={setEnhanceView}
        />
        <Label htmlFor="enhance-view">Focus on smaller contributions</Label>
      </div>
      <div className="h-[600px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 10, bottom: 40, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="daysAgo"
              name="Days Ago"
              domain={[0, "auto"]}
              reversed
              label={{
                value: "Days Ago (Created Date)",
                position: "bottom",
                offset: 20,
              }}
              xAxisId="main"
            />
            <YAxis
              type="number"
              dataKey="linesChanged"
              name="Lines Changed"
              scale="log"
              domain={["auto", "auto"]}
              tickFormatter={(value) => humanizeNumber(value)}
              label={{
                value: "Lines Touched",
                angle: -90,
                position: "insideLeft",
                offset: -10,
              }}
              yAxisId="main"
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background p-4 rounded-lg shadow border">
                      <div className="flex items-center gap-2 mb-2">
                        {data.avatar && (
                          <img
                            src={data.avatar}
                            alt="User avatar"
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <a
                          href={`https://github.com/${data.repository_owner}/${data.repository_name}/pull/${data.number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary"
                        >
                          #{data.number}
                        </a>
                        <span>by</span>
                        <a
                          href={`https://github.com/${data.author}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary"
                        >
                          {data.author}
                        </a>
                      </div>
                      <p className="text-sm">{data.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {humanizeNumber(data.linesChanged)} lines changed
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {data.daysAgo} days ago
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter
              data={getChartData()}
              xAxisId="main"
              yAxisId="main"
              shape={(props: unknown) => {
                // Type assertion to handle the shape props correctly
                const { cx, cy, payload } = props as {
                  cx: number;
                  cy: number;
                  payload: Record<string, unknown>;
                };
                return (
                  <a
                    href={payload.url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer"
                  >
                    {payload.avatar ? (
                      <image
                        x={cx - 10}
                        y={cy - 10}
                        width={20}
                        height={20}
                        href={payload.avatar as string}
                        clipPath="circle(50%)"
                        style={{ cursor: "pointer" }}
                      />
                    ) : (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill="hsl(var(--muted-foreground))"
                        opacity={0.5}
                        style={{ cursor: "pointer" }}
                      />
                    )}
                  </a>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Contributions Tab Component
export default function Contributions() {
  const { stats } = useContext(RepoStatsContext);
  const { effectiveTimeRange } = useTimeRange();
  const effectiveTimeRangeNumber = parseInt(effectiveTimeRange, 10);
  const [enhanceView, setEnhanceView] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pull Request Contributions</CardTitle>
        <CardDescription>
          Visualize the size and frequency of contributions over the past{" "}
          {isMobile ? 7 : effectiveTimeRangeNumber} days
          {isMobile && effectiveTimeRangeNumber > 7 && (
            <span className="block text-xs mt-1 text-muted-foreground">
              (Limited to 7 days on mobile devices)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ContributionsChart
          stats={stats}
          enhanceView={enhanceView}
          setEnhanceView={setEnhanceView}
        />
      </CardContent>
    </Card>
  );
}
