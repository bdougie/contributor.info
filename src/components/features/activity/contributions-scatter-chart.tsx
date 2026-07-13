import { useEffect, useRef, useState, type ReactNode } from 'react';
import { niceLinearTicks, scaleValue } from '@/lib/utils/chart-scales';

/**
 * Hand-rolled SVG scatter plot for the contributions chart.
 *
 * Replaces @nivo/scatterplot (#1815 Phase 3): the Activity tab was loading
 * ~190 kB of nivo + d3 for one chart. Everything nivo did here — reversed
 * linear X, linear/symlog Y, nice ticks, grid, axis legends, custom avatar
 * nodes, a nearest-point hover tooltip — is a few hundred lines of SVG.
 *
 * Axis/grid styling matches the previous nivo theme: CSS-variable tokens
 * only, so light/dark mode is inherited from the document.
 */

export interface ScatterChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface ContributionsScatterChartProps<T extends { x: number; y: number }> {
  points: T[];
  /** Key extractor for stable node identity */
  pointKey: (point: T) => string;
  /** X domain is [0, xMax], drawn reversed: 0 ("today") sits on the right */
  xMax: number;
  /** Y domain is [1, yMax] */
  yMax: number;
  /** Enhanced mode: position Y values on a symlog curve */
  logScale: boolean;
  /** Rendered node diameter (px) — used to keep nodes fully inside the plot */
  nodeSize: number;
  margin: ScatterChartMargin;
  showXAxis: boolean;
  showYAxis: boolean;
  xTickCount: number;
  yTickCount: number;
  xTickFormatter: (value: number) => string;
  yTickFormatter: (value: number) => string;
  xLabel: string;
  yLabel: string;
  /** Distance of the X axis legend below the axis line (px) */
  xLabelOffset: number;
  /** Distance of the Y axis legend left of the axis line (px, negative = further left) */
  yLabelOffset: number;
  renderNode: (point: T, cx: number, cy: number, index: number) => ReactNode;
  /** Nearest-point hover tooltip (desktop); omit to disable */
  renderTooltip?: (point: T) => ReactNode;
}

interface HoverState<T> {
  point: T;
  mouseX: number;
  mouseY: number;
}

const HOVER_RADIUS_PX = 40;

export function ContributionsScatterChart<T extends { x: number; y: number }>({
  points,
  pointKey,
  xMax,
  yMax,
  logScale,
  nodeSize,
  margin,
  showXAxis,
  showYAxis,
  xTickCount,
  yTickCount,
  xTickFormatter,
  yTickFormatter,
  xLabel,
  yLabel,
  xLabelOffset,
  yLabelOffset,
  renderNode,
  renderTooltip,
}: ContributionsScatterChartProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [hover, setHover] = useState<HoverState<T> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);
  const ready = innerWidth > 0 && innerHeight > 0;

  // Reversed X: value 0 (today) maps to the right edge
  const xPx = (value: number) => margin.left + innerWidth - scaleValue(value, 0, xMax, innerWidth);
  const yPx = (value: number) =>
    margin.top + innerHeight - scaleValue(value, 1, yMax, innerHeight, logScale);

  // Clamp node centers so a node (nodeSize square) never leaves the plot area.
  // Without this, points at the domain edges (y=1 rows, "Today" column) hang
  // half outside and cover the axis tick labels.
  const clampCx = (value: number) =>
    Math.min(Math.max(value, margin.left + nodeSize / 2), margin.left + innerWidth - nodeSize / 2);
  const clampCy = (value: number) =>
    Math.min(Math.max(value, margin.top + nodeSize / 2), margin.top + innerHeight - nodeSize / 2);
  const nodeCx = (point: T) => clampCx(xPx(point.x));
  const nodeCy = (point: T) => clampCy(yPx(point.y));

  // Linear tick values in both modes — d3's symlog scale also produces linear
  // tick values and only positions them on the curve, so this matches nivo.
  const xTicks = niceLinearTicks(0, xMax, xTickCount);
  const yTicks = niceLinearTicks(1, yMax, yTickCount);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!renderTooltip || !ready || points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    let nearest: T | null = null;
    let nearestDistSq = HOVER_RADIUS_PX * HOVER_RADIUS_PX;
    for (const point of points) {
      const dx = nodeCx(point) - mx;
      const dy = nodeCy(point) - my;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = point;
      }
    }

    setHover(nearest ? { point: nearest, mouseX: mx, mouseY: my } : null);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {ready && (
        <svg
          width={width}
          height={height}
          onMouseMove={renderTooltip ? handleMouseMove : undefined}
          onMouseLeave={renderTooltip ? () => setHover(null) : undefined}
        >
          {/* Grid */}
          <g aria-hidden="true">
            {xTicks.map((tick) => (
              <line
                key={`grid-x-${tick}`}
                x1={xPx(tick)}
                x2={xPx(tick)}
                y1={margin.top}
                y2={margin.top + innerHeight}
                stroke="hsl(var(--border))"
                strokeWidth={0.5}
                strokeOpacity={0.3}
              />
            ))}
            {yTicks.map((tick) => (
              <line
                key={`grid-y-${tick}`}
                x1={margin.left}
                x2={margin.left + innerWidth}
                y1={yPx(tick)}
                y2={yPx(tick)}
                stroke="hsl(var(--border))"
                strokeWidth={0.5}
                strokeOpacity={0.3}
              />
            ))}
          </g>

          {/* X axis */}
          {showXAxis && (
            <g aria-hidden="true">
              <line
                x1={margin.left}
                x2={margin.left + innerWidth}
                y1={margin.top + innerHeight}
                y2={margin.top + innerHeight}
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />
              {xTicks.map((tick) => (
                <g key={`tick-x-${tick}`}>
                  <line
                    x1={xPx(tick)}
                    x2={xPx(tick)}
                    y1={margin.top + innerHeight}
                    y2={margin.top + innerHeight + 6}
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                  />
                  <text
                    x={xPx(tick)}
                    y={margin.top + innerHeight + 10}
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    fill="hsl(var(--foreground))"
                    fontSize={11}
                  >
                    {xTickFormatter(tick)}
                  </text>
                </g>
              ))}
              <text
                x={margin.left + innerWidth / 2}
                y={margin.top + innerHeight + xLabelOffset}
                textAnchor="middle"
                fill="hsl(var(--foreground))"
                fontSize={12}
              >
                {xLabel}
              </text>
            </g>
          )}

          {/* Y axis */}
          {showYAxis && (
            <g aria-hidden="true">
              <line
                x1={margin.left}
                x2={margin.left}
                y1={margin.top}
                y2={margin.top + innerHeight}
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />
              {yTicks.map((tick) => (
                <g key={`tick-y-${tick}`}>
                  <line
                    x1={margin.left - 2}
                    x2={margin.left}
                    y1={yPx(tick)}
                    y2={yPx(tick)}
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                  />
                  <text
                    x={margin.left - 5}
                    y={yPx(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill="hsl(var(--foreground))"
                    fontSize={11}
                  >
                    {yTickFormatter(tick)}
                  </text>
                </g>
              ))}
              <text
                x={margin.left + yLabelOffset}
                y={margin.top + innerHeight / 2}
                textAnchor="middle"
                fill="hsl(var(--foreground))"
                fontSize={12}
                transform={`rotate(-90, ${margin.left + yLabelOffset}, ${margin.top + innerHeight / 2})`}
              >
                {yLabel}
              </text>
            </g>
          )}

          {/* Nodes */}
          <g>
            {points.map((point, index) => (
              <g key={pointKey(point)}>{renderNode(point, nodeCx(point), nodeCy(point), index)}</g>
            ))}
          </g>
        </svg>
      )}

      {/* Nearest-point hover tooltip (replaces nivo's mesh tooltip) */}
      {hover && renderTooltip && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: Math.min(hover.mouseX + 14, width - 160),
            top: Math.max(hover.mouseY - 14, 0),
            transform: 'translateY(-100%)',
          }}
        >
          {renderTooltip(hover.point)}
        </div>
      )}
    </div>
  );
}
