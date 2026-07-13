import { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContributionsScatterChart } from './contributions-scatter-chart';
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
import { Link } from 'react-router';
import { YoloIcon } from '@/components/icons/YoloIcon';
import { ArrowRight } from '@/components/ui/icon';
import { LearnMoreLink } from '@/components/ui/learn-more-link';

// A single plotted PR point (recharts passes this back as the shape/tooltip payload)
interface ScatterPointDatum {
  x: number;
  y: number;
  id: string;
  contributor: string;
  image: string;
  showAvatar?: boolean;
  zIndex?: number;
  _pr: PullRequest;
}

// Props recharts provides to a custom Scatter `shape` component
interface ScatterNodeProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: ScatterPointDatum;
}

import { humanizeNumber } from '@/lib/utils';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import { useTimeRange } from '@/lib/time-range-store';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { PullRequest } from '@/lib/types';
import { PrHoverCard } from '../contributor/pr-hover-card';
import { useParams } from 'react-router';
import { maintainerRolesCache } from '@/lib/maintainer-roles-cache';

interface ContributionsChartProps {
  isRepositoryTracked?: boolean;
}

/**
 * Generates an accessible summary of scatter plot data for screen readers
 */
function generateChartSummary(
  data: Array<{ id: string; data: Array<{ contributor: string; x: number; y: number }> }>,
  effectiveTimeRange: number
): string {
  if (!data[0]?.data?.length) {
    return 'No pull request data available.';
  }

  const points = data[0].data;
  const totalPRs = points.length;

  // Find top contributor (most PRs)
  const contributorCounts = new Map<string, number>();
  points.forEach((p) => {
    contributorCounts.set(p.contributor, (contributorCounts.get(p.contributor) || 0) + 1);
  });
  const topContributor = [...contributorCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Find largest PR
  const maxLines = Math.max(...points.map((p) => p.y));

  // Calculate average lines
  const avgLines = Math.round(points.reduce((sum, p) => sum + p.y, 0) / totalPRs);

  return (
    `This scatter plot shows ${totalPRs} pull requests over the last ${effectiveTimeRange} days. ` +
    `Most active contributor: ${topContributor?.[0] || 'unknown'} with ${topContributor?.[1] || 0} pull requests. ` +
    `Largest pull request: ${maxLines.toLocaleString()} lines changed. ` +
    `Average lines per pull request: ${avgLines.toLocaleString()}.`
  );
}

function ContributionsChart({ isRepositoryTracked = true }: ContributionsChartProps) {
  const {
    stats,
    directCommitsData,
    includeBots: contextIncludeBots,
  } = useContext(RepoStatsContext);
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

  // Custom node for scatter plot points (recharts Scatter `shape` component)
  const CustomNode = (props: ScatterNodeProps) => {
    // Defensive check for required props
    if (typeof props.cx !== 'number' || typeof props.cy !== 'number' || !props.payload) {
      return null;
    }

    const point = props.payload;
    const nodeIndex = props.index ?? 0;

    // Get maintainer status from cache (fast lookup)
    const isMaintainer =
      owner && repo && point.contributor
        ? maintainerRolesCache.isMaintainer(owner, repo, point.contributor)
        : false;

    const size = isMobile ? 28 : 35;

    // Center the node on the data point, clamped to the plot like the
    // previous implementation
    const xPos = Math.max(size / 2, props.cx - size / 2);
    const yPos = Math.max(0, props.cy - size / 2);

    // Check if we should show avatar or gray square (mobile optimization)
    const shouldShowAvatar = point.showAvatar !== false;

    // Safari has issues with foreignObject, so use a simpler approach
    if (isSafari) {
      // For Safari, use SVG elements directly without foreignObject
      const radius = size / 2;

      // Gray square for contributions beyond the unique avatar limit
      if (!shouldShowAvatar) {
        const squareSize = size * 0.6; // Smaller square to be less prominent
        return (
          <g transform={`translate(${xPos}, ${yPos})`} style={{ isolation: 'isolate' }}>
            <rect
              className="contribution-square"
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
              aria-label={`Additional pull request #${point._pr.number} by ${point.contributor}`}
              style={{ cursor: 'pointer', opacity: 0.6 }}
              onClick={() => {
                const prUrl =
                  point._pr.html_url ||
                  `https://github.com/${point._pr.repository_owner}/${point._pr.repository_name}/pull/${point._pr.number}`;
                window.open(prUrl, '_blank', 'noopener,noreferrer');
              }}
            />
            <title>
              {point.contributor} - PR #{point._pr.number}
            </title>
          </g>
        );
      }

      return (
        <g transform={`translate(${xPos}, ${yPos})`} style={{ isolation: 'isolate' }}>
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
            <clipPath id={`avatar-clip-${point.contributor}-${nodeIndex}`}>
              <circle cx={radius} cy={radius} r={radius - 2} />
            </clipPath>
          </defs>

          {/* Avatar image */}
          <image
            href={point.image}
            x="2"
            y="2"
            width={size - 4}
            height={size - 4}
            clipPath={`url(#avatar-clip-${point.contributor}-${nodeIndex})`}
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
            {point.contributor ? point.contributor[0].toUpperCase() : '?'}
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
                point._pr.html_url ||
                `https://github.com/${point._pr.repository_owner}/${point._pr.repository_name}/pull/${point._pr.number}`;
              window.open(prUrl, '_blank', 'noopener,noreferrer');
            }}
          >
            <title>
              {point.contributor} - PR #{point._pr.number}
            </title>
          </circle>
        </g>
      );
    }

    // Original implementation for non-Safari browsers

    // Gray square for contributions beyond the unique avatar limit
    if (!shouldShowAvatar) {
      const squareSize = size * 0.6; // Smaller square to be less prominent
      return (
        <foreignObject
          x={xPos}
          y={yPos}
          width={size}
          height={size}
          style={{ overflow: 'visible', pointerEvents: 'auto' }}
        >
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
              className="contribution-square"
              role="button"
              tabIndex={0}
              aria-label={`Additional pull request #${point._pr.number} by ${point.contributor}`}
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
                  point._pr.html_url ||
                  `https://github.com/${point._pr.repository_owner}/${point._pr.repository_name}/pull/${point._pr.number}`;
                window.open(prUrl, '_blank', 'noopener,noreferrer');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  const prUrl =
                    point._pr.html_url ||
                    `https://github.com/${point._pr.repository_owner}/${point._pr.repository_name}/pull/${point._pr.number}`;
                  window.open(prUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              title={`${point.contributor} - PR #${point._pr.number}`}
            />
          </div>
        </foreignObject>
      );
    }

    return (
      <foreignObject
        x={xPos}
        y={yPos}
        width={size}
        height={size}
        style={{ overflow: 'visible', pointerEvents: 'auto' }}
      >
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
              owner && repo && point.contributor
                ? maintainerRolesCache.getContributorRole(owner, repo, point.contributor)
                : null;
            const displayRole = cachedRole
              ? getUserRole({ role: cachedRole.role }, { type: point._pr.user.type })
              : getUserRole(undefined, { type: point._pr.user.type });

            return (
              <PrHoverCard pullRequest={point._pr} role={displayRole}>
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
                    aria-label={`Pull request #${point._pr.number} by ${point.contributor}`}
                    aria-describedby={isMaintainer ? `maintainer-badge-${point._pr.id}` : undefined}
                    onClick={() => {
                      // Open PR in new tab on click
                      const prUrl =
                        point._pr.html_url ||
                        `https://github.com/${point._pr.repository_owner}/${point._pr.repository_name}/pull/${point._pr.number}`;
                      window.open(prUrl, '_blank', 'noopener,noreferrer');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const prUrl =
                          point._pr.html_url ||
                          `https://github.com/${point._pr.repository_owner}/${point._pr.repository_name}/pull/${point._pr.number}`;
                        window.open(prUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    <AvatarImage
                      src={point.image}
                      alt={`${point.contributor}'s avatar`}
                      loading="lazy"
                      style={{
                        // Ensure images load properly in SVG context
                        objectFit: 'cover',
                        width: '100%',
                        height: '100%',
                      }}
                      crossOrigin="anonymous"
                      onError={(e) => {
                        // On error, hide the image and show fallback (handled by AvatarFallback)
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <AvatarFallback
                      style={{
                        backgroundColor: 'var(--muted)',
                        color: 'var(--muted-foreground)',
                        fontSize: isMobile ? '10px' : '12px',
                      }}
                    >
                      {point.contributor ? point.contributor[0].toUpperCase() : '?'}
                    </AvatarFallback>
                  </Avatar>
                  {isMaintainer && (
                    <span
                      id={`maintainer-badge-${point._pr.id}`}
                      title="Maintainer"
                      aria-label={`${point.contributor} is a maintainer`}
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
      </foreignObject>
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
  // Flat point list for the recharts Scatter series (single series: pull requests)
  const scatterPoints: ScatterPointDatum[] = data[0]?.data ?? [];
  const botCount = safeStats.pullRequests.filter(
    (pr) => detectBot({ githubUser: pr.user }).isBot
  ).length;
  const hasBots = botCount > 0;

  // Generate accessible summary for screen readers
  const chartSummary = useMemo(
    () => generateChartSummary(data, isMobile ? mobileMaxDays : effectiveTimeRangeNumber),
    [data, isMobile, effectiveTimeRangeNumber]
  );

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

  // Check if YOLO button should be shown
  const showYoloButton = directCommitsData?.hasYoloCoders === true;

  return (
    <div className="space-y-4 w-full overflow-hidden" data-tour="leaderboard">
      <div
        className={`flex flex-col gap-4 pt-3 ${isMobile ? 'px-2' : 'md:px-7'} shareable-desktop-only`}
      >
        {showYoloButton && owner && repo && (
          <Link
            to={`/repo/${owner}/${repo}/health`}
            className="flex items-center justify-between text-slate-500 shadow-sm !border !border-slate-300 p-1 gap-2 text-sm rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-fit"
          >
            <div className="flex gap-2 items-center min-w-0">
              <div className="flex items-center font-medium gap-1 px-2 py-0.5 rounded-2xl bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 flex-shrink-0">
                <YoloIcon className="h-4 w-4" />
                <span className="hidden sm:inline">YOLO Coders</span>
                <span className="sm:hidden">YOLO</span>
              </div>
              <p
                className="text-sm hidden sm:inline text-muted-foreground"
                style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                Pushing commits directly to main
              </p>
            </div>

            <div className="flex gap-1 items-center mr-1 sm:mr-2 flex-shrink-0">
              <span className="text-sm hidden sm:inline">See more</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span>{data[0]?.data?.length ?? 0} pull requests shown</span>
            <LearnMoreLink
              href="https://docs.contributor.info/features/contribution-analytics"
              feature="contribution_analytics"
              source="contributions_chart"
            />
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
      <div
        className={`${isMobile ? 'h-[280px]' : 'h-[400px]'} w-full overflow-hidden relative`}
        role="figure"
        aria-labelledby="scatter-chart-title"
        aria-describedby="scatter-chart-desc"
      >
        <h3 id="scatter-chart-title" className="sr-only">
          Pull Request Contributions Over Time
        </h3>
        <div id="scatter-chart-desc" className="sr-only">
          {chartSummary}
        </div>
        <ProgressiveChart
          skeleton={
            <SkeletonChart variant="scatter" height={isMobile ? 'sm' : 'lg'} showAxes={true} />
          }
          highFidelity={
            data.length > 0 ? (
              <ContributionsScatterChart
                points={scatterPoints}
                pointKey={(point) => point.id}
                xMax={Math.max(isMobile ? mobileMaxDays : effectiveTimeRangeNumber, 1)}
                yMax={Math.max(Math.round(maxFilesModified * 1.5), 10)}
                logScale={isLogarithmic}
                margin={{
                  top: 20,
                  right: isMobile ? 30 : 60,
                  bottom: isMobile ? 45 : 70,
                  left: isMobile ? 35 : 90,
                }}
                showXAxis={effectiveTimeRangeNumber > 0}
                showYAxis={maxFilesModified > 0}
                xTickCount={isMobile ? 3 : 7}
                yTickCount={isMobile ? 3 : 5}
                xTickFormatter={(value) => {
                  if (value === 0) return 'Today';
                  if (value > effectiveTimeRangeNumber) return `${effectiveTimeRangeNumber}+`;
                  return `${value}`;
                }}
                yTickFormatter={(value) =>
                  value >= 1000 ? humanizeNumber(value) : `${Math.round(value)}`
                }
                xLabel="Days Ago"
                yLabel="Lines Touched"
                xLabelOffset={isMobile ? 35 : 50}
                yLabelOffset={isMobile ? -20 : -60}
                renderNode={(point, cx, cy, index) => (
                  <CustomNode cx={cx} cy={cy} payload={point} index={index} />
                )}
                renderTooltip={
                  isMobile
                    ? undefined
                    : (point) => {
                        const daysAgo = Math.floor(point.x);
                        return (
                          <div className="bg-background border rounded p-2 shadow-lg">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                // Same blue the previous nivo series color (category10) used
                                style={{ backgroundColor: '#1f77b4' }}
                              />
                              <span className="font-medium">{point.contributor}</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {daysAgo === 0 ? 'Today' : `${daysAgo} days ago`} •{' '}
                              {Math.round(point.y)} lines touched
                            </div>
                          </div>
                        );
                      }
                }
              />
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
