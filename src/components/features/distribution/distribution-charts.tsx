import { useState, useEffect, Suspense } from "react";
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
import { ChevronRight } from "lucide-react";
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
  chartType?: ChartType;
}

type ChartType = "donut" | "bar" | "treemap";

const COLORS = {
  refinement: "#4ade80",
  new: "#60a5fa",
  refactoring: "#f97316",
  maintenance: "#a78bfa",
};

// Language colors from GitHub
const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#2b7489",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Python: "#3572A5",
  Java: "#b07219",
  Go: "#00ADD8",
  Rust: "#dea584",
  Other: "#cccccc",
};

// Helper function to get primary language for a PR
const getPrimaryLanguage = (pr: PullRequest): { name: string; color: string } => {
  if (pr.commits && pr.commits.length > 0) {
    // Count changes by language
    const languageChanges: Record<string, number> = {};
    pr.commits.forEach((commit) => {
      const lang = commit.language || "Other";
      languageChanges[lang] = (languageChanges[lang] || 0) + commit.additions + commit.deletions;
    });
    
    // Find language with most changes
    const primaryLang = Object.entries(languageChanges)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || "Other";
    
    return {
      name: primaryLang,
      color: LANGUAGE_COLORS[primaryLang] || LANGUAGE_COLORS["Other"]
    };
  }
  
  // Fallback: infer from PR title
  const titleLower = pr.title.toLowerCase();
  let lang = "Other";
  
  if (titleLower.includes("typescript") || titleLower.includes(".ts")) {
    lang = "TypeScript";
  } else if (titleLower.includes("javascript") || titleLower.includes(".js")) {
    lang = "JavaScript";
  } else if (titleLower.includes("css") || titleLower.includes("style")) {
    lang = "CSS";
  } else if (titleLower.includes("html") || titleLower.includes("markup")) {
    lang = "HTML";
  } else if (titleLower.includes("python") || titleLower.includes(".py")) {
    lang = "Python";
  } else if (titleLower.includes("java") || titleLower.includes(".java")) {
    lang = "Java";
  } else if (titleLower.includes("go") || titleLower.includes(".go")) {
    lang = "Go";
  } else if (titleLower.includes("rust") || titleLower.includes(".rs")) {
    lang = "Rust";
  }
  
  return {
    name: lang,
    color: LANGUAGE_COLORS[lang] || LANGUAGE_COLORS["Other"]
  };
};

function DistributionCharts({
  data,
  onSegmentClick,
  filteredPRs = [],
  selectedQuadrant,
  pullRequests = [],
  chartType = "treemap",
}: DistributionChartsProps) {
  const [activeSegment, setActiveSegment] = useState<string | null>(selectedQuadrant || null);
  const [isMobile, setIsMobile] = useState(false);
  const [isPRListCollapsed, setIsPRListCollapsed] = useState(true);

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

  useEffect(() => {
    // For treemap, always collapsed
    // For pie/bar on desktop, expanded by default
    // For pie/bar on mobile, collapsed by default
    if (chartType === "treemap") {
      setIsPRListCollapsed(true);
    } else {
      // For pie/bar charts, only expand on desktop
      setIsPRListCollapsed(isMobile);
    }
  }, [chartType, isMobile]);

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

  const ChartSkeleton = () => (
    <div className="flex items-center justify-center h-full w-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
    </div>
  );

  const renderDonutChart = () => (
    <div className="w-full">
      {/* Mobile: Simplified view */}
      <div className="block sm:hidden">
        <Suspense fallback={<ChartSkeleton />}>
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
        </Suspense>
      </div>

      {/* Desktop: Full featured view */}
      <div className="hidden sm:block">
        <Suspense fallback={<ChartSkeleton />}>
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
        </Suspense>
      </div>
    </div>
  );

  const renderBarChart = () => (
    <Suspense fallback={<ChartSkeleton />}>
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
    </Suspense>
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
        onNodeClick={() => {
          // Handle contributor node clicks
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

  const renderPRDrawer = () => {
    if (!selectedQuadrant || filteredPRs.length === 0) return null;

    const selectedData = data.find(d => d.id === selectedQuadrant);
    
    // For treemap, always check the state. For others, only show on mobile
    const shouldShowDrawer = chartType === "treemap" || isMobile;
    const isDrawerCollapsed = chartType === "treemap" ? isPRListCollapsed : (isMobile ? isPRListCollapsed : true);
    
    if (!shouldShowDrawer) return null;
    
    return (
      <div className={`absolute top-0 right-0 h-full bg-background border-l shadow-lg transition-transform duration-300 ease-in-out ${
        isDrawerCollapsed 
          ? "translate-x-full" 
          : "translate-x-0"
      } w-80 max-w-[90%]`}>
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-3 h-3 rounded flex-shrink-0"
                style={{ backgroundColor: COLORS[selectedQuadrant as keyof typeof COLORS] }}
              />
              <span className="font-semibold text-sm truncate">
                {selectedData?.label}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPRListCollapsed(true)}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredPRs.slice(0, 50).map((pr) => {
              const primaryLanguage = getPrimaryLanguage(pr);
              return (
                <a
                  key={pr.id}
                  href={`https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <p className="text-sm font-medium line-clamp-2 mb-1">
                    #{pr.number} - {pr.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mb-1">
                    {pr.user.login} · +{pr.additions} -{pr.deletions}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: primaryLanguage.color }}
                      title={primaryLanguage.name}
                    />
                    <span>
                      Created {new Date(pr.created_at).toLocaleDateString()}
                      {pr.merged_at && (
                        <span> · Merged {new Date(pr.merged_at).toLocaleDateString()}</span>
                      )}
                    </span>
                  </div>
                </a>
              );
            })}
            {filteredPRs.length > 50 && (
              <p className="text-sm text-muted-foreground text-center py-4 border-t">
                Showing first 50 of {filteredPRs.length} PRs
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

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
              {selectedData?.label}
            </h4>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredPRs.slice(0, 20).map((pr) => {
              const primaryLanguage = getPrimaryLanguage(pr);
              return (
                <a
                  key={pr.id}
                  href={`https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 rounded hover:bg-accent/50 transition-colors"
                >
                  <p className="text-sm font-medium line-clamp-1 mb-1">
                    #{pr.number} - {pr.title}
                  </p>
                  <p className="text-xs text-muted-foreground mb-1">
                    {pr.user.login} · +{pr.additions} -{pr.deletions}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: primaryLanguage.color }}
                      title={primaryLanguage.name}
                    />
                    <span>
                      Created {new Date(pr.created_at).toLocaleDateString()}
                      {pr.merged_at && (
                        <span> · Merged {new Date(pr.merged_at).toLocaleDateString()}</span>
                      )}
                    </span>
                  </div>
                </a>
              );
            })}
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

      {/* Treemap: Always use overlay drawer */}
      {chartType === "treemap" ? (
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            {/* Chart Area - Always takes full space */}
            <div className="h-[400px]">
              {renderTreemap()}
            </div>
          
          {/* PR Drawer - Overlay that slides in from right */}
          {selectedQuadrant && renderPRDrawer()}
          
          {/* Drawer Toggle Button - Only visible when drawer is closed and for treemap */}
          {selectedQuadrant && chartType === "treemap" && isPRListCollapsed && (
            <div className="absolute top-4 right-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPRListCollapsed(false)}
                className="flex items-center gap-2"
              >
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: COLORS[selectedQuadrant as keyof typeof COLORS] }}
                />
                <span className="hidden sm:inline">
                  {data.find(d => d.id === selectedQuadrant)?.label}
                </span>
                <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      ) : (
        /* Pie/Bar: Desktop grid layout, mobile overlay drawer */
        <>
          {/* Desktop: Grid layout */}
          <div className="hidden md:block">
            {selectedQuadrant ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-6">
                    {chartType === "donut" && renderDonutChart()}
                    {chartType === "bar" && renderBarChart()}
                  </CardContent>
                </Card>
                {renderPRList()}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6">
                  {chartType === "donut" && renderDonutChart()}
                  {chartType === "bar" && renderBarChart()}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Mobile: Overlay drawer */}
          <div className="block md:hidden">
            <Card className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="h-[400px]">
                  {chartType === "donut" && renderDonutChart()}
                  {chartType === "bar" && renderBarChart()}
                </div>
              
              {/* PR Drawer - Overlay that slides in from right */}
              {selectedQuadrant && renderPRDrawer()}
              
              {/* Drawer Toggle Button - Only visible when drawer is closed on mobile */}
              {selectedQuadrant && isPRListCollapsed && (
                <div className="absolute top-4 right-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPRListCollapsed(false)}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: COLORS[selectedQuadrant as keyof typeof COLORS] }}
                    />
                    <span className="hidden sm:inline">
                      {data.find(d => d.id === selectedQuadrant)?.label}
                    </span>
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </>
      )}

      {renderLegend()}
    </div>
  );
}

export default DistributionCharts;
export { DistributionCharts };