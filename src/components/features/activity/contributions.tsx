import { useState, useContext, useEffect, useRef, lazy, Suspense } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { animated } from '@react-spring/web';
import { supabaseAvatarCache } from '@/lib/supabase-avatar-cache';
import { ProgressiveChart } from '@/components/ui/charts/ProgressiveChart';
import { SkeletonChart } from '@/components/skeletons/base/skeleton-chart';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { getUserRole } from '@/lib/utils/data-type-mapping';
import {
  processContributionVisualization,
  type ContributionDataPoint,
} from '@/lib/utils/contribution-visualization';
import { detectBot } from '@/lib/utils/bot-detection';

// Lazy load the ScatterPlot component to reduce initial bundle size
const ResponsiveScatterPlot = lazy(() =>
  import('@nivo/scatterplot').then((module) => ({
    default: module.ResponsiveScatterPlot,
  }))
);

// Type definition for CustomNode data
interface CustomNodeData {
  contributor: string;
  image: string;
  showAvatar?: boolean;
  _pr: PullRequest;
  x: number;
  y: number;
  [key: string]: unknown; // Allow additional properties from ScatterPlot
}

// Import types separately since they don't affect bundle size
// import type { ScatterPlotNodeProps } from "@nivo/scatterplot";
import { humanizeNumber } from '@/lib/utils';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import { useTimeRange } from '@/lib/time-range-store';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { PullRequest } from '@/lib/types';
import { PrHoverCard } from '../contributor/pr-hover-card';
import { useParams } from 'react-router-dom';
import { maintainerRolesCache } from '@/lib/maintainer-roles-cache';

interface ContributionsChartProps {
  isRepositoryTracked?: boolean;
}

function ContributionsChart({ isRepositoryTracked = true }: ContributionsChartProps) {
  const { stats, includeBots: contextIncludeBots } = useContext(RepoStatsContext);
  const { effectiveTimeRange } = useTimeRange();
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  // Enhanced mode (logarithmic scale) defaults to on for clarity
  const [isLogarithmic, setIsLogarithmic] = useState(true);
  const [maxFilesModified, setMaxFilesModified] = useState(10);
  const [localIncludeBots, setLocalIncludeBots] = useState(contextIncludeBots);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'merged' | 'closed'>('all');
  const safeStats = stats || { pullRequests: [], loading: false, error: null };
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  const [cachedAvatars, setCachedAvatars] = useState<Map<number, string>>(new Map());
  const effectiveTimeRangeNumber = parseInt(effectiveTimeRange, 10);
  const mobileMaxDays = 14; // Show 14 days of data for mobile

  const functionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Track if user has manually toggled the enhancement
  const userHasManuallyToggled = useRef(false);
  const wasMobileRef = useRef(isMobile);

  // Add resize listener to update isMobile state with throttling
  useEffect(() => {
    const handleResize = () => {
      if (functionTimeout.current) {
        clearTimeout(functionTimeout.current);
      }
      functionTimeout.current = setTimeout(() => {
        const newIsMobile = window.innerWidth < 768;
        const wasMobile = wasMobileRef.current;
        setIsMobile(newIsMobile);
        wasMobileRef.current = newIsMobile;

        // Auto-enable enhanced mode when switching to mobile
        // Only if user hasn't manually toggled the setting
        if (newIsMobile && !wasMobile && !userHasManuallyToggled.current) {
          setIsLogarithmic(true);
        }
      }, 250); // Increased throttle for better performance on low-end devices
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      if (functionTimeout.current) {
        clearTimeout(functionTimeout.current);
      }
    };
  }, []); // Empty dependency array - resize handler doesn't need to re-register

  useEffect(() => {
    // Calculate max files modified for scale
    if (safeStats.pullRequests && safeStats.pullRequests.length > 0) {
      const maxLines = Math.max(...safeStats.pullRequests.map((pr) => pr.additions + pr.deletions));
      setMaxFilesModified(maxLines);
    }
  }, [safeStats.pullRequests]);

  // Sync local state with context state when context changes
  useEffect(() => {
    setLocalIncludeBots(contextIncludeBots);
  }, [contextIncludeBots]);

  // Preload maintainer roles for performance
  useEffect(() => {
    if (owner && repo) {
      maintainerRolesCache.getRoles(owner, repo).catch((error) => {
        console.warn('Failed to preload maintainer roles:', error);
      });
    }
  }, [owner, repo]);

  // Load cached avatars when PR data changes
  useEffect(() => {
    const loadCachedAvatars = async () => {
      if (!safeStats.pullRequests?.length) return;

      // Extract unique contributors
      const contributors = Array.from(
        new Map(
          safeStats.pullRequests.map((pr) => [
            pr.user.id,
            {
              githubId: pr.user.id,
              username: pr.user.login,
              fallbackUrl: pr.user.avatar_url,
            },
          ])
        ).values()
      );

      try {
        // Batch load cached avatars
        const avatarResults = await supabaseAvatarCache.getAvatarUrls(contributors);

        // Convert to Map for component state
        const avatarMap = new Map<number, string>();
        avatarResults.forEach((result, githubId) => {
          avatarMap.set(githubId, result.url);
        });

        setCachedAvatars(avatarMap);
      } catch {
        // Fallback to original URLs on error
        const fallbackMap = new Map<number, string>();
        contributors.forEach((c) => {
          if (c.fallbackUrl) {
            fallbackMap.set(c.githubId, c.fallbackUrl);
          }
        });
        setCachedAvatars(fallbackMap);
      }
    };

    loadCachedAvatars();
  }, [safeStats.pullRequests]);

  const getScatterData = () => {
    // Guard against undefined or null pullRequests
    if (!safeStats?.pullRequests || !Array.isArray(safeStats.pullRequests)) {
      return [];
    }

    try {
      // Sort by created_at and filter based on preferences
      const filteredPRs = [...safeStats.pullRequests]
        .filter((pr) => localIncludeBots || !detectBot({ githubUser: pr.user }).isBot)
        .filter((pr) => {
          if (statusFilter === 'all') return pr.state === 'open' || pr.merged_at !== null;
          if (statusFilter === 'open') return pr.state === 'open';
          if (statusFilter === 'closed') return pr.state === 'closed' && !pr.merged_at;
          if (statusFilter === 'merged') return pr.merged_at !== null;
          return true;
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Group PRs by day to implement quarter-based staggering
      const prsByDay = new Map<number, PullRequest[]>();

      // First pass: create base contribution data
      const baseContributions: ContributionDataPoint[] = filteredPRs
        .map((pr) => {
          const daysAgo = Math.floor(
            (new Date().getTime() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          // Skip PRs older than our limit
          if (
            (isMobile && daysAgo > mobileMaxDays) ||
            (!isMobile && daysAgo > effectiveTimeRangeNumber)
          ) {
            return null;
          }

          const linesTouched = pr.additions + pr.deletions;
          // Use cached avatar URL with fallback to original
          const cachedUrl = cachedAvatars.get(pr.user.id) || pr.user.avatar_url;
          const avatarUrl = getAvatarUrl(pr.user.login, cachedUrl);

          // Group PRs by day for staggering
          if (!prsByDay.has(daysAgo)) {
            prsByDay.set(daysAgo, []);
          }
          const dayGroup = prsByDay.get(daysAgo);
          if (dayGroup) {
            dayGroup.push(pr);
          }

          return {
            x: daysAgo,
            y: Math.max(linesTouched, 1), // Ensure minimum visibility of 1 line
            id: `pr-${pr.id}`,
            author: pr.user.login,
            avatar: avatarUrl,
            prNumber: pr.number,
            prTitle: pr.title,
            zIndex: 0, // Will be updated by processContributionVisualization
            // showAsAvatar is optional and will be set by processContributionVisualization
            _pr: pr, // Store full PR for hover card (not in interface but preserved)
          } as ContributionDataPoint & { _pr: PullRequest };
        })
        .filter((item): item is ContributionDataPoint & { _pr: PullRequest } => item !== null);

      // Apply staggering to x positions
      const staggeredContributions = baseContributions.map((item) => {
        const dayGroup = prsByDay.get(Math.floor(item.x)) || [];
        const indexInDay = dayGroup.findIndex((pr) => `pr-${pr.id}` === item.id);
        const dayGroupSize = dayGroup.length;

        let xOffset = 0;
        let yJitter = 0;

        if (isMobile) {
          // Dynamic staggering: more positions for dense days
          const maxPositions = Math.min(dayGroupSize, 8); // Up to 8 positions per day
          const staggerRange = 0.8; // Use 80% of day width for staggering

          if (maxPositions > 1) {
            // Distribute evenly across the stagger range
            xOffset = (indexInDay / (maxPositions - 1)) * staggerRange;
          }

          // Add micro Y-jitter for very dense days (>4 PRs)
          if (dayGroupSize > 4) {
            const jitterAmount = Math.min(item.y * 0.03, 2); // Max 3% of y-value or 2 lines
            yJitter = ((indexInDay % 3) - 1) * jitterAmount; // -1, 0, 1 pattern
          }
        }

        return {
          ...item,
          x: item.x + xOffset,
          y: Math.max(1, item.y + yJitter), // Ensure y >= 1
        };
      });

      // Process unique contributors using the utility function
      const visualizationOptions = {
        maxUniqueAvatars: isMobile ? 25 : 50,
        avatarSize: isMobile ? 28 : 35,
        graySquareSize: isMobile ? 17 : 21,
        graySquareOpacity: 0.6,
      };

      const { processedData: sortedContributions } = processContributionVisualization(
        staggeredContributions,
        visualizationOptions
      );

      // Preserve the _pr property for hover cards
      const staggeredData = sortedContributions.map((item) => ({
        ...item,
        contributor: item.author,
        image: item.avatar,
        showAvatar: item.showAsAvatar,
        _pr: (
          baseContributions.find((c) => c.id === item.id) as ContributionDataPoint & {
            _pr: PullRequest;
          }
        )?._pr,
      }));

      return [
        {
          id: 'pull-requests',
          data: staggeredData,
        },
      ];
    } catch (error) {
      console.error('Error generating scatter plot data:', error);
      return [];
    }
  };

  // Detect Safari browser (SSR-safe)
  const isSafari =
    typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Custom Node for scatter plot points
  // Using 'any' for props type due to Nivo's complex internal types
  // The data structure is validated at runtime with defensive checks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomNode = (props: any) => {
    // Defensive check for required props
    if (!props || !props.node || !props.node.data) {
      console.warn('CustomNode: Missing required props', props);
      return null;
    }

    // Get maintainer status from cache (fast lookup)
    const isMaintainer =
      owner && repo && props.node.data.contributor
        ? maintainerRolesCache.isMaintainer(owner, repo, props.node.data.contributor)
        : false;

    const size = isMobile ? 28 : 35;

    // Handle different animation prop formats from Nivo
    // Check if we have animated values or static values
    const hasAnimatedStyle = props.style && typeof props.style === 'object';
    const isSpringValue = (val: unknown): val is { to: (fn: (v: number) => number) => number } =>
      val !== null &&
      typeof val === 'object' &&
      'to' in val &&
      typeof (val as { to?: unknown }).to === 'function';

    // Calculate x and y positions
    let xPos = 0;
    let yPos = 0;

    if (hasAnimatedStyle && props.style) {
      // Handle Spring animated values
      const styleX = (props.style as Record<string, unknown>).x;
      const styleY = (props.style as Record<string, unknown>).y;

      if (isSpringValue(styleX)) {
        xPos = styleX.to((xVal: number) => Math.max(size / 2, xVal - size / 2));
      } else if (typeof styleX === 'number') {
        xPos = Math.max(size / 2, styleX - size / 2);
      }

      if (isSpringValue(styleY)) {
        yPos = styleY.to((yVal: number) => Math.max(0, yVal - size / 2));
      } else if (typeof styleY === 'number') {
        yPos = Math.max(0, styleY - size / 2);
      }
    }

    // Build the style object based on what we have
    // Using Record type for animated styles that may have Spring values
    const nodeStyle: Record<string, unknown> = hasAnimatedStyle
      ? {
          ...props.style,
          x: xPos,
          y: yPos,
          pointerEvents: 'auto',
          overflow: 'visible',
          isolation: 'isolate',
        }
      : {
          x: xPos,
          y: yPos,
          pointerEvents: 'auto',
          overflow: 'visible',
          isolation: 'isolate',
        };

    // Check if we should show avatar or gray square (mobile optimization)
    const shouldShowAvatar = props.node.data.showAvatar !== false;

    // Safari has issues with foreignObject, so use a simpler approach
    if (isSafari) {
      // For Safari, use SVG elements directly without foreignObject
      const radius = size / 2;

      // Gray square for contributions beyond the unique avatar limit
      if (!shouldShowAvatar) {
        const squareSize = size * 0.6; // Smaller square to be less prominent
        return (
          <animated.g style={nodeStyle}>
            <rect
              x={(size - squareSize) / 2}
              y={(size - squareSize) / 2}
              width={squareSize}
              height={squareSize}
              fill="hsl(var(--muted-foreground) / 0.2)"
              stroke="hsl(var(--border) / 0.5)"
              strokeWidth="1"
              rx="2"
              role="button"
              tabIndex={0}
              aria-label={`Additional pull request #${props.node.data._pr.number} by ${props.node.data.contributor}`}
              style={{ cursor: 'pointer', opacity: 0.6 }}
              onClick={() => {
                const prUrl =
                  props.node.data._pr.html_url ||
                  `https://github.com/${props.node.data._pr.repository_owner}/${props.node.data._pr.repository_name}/pull/${props.node.data._pr.number}`;
                window.open(prUrl, '_blank', 'noopener,noreferrer');
              }}
            />
            <title>
              {props.node.data.contributor} - PR #{props.node.data._pr.number}
            </title>
          </animated.g>
        );
      }

      return (
        <animated.g style={nodeStyle}>
          {/* Background circle */}
          <circle
            cx={radius}
            cy={radius}
            r={radius - 1}
            fill="hsl(var(--muted))"
            stroke="hsl(var(--foreground))"
            strokeWidth="2"
            style={{ cursor: 'pointer' }}
          />

          {/* Clipping path for circular image */}
          <defs>
            <clipPath id={`avatar-clip-${props.node.data.contributor}-${props.node.index}`}>
              <circle cx={radius} cy={radius} r={radius - 2} />
            </clipPath>
          </defs>

          {/* Avatar image */}
          <image
            href={props.node.data.image}
            x="2"
            y="2"
            width={size - 4}
            height={size - 4}
            clipPath={`url(#avatar-clip-${props.node.data.contributor}-${props.node.index})`}
            preserveAspectRatio="xMidYMid slice"
            style={{ pointerEvents: 'none' }}
          />

          {/* Fallback text if image fails to load */}
          <text
            x={radius}
            y={radius}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="hsl(var(--foreground))"
            fontSize={isMobile ? 10 : 12}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {props.node.data.contributor ? props.node.data.contributor[0].toUpperCase() : '?'}
          </text>

          {/* Invisible overlay for hover interactions */}
          <circle
            cx={radius}
            cy={radius}
            r={radius}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              // Open PR in new tab on click for Safari
              const prUrl =
                props.node.data._pr.html_url ||
                `https://github.com/${props.node.data._pr.repository_owner}/${props.node.data._pr.repository_name}/pull/${props.node.data._pr.number}`;
              window.open(prUrl, '_blank', 'noopener,noreferrer');
            }}
          >
            <title>
              {props.node.data.contributor} - PR #{props.node.data._pr.number}
            </title>
          </circle>
        </animated.g>
      );
    }

    // Original implementation for non-Safari browsers

    // Gray square for contributions beyond the unique avatar limit
    if (!shouldShowAvatar) {
      const squareSize = size * 0.6; // Smaller square to be less prominent
      return (
        <animated.foreignObject width={size} height={size} style={nodeStyle}>
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label={`Additional pull request #${props.node.data._pr.number} by ${props.node.data.contributor}`}
              style={{
                width: squareSize,
                height: squareSize,
                backgroundColor: 'hsl(var(--muted-foreground) / 0.2)',
                border: '1px solid hsl(var(--border) / 0.5)',
                borderRadius: '2px',
                cursor: 'pointer',
                opacity: 0.6,
              }}
              onClick={() => {
                const prUrl =
                  props.node.data._pr.html_url ||
                  `https://github.com/${props.node.data._pr.repository_owner}/${props.node.data._pr.repository_name}/pull/${props.node.data._pr.number}`;
                window.open(prUrl, '_blank', 'noopener,noreferrer');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  const prUrl =
                    props.node.data._pr.html_url ||
                    `https://github.com/${props.node.data._pr.repository_owner}/${props.node.data._pr.repository_name}/pull/${props.node.data._pr.number}`;
                  window.open(prUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              title={`${props.node.data.contributor} - PR #${props.node.data._pr.number}`}
            />
          </div>
        </animated.foreignObject>
      );
    }

    return (
      <animated.foreignObject width={size} height={size} style={nodeStyle}>
        <div
          style={{
            width: '100%',
            height: '100%',
            color: 'hsl(var(--foreground))',
            borderColor: 'hsl(var(--foreground))',
          }}
        >
          {(() => {
            // Get role from cache for display (fallback to user type if not cached)
            const cachedRole =
              owner && repo && props.node.data.contributor
                ? maintainerRolesCache.getContributorRole(owner, repo, props.node.data.contributor)
                : null;
            const displayRole = cachedRole
              ? getUserRole({ role: cachedRole.role }, { type: props.node.data._pr.user.type })
              : getUserRole(undefined, { type: props.node.data._pr.user.type });

            return (
              <PrHoverCard pullRequest={props.node.data._pr} role={displayRole}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <Avatar
                    className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} border-2 cursor-pointer`}
                    style={{
                      // Ensure the avatar renders properly in foreignObject
                      backgroundColor: 'var(--muted)',
                      borderColor: 'hsl(var(--foreground))',
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Pull request #${props.node.data._pr.number} by ${props.node.data.contributor}`}
                    aria-describedby={
                      isMaintainer ? `maintainer-badge-${props.node.data._pr.id}` : undefined
                    }
                    onClick={() => {
                      // Open PR in new tab on click
                      const prUrl =
                        props.node.data._pr.html_url ||
                        `https://github.com/${props.node.data._pr.repository_owner}/${props.node.data._pr.repository_name}/pull/${props.node.data._pr.number}`;
                      window.open(prUrl, '_blank', 'noopener,noreferrer');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const prUrl =
                          props.node.data._pr.html_url ||
                          `https://github.com/${props.node.data._pr.repository_owner}/${props.node.data._pr.repository_name}/pull/${props.node.data._pr.number}`;
                        window.open(prUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    <AvatarImage
                      src={props.node.data.image}
                      alt={`${props.node.data.contributor}'s avatar`}
                      loading="lazy"
                      style={{
                        // Ensure images load properly in SVG context
                        objectFit: 'cover',
                        width: '100%',
                        height: '100%',
                      }}
                      crossOrigin="anonymous"
                      onError={(e) => {
                        // Fallback to GitHub avatar API on error, but only once
                        const target = e.target as HTMLImageElement;
                        if (!target.dataset.retried) {
                          target.dataset.retried = 'true';
                          // Use avatars.githubusercontent.com which provides CORS headers
                          // Using user ID if available, otherwise a default avatar
                          const userId = props.node?.data?._pr?.user?.id || 0;
                          target.src = `https://avatars.githubusercontent.com/u/${userId}?v=4`;
                        }
                      }}
                    />
                    <AvatarFallback
                      style={{
                        backgroundColor: 'var(--muted)',
                        color: 'var(--muted-foreground)',
                        fontSize: isMobile ? '10px' : '12px',
                      }}
                    >
                      {props.node.data.contributor
                        ? props.node.data.contributor[0].toUpperCase()
                        : '?'}
                    </AvatarFallback>
                  </Avatar>
                  {isMaintainer && (
                    <span
                      id={`maintainer-badge-${props.node.data._pr.id}`}
                      title="Maintainer"
                      aria-label={`${props.node.data.contributor} is a maintainer`}
                      role="img"
                      className="bg-green-500"
                      style={{
                        position: 'absolute',
                        top: -2,
                        right: -2,
                        width: isMobile ? 10 : 12,
                        height: isMobile ? 10 : 12,
                        borderRadius: '9999px',
                        border: '1px solid hsl(var(--background))',
                        boxShadow: '0 0 0 1px hsl(var(--foreground) / 0.3)',
                      }}
                    />
                  )}
                </div>
              </PrHoverCard>
            );
          })()}
        </div>
      </animated.foreignObject>
    );
  };

  const handleSetLogarithmic = () => {
    if (functionTimeout.current) {
      clearTimeout(functionTimeout.current);
    }
    functionTimeout.current = setTimeout(() => {
      userHasManuallyToggled.current = true; // Mark that user has manually toggled
      setIsLogarithmic(!isLogarithmic);
    }, 50);
  };

  const handleToggleIncludeBots = () => {
    if (functionTimeout.current) {
      clearTimeout(functionTimeout.current);
    }
    functionTimeout.current = setTimeout(() => {
      setLocalIncludeBots(!localIncludeBots);
      // We're not calling setIncludeBots anymore to avoid triggering a global state update
    }, 50);
  };

  const data = getScatterData();
  const botCount = safeStats.pullRequests.filter((pr) => detectBot({ githubUser: pr.user }).isBot).length;
  const hasBots = botCount > 0;

  // Show placeholder when repository is not tracked
  if (!isRepositoryTracked) {
    return (
      <div
        className={`${isMobile ? 'h-[280px]' : 'h-[400px]'} w-full flex items-center justify-center bg-muted/10 rounded-lg border-2 border-dashed border-muted-foreground/20`}
      >
        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            Track this repository to see contribution analytics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full overflow-hidden">
      <div className={`flex flex-col gap-4 pt-3 ${isMobile ? 'px-2' : 'md:px-7'}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {data[0].data.length} pull requests shown
          </div>

          {/* Status Filter Tabs */}
          <div className="flex-shrink-0">
            <Tabs
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as 'all' | 'open' | 'merged' | 'closed')
              }
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all" className="text-xs">
                  All
                </TabsTrigger>
                <TabsTrigger value="open" className="text-xs">
                  Open
                </TabsTrigger>
                <TabsTrigger value="merged" className="text-xs">
                  Merged
                </TabsTrigger>
                <TabsTrigger value="closed" className="text-xs">
                  Closed
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className={`flex flex-wrap gap-2 ${isMobile ? 'w-full' : ''}`}>
            {hasBots && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="include-bots"
                  checked={localIncludeBots}
                  onCheckedChange={handleToggleIncludeBots}
                />
                <Label htmlFor="include-bots" className="text-sm">
                  Show Bots
                </Label>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Switch
                id="logarithmic-scale"
                checked={isLogarithmic}
                onCheckedChange={handleSetLogarithmic}
                aria-describedby="logarithmic-scale-description"
              />
              <Label htmlFor="logarithmic-scale" className="text-sm">
                {isLogarithmic ? 'Enhanced' : 'Enhance'}
              </Label>
              <span id="logarithmic-scale-description" className="sr-only">
                {isLogarithmic
                  ? 'Enhanced view is enabled. Uses logarithmic scale for better visualization of data distribution.'
                  : 'Enable enhanced view for logarithmic scale visualization.'}
              </span>
            </div>
            {/* Visible helper copy specifically for the enhanced toggle */}
            <div className="basis-full text-xs text-muted-foreground">
              Enhanced mode uses a log scale for readability.
            </div>
          </div>
        </div>
      </div>
      <div className={`${isMobile ? 'h-[280px]' : 'h-[400px]'} w-full overflow-hidden relative`}>
        <ProgressiveChart
          skeleton={
            <SkeletonChart variant="scatter" height={isMobile ? 'sm' : 'lg'} showAxes={true} />
          }
          highFidelity={
            data.length > 0 ? (
              <Suspense
                fallback={
                  <SkeletonChart
                    variant="scatter"
                    height={isMobile ? 'sm' : 'lg'}
                    showAxes={true}
                  />
                }
              >
                <ResponsiveScatterPlot
                  nodeSize={isMobile ? 20 : 35}
                  data={data || []}
                  margin={{
                    top: 20,
                    right: isMobile ? 30 : 60,
                    bottom: isMobile ? 45 : 70,
                    left: isMobile ? 35 : 90,
                  }}
                  xScale={{
                    type: 'linear',
                    min: 0,
                    max: Math.max(isMobile ? mobileMaxDays : effectiveTimeRangeNumber, 1),
                    reverse: true,
                  }}
                  yScale={{
                    type: isLogarithmic ? 'symlog' : 'linear',
                    min: 1,
                    max: Math.max(Math.round(maxFilesModified * 1.5), 10),
                  }}
                  blendMode="normal"
                  annotations={[]}
                  nodeComponent={CustomNode}
                  animate={true}
                  motionConfig="gentle"
                  enableGridX={true}
                  enableGridY={true}
                  useMesh={!isMobile}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={
                    effectiveTimeRangeNumber > 0
                      ? {
                          tickSize: 6,
                          tickPadding: 4,
                          tickRotation: 0,
                          tickValues: isMobile ? 3 : 7,
                          legend: 'Days Ago',
                          legendPosition: 'middle',
                          legendOffset: isMobile ? 35 : 50,
                          format: (value) => {
                            if (value === 0) return 'Today';
                            if (value > effectiveTimeRangeNumber)
                              return `${effectiveTimeRangeNumber}+`;
                            return `${value}`;
                          },
                        }
                      : null
                  }
                  isInteractive={true}
                  axisLeft={
                    maxFilesModified > 0
                      ? {
                          tickSize: 2,
                          tickPadding: 3,
                          tickRotation: 0,
                          tickValues: isMobile ? 3 : 5,
                          legend: 'Lines Touched',
                          legendPosition: 'middle',
                          legendOffset: isMobile ? -20 : -60,
                          format: (value: number) => {
                            return parseInt(`${value}`) >= 1000
                              ? humanizeNumber(value)
                              : `${value}`;
                          },
                        }
                      : null
                  }
                  tooltip={({ node }) => {
                    const nodeData = node.data as CustomNodeData;
                    return (
                      <div className="bg-background border rounded p-2 shadow-lg">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: node.color }}
                          />
                          <span className="font-medium">{nodeData.contributor}</span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {nodeData.x === 0 ? 'Today' : `${nodeData.x} days ago`} • {nodeData.y}{' '}
                          lines touched
                        </div>
                      </div>
                    );
                  }}
                  colors={{ scheme: 'category10' }}
                  layers={['grid', 'axes', 'nodes', 'legends']}
                  theme={{
                    background: 'transparent',
                    axis: {
                      domain: {
                        line: {
                          stroke: 'hsl(var(--border))',
                          strokeWidth: 1,
                        },
                      },
                      ticks: {
                        line: {
                          stroke: 'hsl(var(--border))',
                          strokeWidth: 1,
                        },
                        text: {
                          fill: 'hsl(var(--foreground))',
                          fontSize: 11,
                        },
                      },
                      legend: {
                        text: {
                          fill: 'hsl(var(--foreground))',
                          fontSize: 12,
                        },
                      },
                    },
                    grid: {
                      line: {
                        stroke: 'hsl(var(--border))',
                        strokeWidth: 0.5,
                        strokeOpacity: 0.3,
                      },
                    },
                    legends: {
                      text: {
                        fill: 'hsl(var(--foreground))',
                        fontSize: 11,
                      },
                    },
                    labels: {
                      text: {
                        fill: 'hsl(var(--foreground))',
                        fontSize: 11,
                      },
                    },
                    markers: {
                      lineColor: 'hsl(var(--foreground))',
                      lineStrokeWidth: 2,
                      textColor: 'hsl(var(--foreground))',
                    },
                    dots: {
                      text: {
                        fill: 'hsl(var(--foreground))',
                        fontSize: 11,
                      },
                    },
                    annotations: {
                      text: {
                        fill: 'hsl(var(--foreground))',
                        outlineWidth: 2,
                        outlineColor: 'hsl(var(--background))',
                      },
                      link: {
                        stroke: 'hsl(var(--foreground))',
                        strokeWidth: 1,
                        outlineWidth: 2,
                        outlineColor: 'hsl(var(--background))',
                      },
                      outline: {
                        stroke: 'hsl(var(--foreground))',
                        strokeWidth: 2,
                        outlineWidth: 2,
                        outlineColor: 'hsl(var(--background))',
                      },
                      symbol: {
                        fill: 'hsl(var(--foreground))',
                        outlineWidth: 2,
                        outlineColor: 'hsl(var(--background))',
                      },
                    },
                  }}
                />
              </Suspense>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data to display
              </div>
            )
          }
          priority={false}
          highFiDelay={300}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}

// Export ContributionsChart as default
export default ContributionsChart;
