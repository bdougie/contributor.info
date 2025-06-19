import { useState, useCallback } from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { ChevronLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { QuadrantNode } from "@/hooks/use-hierarchical-distribution";
import type { PullRequest } from "@/lib/types";

interface DistributionTreemapEnhancedProps {
  data: any;
  currentView: "overview" | "quadrant";
  selectedQuadrant: string | null;
  onDrillDown: (quadrantId: string) => void;
  onDrillUp: () => void;
  onNodeClick?: (nodeId: string) => void;
}

const COLORS = {
  refinement: "#4ade80",
  newStuff: "#60a5fa",
  refactoring: "#f97316",
  maintenance: "#a78bfa",
};

export function DistributionTreemapEnhanced({
  data,
  currentView,
  selectedQuadrant,
  onDrillDown,
  onDrillUp,
  onNodeClick,
}: DistributionTreemapEnhancedProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredPRs, setHoveredPRs] = useState<PullRequest[]>([]);

  // Add CSS for smooth transitions
  const treemapStyles = `
    .distribution-treemap-rect {
      cursor: pointer;
    }
    .distribution-treemap-text {
      pointer-events: none;
    }
    .pr-preview {
      animation: fadeIn 0.2s ease-in;
    }
    .treemap-container {
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .treemap-drill-down {
      animation: expandToFullSpace 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes expandToFullSpace {
      from { 
        opacity: 0.8; 
        transform: scale(0.95);
      }
      to { 
        opacity: 1; 
        transform: scale(1);
      }
    }
  `;

  const getTreemapData = () => {
    if (!data || !data.children) {
      return [];
    }

    if (currentView === "overview") {
      // Return only quadrant data without children to show clean overview
      return data.children.map((quadrant: QuadrantNode) => ({
        id: quadrant.id,
        name: quadrant.name,
        value: quadrant.value,
        color: quadrant.color,
        // Explicitly remove children to prevent avatars from showing
      }));
    } else {
      const quadrant = data.children.find(
        (q: QuadrantNode) => q.id === selectedQuadrant
      );
      return quadrant?.children || [];
    }
  };

  const CustomTreemapContent = useCallback(
    (props: any) => {
      const {
        x,
        y,
        width,
        height,
        name,
        value,
        id,
        color,
        login,
        avatar_url,
        prs,
      } = props;
      const isHovered = hoveredNode === id;
      const isQuadrant = currentView === "overview";
      const isContributor = currentView === "quadrant";
      const isOthers = login === "others";

      const handleClick = () => {
        if (isQuadrant) {
          onDrillDown(id);
        } else if (onNodeClick && !isOthers) {
          onNodeClick(id);
        }
      };

      const handleMouseEnter = () => {
        setHoveredNode(id);
        if (isContributor && prs) {
          setHoveredPRs(prs.slice(0, 5));
        }
      };

      const handleMouseLeave = () => {
        setHoveredNode(null);
        setHoveredPRs([]);
      };

      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            className="distribution-treemap-rect"
            style={{
              fill: isQuadrant
                ? color
                : COLORS[selectedQuadrant as keyof typeof COLORS],
              stroke: "#fff",
              strokeWidth: 1,
            }}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />

          {/* Content for different node types */}
          {isQuadrant ? (
            // Overview: Clean quadrant view (like original)
            width > 60 &&
            height > 60 && (
              <>
                <text
                  x={x + width / 2}
                  y={y + height / 2 - 10}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={16}
                  fontWeight="bold"
                  className="distribution-treemap-text"
                  style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
                >
                  {name}
                </text>
                <text
                  x={x + width / 2}
                  y={y + height / 2 + 10}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={14}
                  className="distribution-treemap-text"
                  style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
                >
                  {value} PRs
                </text>
              </>
            )
          ) : (
            // Drill-down: Avatar-only contributor nodes
            <>
              {isOthers
                ? // Others node with icon
                  width > 40 &&
                  height > 40 && (
                    <foreignObject
                      x={x + width / 2 - 16}
                      y={y + height / 2 - 16}
                      width={32}
                      height={32}
                    >
                      <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                    </foreignObject>
                  )
                : // Contributor avatar only
                  width > 30 &&
                  height > 30 && (
                    <foreignObject
                      x={x + width / 2 - Math.min(width, height) * 0.3}
                      y={y + height / 2 - Math.min(width, height) * 0.3}
                      width={Math.min(width, height) * 0.6}
                      height={Math.min(width, height) * 0.6}
                    >
                      <Avatar
                        className="w-full h-full border-2 border-white"
                        style={{
                          width: Math.min(width, height) * 0.6,
                          height: Math.min(width, height) * 0.6,
                          minWidth: "24px",
                          minHeight: "24px",
                          maxWidth: "60px",
                          maxHeight: "60px",
                        }}
                      >
                        <AvatarImage
                          src={avatar_url}
                          alt={login || "Contributor"}
                        />
                        <AvatarFallback className="bg-background text-xs">
                          {(login || "U").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </foreignObject>
                  )}
            </>
          )}
        </g>
      );
    },
    [currentView, selectedQuadrant, hoveredNode, onDrillDown, onNodeClick]
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      const isContributor = currentView === "quadrant";

      // Only show tooltip for contributors in drill-down, not for quadrants in overview
      if (!isContributor) {
        return null;
      }

      return (
        <div className="bg-background border rounded-lg shadow-lg p-3 max-w-sm">
          {/* Drill-down view: Show contributor details (no avatar, just name + PRs) */}
          {data.login === "others" ? (
            <>
              <p className="font-semibold text-sm">{data.name}</p>
              <p className="text-xs text-muted-foreground">
                {data.value} PRs from remaining contributors
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-sm">{data.login || "Unknown"}</p>
              <p className="text-xs text-muted-foreground mb-2">
                {data.value} PRs in{" "}
                {
                  QUADRANT_INFO[selectedQuadrant as keyof typeof QUADRANT_INFO]
                    ?.label
                }
              </p>
              {hoveredPRs.length > 0 && (
                <div className="space-y-1 pr-preview">
                  <p className="text-xs font-medium text-muted-foreground">
                    Recent PRs:
                  </p>
                  {hoveredPRs.map((pr) => (
                    <div key={pr.id} className="text-xs">
                      <span className="text-muted-foreground">
                        #{pr.number}
                      </span>{" "}
                      -<span className="ml-1 line-clamp-1">{pr.title}</span>
                    </div>
                  ))}
                  {data.prs && data.prs.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{data.prs.length - 5} more PRs
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <style>{treemapStyles}</style>

      {/* Breadcrumb Navigation */}
      {currentView === "quadrant" && selectedQuadrant && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDrillUp}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            All Contributions
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">
            {QUADRANT_INFO[selectedQuadrant as keyof typeof QUADRANT_INFO]
              ?.label || selectedQuadrant}
          </span>
        </div>
      )}

      <div
        className={`treemap-container ${
          currentView === "quadrant" ? "treemap-drill-down" : ""
        }`}
      >
        <ResponsiveContainer width="100%" height={400}>
          <Treemap
            data={getTreemapData()}
            dataKey="value"
            aspectRatio={4 / 3}
            content={<CustomTreemapContent />}
            animationBegin={0}
            animationDuration={100}
          >
            {currentView === 'quadrant' && <Tooltip content={<CustomTooltip />} />}
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const QUADRANT_INFO = {
  refinement: { label: "Refinement" },
  newStuff: { label: "New Features" },
  refactoring: { label: "Refactoring" },
  maintenance: { label: "Maintenance" },
};
