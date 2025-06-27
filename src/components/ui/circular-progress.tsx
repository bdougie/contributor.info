import * as React from "react";
import { cn } from "@/lib/utils";

export interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
  trackClassName?: string;
  progressClassName?: string;
}

const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
  ({ 
    value, 
    size = 98, 
    strokeWidth = 4, 
    className, 
    children, 
    trackClassName,
    progressClassName,
    ...props 
  }, ref) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * Math.PI * 2;
    const offset = circumference - (Math.min(Math.max(value, 0), 100) / 100) * circumference;

    return (
      <div
        ref={ref}
        className={cn("relative inline-flex items-center justify-center", className)}
        style={{ width: size, height: size }}
        {...props}
      >
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className={cn("text-muted/20", trackClassName)}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn(
              "transition-all duration-300 ease-in-out",
              value <= 30 ? "text-red-500" : 
              value <= 70 ? "text-yellow-500" : 
              "text-green-500",
              progressClassName
            )}
          />
        </svg>
        {/* Center content */}
        {children && (
          <div className="absolute inset-0 flex items-center justify-center">
            {children}
          </div>
        )}
      </div>
    );
  }
);

CircularProgress.displayName = "CircularProgress";

export { CircularProgress };