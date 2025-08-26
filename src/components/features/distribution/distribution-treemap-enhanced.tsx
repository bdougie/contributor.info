import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, Users } from '@/components/ui/icon';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { ProgressiveChart } from '@/components/ui/charts/ProgressiveChart';
import { SkeletonChart } from '@/components/skeletons/base/skeleton-chart';
import { supabaseAvatarCache } from '@/lib/supabase-avatar-cache';
import type { QuadrantNode, HierarchicalData } from '@/hooks/use-hierarchical-distribution';
import type { PullRequest } from '@/lib/types';
import { getPrimaryLanguage } from '@/lib/language-utils';

interface DistributionTreemapEnhancedProps {
  data: HierarchicalData | null;
  currentView: 'overview' | 'quadrant' | 'contributor';
  selectedQuadrant: string | null;
  selectedContributor?: string | null;
  onDrillDown: (quadrantId: string) => void;
  onDrillUp: () => void;
  onContributorClick?: (contributorId: string) => void;
  onPRClick?: (pr: PullRequest) => void;
  onNodeClick?: (nodeId: string) => void;
}

const COLORS = {
  refinement: '#4ade80',
  new: '#60a5fa',
  refactoring: '#f97316',
  maintenance: '#a78bfa',
};

export function DistributionTreemapEnhanced({
  data,
  currentView,
  selectedQuadrant,
  selectedContributor,
  onDrillDown,
  onDrillUp,
  onContributorClick,
  onPRClick,
  onNodeClick,
}: DistributionTreemapEnhancedProps) {
  const [hoveredPRs, setHoveredPRs] = useState<PullRequest[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [viewAnimation, setViewAnimation] = useState<'drill-in' | 'drill-out' | ''>('');
  const [cachedAvatars, setCachedAvatars] = useState<Map<number, string>>(new Map());

  // Load cached avatars for better performance
  useEffect(() => {
    const loadAvatars = async () => {
      if (!_data) return;

      // Extract unique contributors with their GitHub IDs
      const contributors = new Map<number, string>();

      const extractContributors = (node: unknown) => {
        if (node.login && node.avatar_url) {
          // Try to extract GitHub ID from avatar URL or use a hash
          const match = node.avatar_url.match(/u\/(\d+)/);
          const githubId = match
            ? parseInt(match[1])
            : // Fallback: use a deterministic hash based on login
              Math.abs(
                node.login.split('').reduce((a: number, b: string) => {
                  a = (a << 5) - a + b.charCodeAt(0);
                  return a & a;
                }, 0),
              );

          contributors.set(githubId, node.avatar_url);
        }
        if (node.children) {
          node.children.forEach(extractContributors);
        }
      };

      if (_data.children) {
        data.children.forEach((quadrant: QuadrantNode) => {
          if (quadrant.children) {
            quadrant.children.forEach(extractContributors);
          }
        });
      }

      // Load from cache
      const githubIds = Array.from(contributors.keys());
      if (githubIds.length > 0) {
        try {
          const cached = await supabaseAvatarCache.getAvatarUrls(
            githubIds.map((id) => ({
              githubId: id,
              username: '',
              fallbackUrl: contributors.get(id),
            })),
          );

          const avatarMap = new Map<number, string>();
          cached.forEach((result, githubId) => {
            avatarMap.set(githubId, result.url);
          });
          setCachedAvatars(avatarMap);
        } catch (_error) {
          console.error('Failed to load cached avatars:', _error);
        }
      }
    };

    loadAvatars();
  }, [data]);

  // Handle view transitions
  useEffect(() => {
    if (currentView === 'quadrant' || currentView === 'contributor') {
      setViewAnimation('drill-in');
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 400);
      return () => clearTimeout(timer);
    } else if (currentView === 'overview' && viewAnimation === 'drill-in') {
      setViewAnimation('drill-out');
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setViewAnimation('');
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [currentView]);

  // Add CSS for smooth transitions
  const treemapStyles = `
    .distribution-treemap-rect {
      cursor: pointer;
      transition: fill 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .distribution-treemap-text {
      pointer-events: none;
    }
    .treemap-avatar-container {
      cursor: pointer;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      background: transparent !important;
    }
    .treemap-avatar-container:hover {
      transform: scale(1.05);
      background: transparent !important;
    }
    .pr-preview {
      animation: fadeIn 0.2s ease-in;
    }
    .treemap-container {
      position: relative;
      overflow: hidden;
    }
    .treemap-view {
      transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                  transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .treemap-drill-in {
      animation: drillIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    .treemap-drill-out {
      animation: drillOut 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes drillIn {
      0% { 
        opacity: 0;
        transform: scale(1.2) translateZ(100px);
      }
      100% { 
        opacity: 1;
        transform: scale(1) translateZ(0);
      }
    }
    @keyframes drillOut {
      0% { 
        opacity: 0;
        transform: scale(0.8) translateZ(-100px);
      }
      100% { 
        opacity: 1;
        transform: scale(1) translateZ(0);
      }
    }
    .avatar-fade-in {
      animation: avatarFadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      animation-delay: 0.2s;
      opacity: 0;
    }
    @keyframes avatarFadeIn {
      from { 
        opacity: 0;
        transform: scale(0.5) rotate(-10deg);
      }
      to { 
        opacity: 1;
        transform: scale(1) rotate(0deg);
      }
    }
  `;

  const getTreemapData = () => {
    if (!data || !_data.children) {
      return [];
    }

    if (currentView === 'overview') {
      // Return only quadrant data without children to show clean overview
      return data.children.map((quadrant: QuadrantNode) => ({
        id: quadrant.id,
        name: quadrant.name,
        value: quadrant.value,
        color: quadrant.color,
        // Explicitly remove children to prevent avatars from showing
      }));
    } else if (currentView === 'quadrant') {
      // Show contributors for the selected quadrant
      const quadrant = data.children.find((q: QuadrantNode) => q.id === selectedQuadrant);
      return quadrant?.children || [];
    } else if (currentView === 'contributor') {
      // Show PRs for the selected contributor
      const quadrant = data.children.find((q: QuadrantNode) => q.id === selectedQuadrant);
      const contributor = quadrant?.children?.find((c: unknown) => c.id === selectedContributor);

      // Transform PRs into treemap nodes
      return (
        contributor?.prs?.map((pr: PullRequest) => {
          const language = getPrimaryLanguage(pr);
          return {
            id: `pr-${pr.id}`,
            name: `#${pr.number}`,
            title: pr.title,
            value: Math.max(1, pr.additions + pr.deletions || 1), // Use PR size as value
            language: language.name,
            languageColor: language.color,
            pr, // Store the full PR object for click handling
          };
        }) || []
      );
    }

    return [];
  };

  const [nodeHoverStates, setNodeHoverStates] = useState<Record<string, boolean>>({});

  const CustomTreemapContent = useCallback(
    (props: {
      x: number;
      y: number;
      width: number;
      height: number;
      name?: string;
      title?: string;
      id: string;
      color?: string;
      login?: string;
      avatar_url?: string;
      prs?: PullRequest[];
      pr?: PullRequest;
      language?: string;
      languageColor?: string;
    }) => {
      const {
        x,
        y,
        width,
        height,
        name,
        title,
        id,
        color,
        login,
        avatar_url,
        prs,
        pr, // Full PR object for PR nodes
        language,
        languageColor,
      } = props;
      const isQuadrant = currentView === 'overview';
      const isContributor = currentView === 'quadrant';
      const isPR = currentView === 'contributor';
      const isOthers = login === 'others';
      const showTransition = isTransitioning && (isContributor || isPR);
      const isHovered = nodeHoverStates[id] || false;

      const handleClick = () => {
        if (isQuadrant) {
          onDrillDown(id);
        } else if (isContributor && !isOthers && onContributorClick) {
          onContributorClick(id);
        } else if (isPR && pr && onPRClick) {
          onPRClick(pr);
        } else if (onNodeClick && !isOthers) {
          onNodeClick(id);
        }
      };

      const handleMouseEnter = () => {
        setNodeHoverStates((prev) => ({ ...prev, [id]: true }));
        if (isContributor && prs) {
          setHoveredPRs(prs.slice(0, 5));
        }
      };

      const handleMouseLeave = () => {
        setNodeHoverStates((prev) => ({ ...prev, [id]: false }));
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
                : isPR && languageColor
                  ? languageColor
                  : COLORS[selectedQuadrant as keyof typeof COLORS],
              stroke: '#ffffff',
              strokeWidth: 2,
              strokeOpacity: 0.8,
              opacity: isQuadrant ? (isHovered ? 1 : 0.92) : 1,
              filter: isQuadrant && isHovered ? 'brightness(1.1)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />

          {/* Content for different node types */}
          {isQuadrant ? (
            // Overview: Clean quadrant view - only show the name
            width > 60 &&
            height > 60 && (
              <text
                x={x + width / 2}
                y={y + height / 2}
                textAnchor="middle"
                fill="white"
                fontSize={18}
                fontWeight="bold"
                className="distribution-treemap-text"
                style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
              >
                {name}
              </text>
            )
          ) : isPR ? (
            // PR nodes: Show PR number and truncated title with language indicator
            width > 60 &&
            height > 40 && (
              <>
                <text
                  x={x + width / 2}
                  y={y + height / 2 - 8}
                  textAnchor="middle"
                  fill="white"
                  fontSize={14}
                  fontWeight="bold"
                  className="distribution-treemap-text"
                  style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                >
                  {name}
                </text>
                {width > 80 && height > 60 && (
                  <text
                    x={x + width / 2}
                    y={y + height / 2 + 10}
                    textAnchor="middle"
                    fill="white"
                    fontSize={10}
                    className="distribution-treemap-text"
                    style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                  >
                    {title && title.length > 20 ? title.slice(0, 20) + '...' : title}
                  </text>
                )}
                {width > 100 && height > 80 && language && (
                  <text
                    x={x + width / 2}
                    y={y + height / 2 + 24}
                    textAnchor="middle"
                    fill="white"
                    fontSize={8}
                    className="distribution-treemap-text"
                    style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)', opacity: 0.9 }}
                  >
                    {language}
                  </text>
                )}
              </>
            )
          ) : (
            // Contributor nodes: Avatar-only
            <>
              {isOthers
                ? // Others node with icon - not clickable since it represents multiple users
                  width > 40 &&
                  height > 40 && (
                    <foreignObject
                      x={x + width / 2 - 16}
                      y={y + height / 2 - 16}
                      width={32}
                      height={32}
                      style={{ pointerEvents: 'none' }}
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
                      className={`treemap-avatar-container ${showTransition ? 'avatar-fade-in' : ''}`}
                      style={{
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        background: 'transparent',
                      }}
                      onClick={handleClick}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div style={{ background: 'transparent', width: '100%', height: '100%' }}>
                        <OptimizedAvatar
                          className="w-full h-full border-2 border-white cursor-pointer"
                          src={(() => {
                            // Try to get cached avatar URL
                            if (avatar_url) {
                              const match = avatar_url.match(/u\/(\d+)/);
                              const githubId = match
                                ? parseInt(match[1])
                                : // Fallback: use a deterministic hash based on login
                                  Math.abs(
                                    (login || '').split('').reduce((a: number, b: string) => {
                                      a = (a << 5) - a + b.charCodeAt(0);
                                      return a & a;
                                    }, 0),
                                  );

                              return cachedAvatars.get(githubId) || avatar_url;
                            }
                            return avatar_url;
                          })()}
                          alt={login || 'Contributor'}
                          fallback={(login || 'U').slice(0, 2).toUpperCase()}
                          size={Math.min(60, Math.min(width, height) * 0.6) as any}
                          lazy={true}
                          priority={false}
                        />
                      </div>
                    </foreignObject>
                  )}
            </>
          )}
        </g>
      );
    },
    [
      currentView,
      selectedQuadrant,
      onDrillDown,
      onContributorClick,
      onPRClick,
      onNodeClick,
      isTransitioning,
      nodeHoverStates,
      cachedAvatars,
    ],
  );

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: any }>;
  }) => {
    if (active && payload && payload[0]) {
      const _data = payload[0].payload;
      const isContributor = currentView === 'quadrant';
      const isPR = currentView === 'contributor';

      // Only show tooltip for contributors and PRs in drill-down views
      if (!isContributor && !isPR) {
        return null;
      }

      return (
        <div className="bg-background border rounded-lg shadow-lg p-3 max-w-sm">
          {isPR ? (
            // PR tooltip
            <>
              <div className="flex items-center gap-2 mb-2">
                <p className="font-semibold text-sm">{data.name}</p>
                {data.language && (
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: data.languageColor }}
                      title={data.language}
                    />
                    <span className="text-xs text-muted-foreground">{data.language}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">{data.title}</p>
              {data.pr && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Size: +{data.pr.additions || 0} -{data.pr.deletions || 0} lines
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.pr.user?.login} • {new Date(_data.pr.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs font-medium text-primary">Click to open PR →</p>
                </div>
              )}
            </>
          ) : (
            // Contributor tooltip
            <>
              {data.login === 'others' ? (
                <>
                  <p className="font-semibold text-sm">{data.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {data.value} PRs from remaining contributors
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-sm">{data.login || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {data.value} PRs in{' '}
                    {QUADRANT_INFO[selectedQuadrant as keyof typeof QUADRANT_INFO]?.label}
                  </p>
                  {hoveredPRs.length > 0 && (
                    <div className="space-y-1 pr-preview">
                      <p className="text-xs font-medium text-muted-foreground">Recent PRs:</p>
                      {hoveredPRs.map((pr) => (
                        <div key={pr.id} className="text-xs">
                          <span className="text-muted-foreground">#{pr.number}</span> -
                          <span className="ml-1 line-clamp-1">{pr.title}</span>
                        </div>
                      ))}
                      {data.prs && data.prs.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          +{data.prs.length - 5} more PRs
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-xs font-medium text-primary mt-2">Click to view PRs →</p>
                </>
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
      <div className="flex items-center gap-2">
        {currentView === 'contributor' && selectedQuadrant && selectedContributor ? (
          <>
            <Button variant="ghost" size="sm" onClick={onDrillUp} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              Contributors
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">
              {(() => {
                const quadrant = data?.children?.find(
                  (q: QuadrantNode) => q.id === selectedQuadrant,
                );
                const contributor = quadrant?.children?.find(
                  (c: unknown) => c.id === selectedContributor,
                );
                return contributor?.login || 'PRs';
              })()}
            </span>
          </>
        ) : currentView === 'quadrant' && selectedQuadrant ? (
          <>
            <Button variant="ghost" size="sm" onClick={onDrillUp} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              All Contributions
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">
              {QUADRANT_INFO[selectedQuadrant as keyof typeof QUADRANT_INFO]?.label ||
                selectedQuadrant}
            </span>
          </>
        ) : (
          <span className="font-medium">All Contributions</span>
        )}
      </div>

      <div className="treemap-container">
        <div
          className={`treemap-view ${
            viewAnimation === 'drill-in'
              ? 'treemap-drill-in'
              : viewAnimation === 'drill-out'
                ? 'treemap-drill-out'
                : ''
          }`}
        >
          <ProgressiveChart
            skeleton={<SkeletonChart variant="quadrant" height="lg" showAxes={false} />}
            highFidelity={
              <ResponsiveContainer width="100%" height={420} minHeight={420}>
                <Treemap
                  data={getTreemapData()}
                  dataKey="value"
                  aspectRatio={4 / 3}
                  content={CustomTreemapContent as any}
                  animationBegin={0}
                  animationDuration={300}
                  isAnimationActive={true}
                >
                  {(currentView === 'quadrant' || currentView === 'contributor') && (
                    <Tooltip content={<CustomTooltip />} />
                  )}
                </Treemap>
              </ResponsiveContainer>
            }
            priority={false}
            highFiDelay={200}
            className="h-[420px] w-full"
          />
        </div>
      </div>
    </div>
  );
}

const QUADRANT_INFO = {
  refinement: { label: 'Refinement' },
  new: { label: 'New Features' },
  refactoring: { label: 'Refactoring' },
  maintenance: { label: 'Maintenance' },
};
