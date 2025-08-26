import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  size?: number;
  className?: string;
  children?: React.ReactNode;
}

const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
  ({ value, size = 98, className, children, ...props }, ref) => {
    const normalizedValue = Math.min(Math.max(value, 0), 100);
    const halfSize = size / 2;

    // Create the background semicircle path (gray background)
    const backgroundPath = `M${size} ${halfSize}C${size} ${halfSize * 0.735} ${size * 0.8375} ${halfSize * 0.265} ${size * 0.6648} ${halfSize * 0.2927}C${size * 0.4919} ${halfSize * 0.1055} ${size * 0.2204} ${halfSize * 0.0} ${halfSize} 0C${halfSize * 0.7796} ${halfSize * -0.0} ${halfSize * 0.5082} ${halfSize * 0.1055} ${halfSize * 0.2927} ${halfSize * 0.2927}C${halfSize * 0.1055} ${halfSize * 0.4919} ${halfSize * 0.0} ${halfSize * 0.7796} 0 ${halfSize}H${halfSize * 0.16}C${halfSize * 0.16} ${halfSize * 0.7769} ${halfSize * 0.2435} ${halfSize * 0.5529} ${halfSize * 0.4078} ${halfSize * 0.4078}C${halfSize * 0.5529} ${halfSize * 0.2435} ${halfSize * 0.7769} ${halfSize * 0.16} ${halfSize} ${halfSize * 0.16}C${halfSize * 1.2231} ${halfSize * 0.16} ${halfSize * 1.4471} ${halfSize * 0.2435} ${halfSize * 1.5922} ${halfSize * 0.4078}C${halfSize * 1.7565} ${halfSize * 0.5529} ${halfSize * 1.84} ${halfSize * 0.7769} ${halfSize * 1.84} ${halfSize}H${size}Z`;

    // Calculate progress path based on percentage (left to right)
    const getProgressPath = (percentage: number) => {
      if (percentage <= 0) return '';
      if (percentage >= 100) {
        // Full semicircle - complete path from left to right
        return `M0 ${halfSize}C0 ${halfSize * 0.735} ${halfSize * 0.1055} ${halfSize * 0.541} ${halfSize * 0.2927} ${halfSize * 0.2927}C${halfSize * 0.5411} ${halfSize * 0.1055} ${halfSize * 0.7796} 0 ${halfSize} 0C${halfSize * 1.2204} 0 ${halfSize * 1.4589} ${halfSize * 0.1055} ${halfSize * 1.6482} ${halfSize * 0.2927}C${halfSize * 1.8375} ${halfSize * 0.5411} ${size} ${halfSize * 0.735} ${size} ${halfSize}H${size * 0.92}C${size * 0.92} ${halfSize * 0.7769} ${halfSize * 1.7565} ${halfSize * 0.5529} ${halfSize * 1.5922} ${halfSize * 0.4078}C${halfSize * 1.4471} ${halfSize * 0.2435} ${halfSize * 1.2231} ${halfSize * 0.16} ${halfSize} ${halfSize * 0.16}C${halfSize * 0.7769} ${halfSize * 0.16} ${halfSize * 0.5529} ${halfSize * 0.2435} ${halfSize * 0.4078} ${halfSize * 0.4078}C${halfSize * 0.2435} ${halfSize * 0.5529} ${halfSize * 0.16} ${halfSize * 0.7769} ${halfSize * 0.16} ${halfSize}H0Z`;
      }

      // Calculate the angle for the percentage - start from left (π) and move to right (0)
      const angleRadians = Math.PI - (percentage / 100) * Math.PI;

      // Outer arc points
      const outerStartX = 0;
      const outerStartY = halfSize;
      const outerEndX = halfSize + halfSize * Math.cos(angleRadians);
      const outerEndY = halfSize - halfSize * Math.sin(angleRadians);

      // Inner arc points (for donut effect)
      const innerRadius = halfSize * 0.84; // 84% of outer radius to match the card
      const innerStartX = halfSize - innerRadius;
      const innerStartY = halfSize;
      const innerEndX = halfSize + innerRadius * Math.cos(angleRadians);
      const innerEndY = halfSize - innerRadius * Math.sin(angleRadians);

      // Determine if we need the large arc flag
      const largeArcFlag = percentage > 50 ? 1 : 0;

      // Build the path with correct sweep direction
      let path = `M${outerStartX} ${outerStartY}`; // Move to outer start (left edge)
      path += ` A${halfSize} ${halfSize} 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY}`; // Outer arc clockwise
      path += ` L${innerEndX} ${innerEndY}`; // Line to inner arc end
      path += ` A${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY}`; // Inner arc counter-clockwise
      path += ` Z`; // Close path

      return path;
    };

    const progressPath = getProgressPath(normalizedValue);

    // Color based on confidence level
    const getProgressColor = (value: number) => {
      if (value <= 30) return '#FB3748'; // Red
      if (value <= 50) return '#FFA500'; // Orange
      if (value <= 70) return '#0EA5E9'; // Blue
      return '#00C851'; // Green
    };

    return (
      <div ref={ref} className={cn('relative w-[98px] h-[52px]', className)} {...props}>
        <div className="relative h-[98px] mb-[46px]">
          <div className="absolute w-[98px] h-[98px] top-0 left-0">
            <div className="relative h-[49px]">
              {/* Background semicircle */}
              <svg
                width={size}
                height={halfSize}
                viewBox={`0 0 ${size} ${halfSize}`}
                className="absolute top-0 left-0"
              >
                <path d={backgroundPath} fill="#E1E4EA" />
              </svg>

              {/* Progress overlay */}
              {progressPath && (
                <svg
                  width={size}
                  height={halfSize}
                  viewBox={`0 0 ${size} ${halfSize}`}
                  className="absolute top-0 left-0"
                >
                  <path d={progressPath} fill={getProgressColor(normalizedValue)} />
                </svg>
              )}
            </div>
          </div>

          {/* Center content (percentage text) */}
          {children && (
            <div className="absolute w-14 top-7 left-[21px] font-['Inter',Helvetica] font-normal text-[#0d111b] text-[28px] text-center tracking-[-0.17px] leading-5">
              {children}
            </div>
          )}
        </div>
      </div>
    );
  },
);

CircularProgress.displayName = 'CircularProgress';

export { CircularProgress };
