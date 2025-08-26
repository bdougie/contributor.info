import { useState, useEffect, Suspense, useMemo } from "react"
import { ChevronRight } from '@/components/ui/icon';
import { DonutChart, type DonutChartData } from '@/components/ui/charts';
import { BarChart as UPlotBarChart } from '@/components/ui/charts';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { QuadrantData } from "@/hooks/use-distribution";
import type { PullRequest } from "@/lib/types";
import { useHierarchicalDistribution } from "@/hooks/use-hierarchical-distribution";
import { DistributionTreemapEnhanced } from "./distribution-treemap-enhanced";
import { getPrimaryLanguage } from '@/lib/language-utils';

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

  // Add state for contributor drill-down
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);
  const [contributorView, setContributorView] = useState<"overview" | "quadrant" | "contributor">("overview");

  // Sync contributor view with the hierarchical distribution view
  useEffect(() => {
    setContributorView(currentView);
  }, [currentView]);

  // Handle contributor drill-down
  const handleContributorClick = (contributorId: string) => {
    setSelectedContributor(contributorId);
    setContributorView("contributor");
  };

  // Handle PR click - open PR in new tab
  const handlePRClick = (pr: PullRequest) => {
    const url = `https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Handle drill up from contributor view
  const handleContributorDrillUp = () => {
    if (contributorView === "contributor") {
      setContributorView("quadrant");
      setSelectedContributor(null);
    } else {
      drillUp();
    }
  };

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

  const handleSegmentClick = (segment: DonutChartData | { id: string }) => {
    const quadrantId = segment.id;
    setActiveSegment(quadrantId);
    onSegmentClick?.(quadrantId);
  };

  const handleBarClick = (index: number) => {
    if (index >= 0 && index < data.length) {
      const quadrantId = data[index].id;
      setActiveSegment(quadrantId);
      onSegmentClick?.(quadrantId);
    }
  };

  // Convert data to DonutChart format
  const donutData = useMemo<DonutChartData[]>(() => {
    return data.map(item => ({
      id: item.id,
      label: item.label,
      value: item.value,
      percentage: item.percentage,
      color: COLORS[item.id as keyof typeof COLORS],
    }));
  }, [data]);


  // Custom tooltip component
  const [tooltipData, setTooltipData] = useState<QuadrantData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const ChartSkeleton = () => (
    <div className="flex items-center justify-center h-full w-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
    </div>
  );

  // Add pulse animation styles
  const pulseStyles = `
    @keyframes barPulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.2; }
    }
  `;

  const renderDonutChart = () => {
    return (
      <div 
        className="w-full flex justify-center relative"
        onMouseMove={(e) => {
          // Always capture mouse position, not just when tooltip is visible
          const rect = e.currentTarget.getBoundingClientRect();
          setTooltipPosition({ 
            x: e.clientX - rect.left + 10, // Add offset so tooltip doesn't block cursor
            y: e.clientY - rect.top - 10 
          });
        }}
        onMouseLeave={() => {
          setTooltipData(null);
          setTooltipPosition({ x: 0, y: 0 });
        }}
      >
        <Suspense fallback={<ChartSkeleton />}>
          <DonutChart
            data={donutData}
            width={isMobile ? 280 : 400}
            height={isMobile ? 280 : 400}
            innerRadius={isMobile ? 40 : 60}
            outerRadius={isMobile ? 80 : 120}
            onClick={handleSegmentClick}
            onHover={(segment, event) => {
              if (segment) {
                const quadrantData = data.find(d => d.id === segment.id);
                setTooltipData(quadrantData || null);
                // Update position immediately when hovering over a segment
                if (event && quadrantData) {
                  const rect = (event.target as HTMLElement).closest('.w-full')?.getBoundingClientRect();
                  if (rect) {
                    setTooltipPosition({
                      x: event.clientX - rect.left + 10,
                      y: event.clientY - rect.top - 10
                    });
                  }
                }
              } else {
                setTooltipData(null);
              }
            }}
            activeSegmentId={activeSegment}
            showLabel={!isMobile}
            centerLabel={totalContributions.toString()}
            centerSubLabel="Total PRs"
            responsive={true}
          />
        </Suspense>
        
        {/* Enhanced Custom Tooltip */}
        {tooltipData && (
          <div className="absolute pointer-events-none bg-background/95 backdrop-blur-sm border rounded-xl shadow-2xl p-4 max-w-xs z-50 transition-all duration-200 ease-out"
               style={{ 
                 display: tooltipData ? 'block' : 'none',
                 left: `${tooltipPosition.x}px`,
                 top: `${tooltipPosition.y}px`,
                 opacity: tooltipData ? 1 : 0,
                 transform: tooltipData ? 'scale(1)' : 'scale(0.95)',
               }}>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-4 h-4 rounded-md shadow-sm"
                style={{ 
                  backgroundColor: COLORS[tooltipData.id as keyof typeof COLORS],
                  boxShadow: `0 0 0 2px ${COLORS[tooltipData.id as keyof typeof COLORS]}20`
                }}
              />
              <p className="font-semibold text-sm">{tooltipData.label}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{tooltipData.description}</p>
            <div className="space-y-2 bg-muted/30 rounded-lg p-2">
              <p className="text-sm flex justify-between items-center">
                <span className="text-muted-foreground">Pull Requests:</span>
                <span className="font-semibold">{tooltipData.value}</span>
              </p>
              <p className="text-sm flex justify-between items-center">
                <span className="text-muted-foreground">Percentage:</span>
                <span className="font-semibold">{tooltipData.percentage.toFixed(1)}%</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-muted/50 flex items-center gap-1">
              <span className="inline-block w-1 h-1 bg-muted-foreground rounded-full"></span>
              Click to filter view
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderBarChart = () => {
    // Use a safer theme detection method
    const isDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
    
    // Create a custom bar chart that colors each bar individually with selection state
    const barData = {
      labels: data.map(d => d.label),
      datasets: data.map((item, index) => {
        const isActive = item.id === activeSegment;
        const baseColor = COLORS[item.id as keyof typeof COLORS];
        
        // Adjust color brightness/opacity based on selection state - less aggressive
        const color = isActive 
          ? baseColor 
          : activeSegment 
            ? `${baseColor}80` // Make non-selected bars slightly transparent (50% opacity)
            : baseColor;
        
        return {
          label: item.label,
          data: data.map((_, i) => i === index ? item.value : null),
          color: color,
        };
      }),
    };

    return (
      <div className="w-full" onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}>
        <Suspense fallback={<ChartSkeleton />}>
          <div className="relative">
            <UPlotBarChart
              data={barData}
              height={isMobile ? 300 : 400}
              isDark={isDark}
              showGrid={true}
              showLegend={false}
              xAxisLabel=""
              yAxisLabel="Pull Requests"
              grouped={false}
              barWidth={0.6}
            />
            
            {/* Add click overlay for interaction */}
            <div 
              className="absolute inset-0 pointer-events-auto" 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const chartArea = e.currentTarget.querySelector('.u-wrap');
                if (!chartArea) {
                  const x = e.clientX - rect.left;
                  const segmentWidth = rect.width / data.length;
                  const index = Math.floor(x / segmentWidth);
                  handleBarClick(index);
                  return;
                }
                
                // Get the actual chart plotting area bounds
                const chartRect = chartArea.getBoundingClientRect();
                const x = e.clientX - chartRect.left;
                
                // Account for the axis padding (usually around 40-60px on the left)
                const plotWidth = chartRect.width;
                const segmentWidth = plotWidth / data.length;
                const index = Math.floor(x / segmentWidth);
                
                if (index >= 0 && index < data.length) {
                  handleBarClick(index);
                }
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const chartArea = e.currentTarget.querySelector('.u-wrap');
                
                // Clear any existing timeout
                if (hoverTimeout) {
                  clearTimeout(hoverTimeout);
                }
                
                // Set position immediately but delay tooltip display
                setTooltipPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                
                // Add delay before showing tooltip
                const timeout = setTimeout(() => {
                  if (!chartArea) {
                    const x = e.clientX - rect.left;
                    const segmentWidth = rect.width / data.length;
                    const index = Math.floor(x / segmentWidth);
                    if (index >= 0 && index < data.length) {
                      setTooltipData(data[index]);
                    }
                    return;
                  }
                  
                  const chartRect = chartArea.getBoundingClientRect();
                  const x = e.clientX - chartRect.left;
                  const plotWidth = chartRect.width;
                  const segmentWidth = plotWidth / data.length;
                  const index = Math.floor(x / segmentWidth);
                  
                  if (index >= 0 && index < data.length) {
                    setTooltipData(data[index]);
                  } else {
                    setTooltipData(null);
                  }
                }, 300); // 300ms delay before showing tooltip
                
                setHoverTimeout(timeout);
              }}
              onMouseLeave={() => {
                if (hoverTimeout) {
                  clearTimeout(hoverTimeout);
                  setHoverTimeout(null);
                }
                setTooltipData(null);
              }}
              style={{ cursor: 'pointer' }}
            />
          </div>
        </Suspense>
        
        {/* Enhanced Custom Tooltip */}
        {tooltipData && (
          <div className="absolute pointer-events-none bg-background/95 backdrop-blur-sm border rounded-xl shadow-2xl p-4 max-w-xs z-50 transition-all duration-200 ease-out"
               style={{ 
                 display: tooltipData ? 'block' : 'none',
                 left: `${tooltipPosition.x}px`,
                 top: `${tooltipPosition.y}px`,
                 opacity: tooltipData ? 1 : 0,
                 transform: tooltipData ? 'scale(1)' : 'scale(0.95)',
               }}>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-4 h-4 rounded-md shadow-sm"
                style={{ 
                  backgroundColor: COLORS[tooltipData.id as keyof typeof COLORS],
                  boxShadow: `0 0 0 2px ${COLORS[tooltipData.id as keyof typeof COLORS]}20`
                }}
              />
              <p className="font-semibold text-sm">{tooltipData.label}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{tooltipData.description}</p>
            <div className="space-y-2 bg-muted/30 rounded-lg p-2">
              <p className="text-sm flex justify-between items-center">
                <span className="text-muted-foreground">Pull Requests:</span>
                <span className="font-semibold">{tooltipData.value}</span>
              </p>
              <p className="text-sm flex justify-between items-center">
                <span className="text-muted-foreground">Percentage:</span>
                <span className="font-semibold">{tooltipData.percentage.toFixed(1)}%</span>
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

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
        currentView={contributorView}
        selectedQuadrant={drillDownQuadrant}
        selectedContributor={selectedContributor}
        onDrillDown={(quadrantId) => {
          // If treemap is drilling down and no external filter is set, sync with main filter
          if (!selectedQuadrant) {
            onSegmentClick?.(quadrantId);
          }
          drillDown(quadrantId);
        }}
        onDrillUp={handleContributorDrillUp}
        onContributorClick={handleContributorClick}
        onPRClick={handlePRClick}
        onNodeClick={() => {
          // Handle other node clicks if needed
        }}
      />
    );
  };

  const renderLegend = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mt-3 sm:mt-6">
      {data.map((item) => (
        <button
          key={item.id}
          onClick={() => handleSegmentClick({ id: item.id })}
          className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all text-left ${
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
      <>
        {/* Mobile backdrop overlay */}
        {isMobile && !isDrawerCollapsed && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 sm:hidden"
            onClick={() => setIsPRListCollapsed(true)}
          />
        )}
      <div className={`fixed sm:absolute top-0 right-0 h-full bg-background border-l shadow-lg transition-transform duration-300 ease-in-out z-40 ${
        isDrawerCollapsed 
          ? "translate-x-full" 
          : "translate-x-0"
      } w-[85vw] sm:w-80 max-w-[320px]`}>
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
      </>
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
      <style>{pulseStyles}</style>

      {/* Treemap: Always use overlay drawer */}
      {chartType === "treemap" ? (
        <Card className="relative">
          <CardContent className="p-4 sm:p-6 overflow-visible">
            {/* Chart Area - Responsive height */}
            <div className="h-[350px] sm:h-[450px] overflow-visible">
              {renderTreemap()}
            </div>
          
          {/* PR Drawer - Overlay that slides in from right */}
          {selectedQuadrant && renderPRDrawer()}
          
          {/* Drawer Toggle Button - Only visible when drawer is closed and for treemap */}
          {selectedQuadrant && chartType === "treemap" && isPRListCollapsed && (
            <div className="absolute top-4 right-4 z-30">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPRListCollapsed(false)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 shadow-md bg-background/95 backdrop-blur-sm"
              >
                <div
                  className="w-3 h-3 rounded flex-shrink-0"
                  style={{ backgroundColor: COLORS[selectedQuadrant as keyof typeof COLORS] }}
                />
                <span className="hidden sm:inline text-xs">
                  {data.find(d => d.id === selectedQuadrant)?.label}
                </span>
                <span className="sm:hidden text-xs">PRs</span>
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 rotate-180" />
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
            {selectedQuadrant
? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-6">
                    {chartType === "donut" && renderDonutChart()}
                    {chartType === "bar" && renderBarChart()}
                  </CardContent>
                </Card>
                {renderPRList()}
              </div>
            )
: (
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
            <Card className="relative">
              <CardContent className="p-4 sm:p-6 overflow-visible">
                <div className="flex items-center justify-center">
                  {chartType === "donut" && renderDonutChart()}
                  {chartType === "bar" && renderBarChart()}
                </div>
              
              {/* PR Drawer - Overlay that slides in from right */}
              {selectedQuadrant && renderPRDrawer()}
              
              {/* Drawer Toggle Button - Only visible when drawer is closed on mobile */}
              {selectedQuadrant && isPRListCollapsed && (
                <div className="absolute top-4 right-4 z-30">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPRListCollapsed(false)}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 shadow-md bg-background/95 backdrop-blur-sm"
                  >
                    <div
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ backgroundColor: COLORS[selectedQuadrant as keyof typeof COLORS] }}
                    />
                    <span className="text-xs">View PRs</span>
                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 rotate-180" />
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