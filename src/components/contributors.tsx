import { useMemo } from "react";
import { FaUserAlt } from "react-icons/fa";
import { FaUsers } from "react-icons/fa6";
import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Bar,
  Tooltip,
  type TooltipProps,
  CartesianGrid,
} from "recharts";
import {
  ValueType,
  NameType,
} from "recharts/types/component/DefaultTooltipContent";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useContext } from "react";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { humanizeNumber } from "@/lib/utils";
import { useTimeRange } from "@/lib/time-range-store";

// Mock function to replace getDailyContributorHistogramToDays
const getMockDailyContributorData = (range: number) => {
  // Generate mock data based on the specified range
  const mockData = [];
  const now = new Date();

  // Generate data points for each day in the range
  for (let i = 0; i < range; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Format the date as MM/DD
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;

    // Random contributor count between 1 and 20
    const contributorCount = Math.floor(Math.random() * 20) + 1;

    mockData.push({
      bucket: formattedDate,
      contributor_count: contributorCount,
    });
  }

  // Reverse to show oldest first
  return mockData.reverse();
};

// Mock function to replace getTicks
const getMockTicks = (data: any[], range: number) => {
  // Generate some tick marks based on the data length
  const tickCount = Math.min(5, data.length);
  const interval = Math.floor(data.length / tickCount);

  const ticks = [];
  for (let i = 0; i < data.length; i += interval) {
    ticks.push(data[i].bucket);
  }

  // Ensure the last tick is included
  if (data.length > 0 && !ticks.includes(data[data.length - 1].bucket)) {
    ticks.push(data[data.length - 1].bucket);
  }

  return ticks;
};

// Wrapper component to make it easier to use with mocked data
function ContributorsChart() {
  const { stats } = useContext(RepoStatsContext);
  const { timeRange } = useTimeRange();
  const range = parseInt(timeRange, 10);
  const isLoading = stats.loading;

  // Generate mock data
  const dailyData = useMemo(() => getMockDailyContributorData(range), [range]);

  const bucketTicks = useMemo(
    () => getMockTicks(dailyData, range),
    [dailyData, range]
  );

  // Calculate a mock total and average based on the daily data
  const rangedTotal = useMemo(
    () => dailyData.reduce((sum, day) => sum + day.contributor_count, 0),
    [dailyData]
  );

  const rangedAverage = useMemo(
    () => (rangedTotal / range).toPrecision(2),
    [rangedTotal, range]
  );

  // Generate a unique ID for syncing charts (if needed later)
  const syncId = useMemo(() => Math.floor(Math.random() * 10000), []);

  return (
    <Card className="flex flex-col gap-8 w-full h-full items-center px-6 py-8">
      <section className="flex flex-col lg:flex-row w-full items-start lg:items-start gap-4 lg:justify-between px-2">
        {isLoading ? (
          <Skeleton className="w-[100px] h-[24px]" />
        ) : (
          <>
            <div className="flex gap-2 items-center w-fit">
              <FaUsers className="text-xl" />
              <div className="flex gap-1 items-center">
                <h3 className="text-sm font-semibold xl:text-lg text-slate-800">
                  Contributors
                </h3>
                <p className="text-sm xl:text-base w-fit pl-2 text-slate-500 font-medium">
                  {range} days
                </p>
              </div>
            </div>
            <aside className="flex gap-8">
              <div>
                <h3 className="text-xs xl:text-sm text-slate-500">
                  Total {range} days
                </h3>
                <p className="font-semibold text-xl xl:text-3xl">
                  {rangedTotal}
                </p>
              </div>
              <div>
                <h3 className="text-xs lg:text-sm text-slate-500">
                  Average per day
                </h3>
                <p className="font-semibold text-xl xl:text-3xl">
                  {humanizeNumber(parseFloat(rangedAverage))}
                </p>
              </div>
            </aside>
          </>
        )}
      </section>
      <ResponsiveContainer width="100%" height={180}>
        {isLoading ? (
          <Skeleton className="w-[100px] h-[100px]" />
        ) : (
          <BarChart data={dailyData} syncId={syncId} className="!-left-6">
            <XAxis dataKey="bucket" ticks={bucketTicks} tick={CustomTick} />
            <YAxis
              domain={["auto", "auto"]}
              fontSize={14}
              tick={{ fill: "#94a3b8" }}
              axisLine={{ stroke: "#94a3b8" }}
              tickLine={{ stroke: "#94a3b8" }}
            />
            <Tooltip content={CustomTooltip} filterNull={false} />
            <CartesianGrid
              vertical={false}
              strokeDasharray="4"
              stroke="#E2E8F0"
            />
            <Bar dataKey="contributor_count" fill="#2563eb" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
}

function CustomTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (active && payload) {
    return (
      <figcaption className="flex flex-col gap-1 bg-white px-4 py-2 rounded-lg border">
        <section className="flex gap-2 items-center">
          <FaUserAlt className="fill-[#2563eb]" />
          <p>Contributors: {payload[0]?.value}</p>
        </section>

        <p className="text-light-slate-9 text-sm">
          {payload[0]?.payload.bucket}
        </p>
      </figcaption>
    );
  }
}

function CustomTick({
  x,
  y,
  payload,
}: {
  x: number;
  y: number;
  payload: { value: string };
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={20}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={14}
      >
        {payload.value}
      </text>
    </g>
  );
}

// Main contributors component for the Health tab
export default function Contributors() {
  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-4">Contribution Activity</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Analyze how consistent contributor activity has been over time
      </p>
      <ContributorsChart />
    </div>
  );
}
