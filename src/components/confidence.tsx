import { useMemo } from "react";
import { FaUserPlus } from "react-icons/fa";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { useContext } from "react";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { useTimeRange } from "@/lib/time-range-store";

export function ConfidenceContent() {
  const { stats } = useContext(RepoStatsContext);
  const { timeRange } = useTimeRange();
  const timeRangeNumber = parseInt(timeRange, 10);

  // Mocked data for now
  const contributorConfidence = 0.35; // 35%
  const isLoading = stats.loading;
  const isError = !!stats.error;

  const percentage = Math.floor((contributorConfidence ?? 0) * 100);
  const data = useMemo(
    () => [
      { name: "confidence", value: percentage > 50 ? 50 : percentage },
      { name: "difference", value: percentage > 50 ? 0 : 50 - percentage },
    ],
    [percentage]
  );

  const getValueBasedOnPercentage = ({
    low,
    med,
    high,
  }: {
    low: string;
    med: string;
    high: string;
  }) => {
    return percentage < 10 ? low : percentage < 30 ? med : high;
  };

  const pieColor = getValueBasedOnPercentage({
    low: "#f59e0b",
    med: "#2563eb",
    high: "#22c55e",
  });

  const projectStatus = getValueBasedOnPercentage({
    low: "can be intimidating",
    med: "can be approachable",
    high: "is very approachable!",
  });

  const projectDescription = getValueBasedOnPercentage({
    low: "Few",
    med: "Some",
    high: "A lot of",
  });

  const renderCustomLabel = ({ cx, cy }: { cx: number; cy: number }) => {
    return (
      <text
        x={cx}
        y={cy}
        dy={-1}
        textAnchor="middle"
        className="text-lg lg:text-2xl fill-foreground font-semibold"
      >
        {percentage}
        <tspan className="text-xs lg:text-sm">%</tspan>
      </text>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-64" />
        <div className="flex justify-between gap-8">
          <Skeleton className="w-32 h-32 rounded-full" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FaUserPlus className="h-5 w-5" />
        <h3 className="text-lg font-medium">Unable to analyze confidence</h3>
        <p className="text-sm text-muted-foreground mt-2">
          There was an error calculating contributor confidence for this
          repository.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between w-full gap-8 lg:flex-col xl:flex-row">
        <div className="max-w-[14rem] lg:max-w-full lg:mx-auto h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                label={renderCustomLabel}
                labelLine={false}
                dataKey="value"
                startAngle={180}
                endAngle={0}
                innerRadius={40}
                paddingAngle={0}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.name === "confidence" ? pieColor : "#e2e8f0"}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <h3 className="font-medium text-base">
            This project {projectStatus}
          </h3>
          <p className="text-sm text-muted-foreground">
            {projectDescription} stargazers and forkers come back later on to
            make a meaningful contribution. Based on activity in the last{" "}
            {timeRangeNumber} days.
          </p>
        </div>
      </div>
    </div>
  );
}

// Confidence component that uses Context
export default function Confidence() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FaUserPlus className="h-5 w-5" />
          Contributor Confidence
        </CardTitle>
        <CardDescription>
          How approachable this project is for new contributors
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfidenceContent />
      </CardContent>
    </Card>
  );
}
