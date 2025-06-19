import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChartIcon, BarChart3Icon, TreePineIcon } from "lucide-react";
import type { QuadrantData } from "@/hooks/use-distribution";
import type { PullRequest } from "@/lib/types";
import { useHierarchicalDistribution } from "@/hooks/use-hierarchical-distribution";
import { DistributionTreemapEnhanced } from "./distribution-treemap-enhanced";

interface DistributionChartsProps {
  data: QuadrantData[];
  onSegmentClick?: (quadrantId: string) => void;
  filteredPRs?: PullRequest[];
  selectedQuadrant?: string | null;
  pullRequests?: PullRequest[];
}

type ChartType = "donut" | "bar" | "treemap";

const COLORS = {
  refinement: "#4ade80",
  new: "#60a5fa",
  refactoring: "#f97316",
  maintenance: "#a78bfa",
};

export function DistributionCharts({
  data,
  onSegmentClick,
  filteredPRs = [],
  selectedQuadrant,
  pullRequests = [],
}: DistributionChartsProps) {
  const [chartType, setChartType] = useState<ChartType>("treemap");
  const [activeSegment, setActiveSegment] = useState<string | null>(selectedQuadrant || null);
  const [isMobile, setIsMobile] = useState(false);

  // Add hierarchical distribution for enhanced treemap
  const {
    hierarchicalData,
    currentView,
    selectedQuadrant: drillDownQuadrant,
    drillDown,
    drillUp,
  } = useHierarchicalDistribution(pullRequests, selectedQuadrant);

  const totalContributions = data.reduce((sum, item) => sum + item.value, 0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setActiveSegment(selectedQuadrant || null);
  }, [selectedQuadrant]);

  const handleSegmentClick = (entry: any) => {
    const quadrantId = entry.id || entry.dataKey;
    setActiveSegment(quadrantId);
    onSegmentClick?.(quadrantId);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3 max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: COLORS[data.id as keyof typeof COLORS] }}
            />
            <p className="font-semibold text-sm">{data.label}</p>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-medium">{data.value}</span> PRs
            </p>
            <p className="text-sm text-muted-foreground">
              {data.percentage.toFixed(1)}% of total contributions
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
            Click to filter view
          </p>
        </div>
      );
    }
    return null;
  };

  const renderDonutChart = () => (
    <div className="w-full">
      {/* Mobile: Simplified view */}
      <div className="block sm:hidden">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={false}
              outerRadius={80}
              innerRadius={40}
              fill="#8884d8"
              dataKey="value"
              onClick={handleSegmentClick}
              className="cursor-pointer"
            >
              {data.map((entry) => (
                <Cell
                  key={`cell-${entry.id}`}
                  fill={COLORS[entry.id as keyof typeof COLORS]}
                  stroke={activeSegment === entry.id ? "#000" : "none"}
                  strokeWidth={activeSegment === entry.id ? 2 : 0}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-lg font-bold fill-foreground"
            >
              {totalContributions}
            </text>
            <text
              x="50%"
              y="50%"
              dy={16}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-muted-foreground"
            >
              Total PRs
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Desktop: Full featured view */}
      <div className="hidden sm:block">
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ percentage }) => `${percentage.toFixed(0)}%`}
              outerRadius={120}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
              onClick={handleSegmentClick}
              className="cursor-pointer"
              animationBegin={0}
              animationDuration={800}
            >
              {data.map((entry) => (
                <Cell
                  key={`cell-${entry.id}`}
                  fill={COLORS[entry.id as keyof typeof COLORS]}
                  stroke={activeSegment === entry.id ? "#000" : "none"}
                  strokeWidth={activeSegment === entry.id ? 2 : 0}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-2xl font-bold fill-foreground"
            >
              {totalContributions}
            </text>
            <text
              x="50%"
              y="50%"
              dy={20}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-sm fill-muted-foreground"
            >
              Total PRs
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={isMobile ? 350 : 400}>
      <BarChart 
        data={data} 
        margin={{ 
          top: 20, 
          right: 20, 
          left: 10, 
          bottom: isMobile ? 60 : 20 
        }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="label"
          className="text-xs"
          tick={{ fill: "currentColor", fontSize: isMobile ? 10 : 12 }}
          angle={isMobile ? -45 : 0}
          textAnchor={isMobile ? "end" : "middle"}
          height={isMobile ? 60 : 30}
        />
        <YAxis className="text-xs" tick={{ fill: "currentColor", fontSize: 10 }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="value"
          onClick={handleSegmentClick}
          className="cursor-pointer"
          radius={[4, 4, 0, 0]}
          animationDuration={600}
        >
          {data.map((entry) => (
            <Cell
              key={`cell-${entry.id}`}
              fill={COLORS[entry.id as keyof typeof COLORS]}
              stroke={activeSegment === entry.id ? "#000" : "none"}
              strokeWidth={activeSegment === entry.id ? 2 : 0}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  const renderTreemap = () => {
    if (!hierarchicalData) {
      return (
        <div className="flex items-center justify-center h-[400px]">
          <p className="text-muted-foreground">Loading treemap data...</p>
        </div>
      );
    }

    return (
      <DistributionTreemapEnhanced
        data={hierarchicalData}
        currentView={currentView}
        selectedQuadrant={drillDownQuadrant}
        onDrillDown={(quadrantId) => {
          // If treemap is drilling down and no external filter is set, sync with main filter
          if (!selectedQuadrant) {
            onSegmentClick?.(quadrantId);
          }
          drillDown(quadrantId);
        }}
        onDrillUp={() => {
          // If treemap is drilling up and external filter matches, clear main filter
          if (selectedQuadrant === drillDownQuadrant && selectedQuadrant) {
            onSegmentClick?.(selectedQuadrant); // Toggle off
          }
          drillUp();
        }}
        onNodeClick={(nodeId) => {
          // Handle contributor node clicks
          console.log('Contributor node clicked:', nodeId);
        }}
      />
    );
  };

  const renderLegend = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
      {data.map((item) => (
        <button
          key={item.id}
          onClick={() => handleSegmentClick({ id: item.id })}
          className={`flex items-start gap-3 p-3 rounded-lg transition-all text-left ${
            activeSegment === item.id
              ? "bg-accent ring-2 ring-primary"
              : "hover:bg-accent/50"
          }`}
        >
          <div
            className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
            style={{ backgroundColor: COLORS[item.id as keyof typeof COLORS] }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{item.label}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 sm:truncate">
              {item.description}
            </p>
            <p className="text-sm font-semibold mt-1">
              {item.value} PRs ({item.percentage.toFixed(1)}%)
            </p>
          </div>
        </button>
      ))}
    </div>
  );

  const renderPRList = () => {
    if (!selectedQuadrant || filteredPRs.length === 0) return null;

    const selectedData = data.find(d => d.id === selectedQuadrant);
    
    return (
      <Card className="h-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: COLORS[selectedQuadrant as keyof typeof COLORS] }}
            />
            <h4 className="font-semibold text-sm">
              {selectedData?.label} PRs ({filteredPRs.length})
            </h4>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredPRs.slice(0, 20).map((pr) => (
              <a
                key={pr.id}
                href={`https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2 rounded hover:bg-accent/50 transition-colors"
              >
                <p className="text-sm font-medium line-clamp-1">
                  #{pr.number} - {pr.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pr.user.login} · +{pr.additions} -{pr.deletions}
                </p>
              </a>
            ))}
            {filteredPRs.length > 20 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Showing first 20 of {filteredPRs.length} PRs
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-lg font-semibold">Contribution Breakdown</h3>
        <div className="flex gap-1 p-1 bg-muted rounded-lg self-start sm:self-auto">
          <Button
            size="sm"
            variant={chartType === "treemap" ? "default" : "ghost"}
            onClick={() => setChartType("treemap")}
            className="h-8 px-2 sm:px-3"
          >
            <TreePineIcon className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Treemap</span>
          </Button>
          <Button
            size="sm"
            variant={chartType === "donut" ? "default" : "ghost"}
            onClick={() => setChartType("donut")}
            className="h-8 px-2 sm:px-3"
          >
            <PieChartIcon className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Donut</span>
          </Button>
          <Button
            size="sm"
            variant={chartType === "bar" ? "default" : "ghost"}
            onClick={() => setChartType("bar")}
            className="h-8 px-2 sm:px-3"
          >
            <BarChart3Icon className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Bar</span>
          </Button>
        </div>
      </div>

      {(chartType === "bar" || chartType === "donut" || chartType === "treemap") && selectedQuadrant ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6">
              {chartType === "donut" && renderDonutChart()}
              {chartType === "bar" && renderBarChart()}
              {chartType === "treemap" && renderTreemap()}
            </CardContent>
          </Card>
          {renderPRList()}
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="p-6">
              {chartType === "donut" && renderDonutChart()}
              {chartType === "bar" && renderBarChart()}
              {chartType === "treemap" && renderTreemap()}
            </CardContent>
          </Card>
          {selectedQuadrant && chartType !== "treemap" && renderPRList()}
        </>
      )}

      {renderLegend()}
    </div>
  );
}