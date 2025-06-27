import { UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Semicircle progress component that grows from left to right
function SemicircleProgress({ value }: { value: number }) {
  const normalizedValue = Math.min(Math.max(value, 0), 100);
  
  // Color based on confidence level  
  const getProgressColor = (value: number) => {
    if (value <= 30) return "#FB3748"; // Red
    if (value <= 50) return "#FFA500"; // Orange
    if (value <= 70) return "#0EA5E9"; // Blue
    return "#00C851"; // Green
  };

  // Generate progress path that grows from left to right
  const getProgressPath = (percentage: number) => {
    if (percentage <= 0) return "";
    
    if (percentage >= 100) {
      // Full semicircle - complete path from left to right
      return "M0 49C0 36.0044 5.16249 23.541 14.3518 14.3518C23.5411 5.16248 36.0044 0 49 0C61.9956 0 74.459 5.16249 83.6482 14.3518C92.8375 23.5411 98 36.0044 98 49H90.16C90.16 38.0837 85.8235 27.6145 78.1045 19.8955C70.3855 12.1765 59.9163 7.84 49 7.84C38.0837 7.84 27.6145 12.1765 19.8955 19.8955C12.1765 27.6145 7.84 38.0837 7.84 49H0Z";
    }
    
    // Calculate the angle for the percentage - start from left (π) and move to right (0)
    const angleRadians = Math.PI - (percentage / 100) * Math.PI;
    
    // Outer arc points (radius = 49, center at 49,49)
    const outerStartX = 0;  // Left edge
    const outerStartY = 49; // Center height
    const outerEndX = 49 + 49 * Math.cos(angleRadians);
    const outerEndY = 49 - 49 * Math.sin(angleRadians);
    
    // Inner arc points (radius = 41.16, center at 49,49)
    const innerStartX = 7.84;  // Left edge of inner circle
    const innerStartY = 49;    // Center height
    const innerEndX = 49 + 41.16 * Math.cos(angleRadians);
    const innerEndY = 49 - 41.16 * Math.sin(angleRadians);
    
    // Determine if we need the large arc flag
    const largeArcFlag = percentage > 50 ? 1 : 0;
    
    // Build the path: outer arc from left to calculated point, then inner arc back
    let path = `M${outerStartX} ${outerStartY}`; // Move to outer start (left edge)
    path += ` A49 49 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY}`; // Outer arc clockwise
    path += ` L${innerEndX} ${innerEndY}`; // Line to inner arc end
    path += ` A41.16 41.16 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY}`; // Inner arc counter-clockwise
    path += ` Z`; // Close path
    
    return path;
  };

  return (
    <path
      d={getProgressPath(normalizedValue)}
      fill={getProgressColor(normalizedValue)}
    />
  );
}

export interface ContributorConfidenceCardProps {
  confidenceScore: number; // 0-100
  loading?: boolean;
  error?: string | null;
  className?: string;
  onLearnMoreClick?: () => void;
}

interface ConfidenceLevel {
  level: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  color: string;
}

function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score <= 30) {
    return {
      level: 'low',
      title: 'Your project can be Intimidating',
      description: 'Almost no stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-red-600'
    };
  } else if (score <= 50) {
    return {
      level: 'medium', 
      title: 'Your project is challenging',
      description: 'Few stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-orange-600'
    };
  } else if (score <= 70) {
    return {
      level: 'medium', 
      title: 'Your project is approachable!',
      description: 'Some stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-blue-600'
    };
  } else {
    return {
      level: 'high',
      title: 'Your project is welcoming!',
      description: 'Many stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-green-600'
    };
  }
}

export function ContributorConfidenceCard({
  confidenceScore,
  loading = false,
  error = null,
  className,
  onLearnMoreClick,
}: ContributorConfidenceCardProps) {
  if (loading) {
    return (
      <Card className={cn("w-[404px] overflow-hidden border border-[#e1e3e9]", className)}>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 w-full">
            <div className="flex items-center gap-2 py-1 flex-1">
              <div className="w-[18px] h-[18px] bg-muted animate-pulse rounded" />
              <div className="h-5 w-32 bg-muted animate-pulse rounded" />
              <div className="ml-auto h-4 w-16 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="flex items-start gap-4 w-full">
            <div className="w-[98px] h-[98px] bg-muted animate-pulse rounded-full" />
            <div className="flex flex-col gap-2 flex-1">
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              <div className="h-12 w-full bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("w-[404px] overflow-hidden border border-[#e1e3e9]", className)}>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 w-full">
            <div className="flex items-center gap-2 py-1 flex-1">
              <UserPlus className="w-[18px] h-[18px]" />
              <div className="font-['Inter',Helvetica] font-semibold text-[#0d111b] text-sm tracking-[-0.15px] leading-6 whitespace-nowrap">
                Contributor Confidence
              </div>
              {onLearnMoreClick && (
                <button
                  onClick={onLearnMoreClick}
                  className="ml-auto font-['Inter',Helvetica] font-medium text-opensauced-orange text-xs leading-4 whitespace-nowrap hover:underline"
                >
                  Learn More
                </button>
              )}
            </div>
          </div>
          <div className="text-center text-muted-foreground py-8">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  const confidence = getConfidenceLevel(confidenceScore);

  return (
    <Card className={cn("w-[404px] overflow-hidden border border-[#e1e3e9]", className)}>
      <CardContent className="p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 w-full">
          <div className="flex items-center gap-2 py-1 flex-1">
            <UserPlus className="w-[18px] h-[18px]" />
            <div className="font-['Inter',Helvetica] font-semibold text-[#0d111b] text-sm tracking-[-0.15px] leading-6 whitespace-nowrap">
              Contributor Confidence
            </div>
            {onLearnMoreClick && (
              <button
                onClick={onLearnMoreClick}
                className="ml-auto font-['Inter',Helvetica] font-medium text-opensauced-orange text-xs leading-4 whitespace-nowrap hover:underline"
              >
                Learn More
              </button>
            )}
          </div>
        </div>

        <div className="flex items-start gap-4 w-full">
          <div className="relative w-[98px] h-[52px]">
            <div className="relative h-[98px] mb-[46px]">
              <div className="absolute w-[98px] h-[98px] top-0 left-0">
                <div className="relative h-[49px]">
                  {/* Background semicircle */}
                  <svg
                    width="98"
                    height="49"
                    viewBox="0 0 98 49"
                    className="absolute top-0 left-0"
                  >
                    <path
                      d="M98 49C98 36.0044 92.8375 23.5411 83.6482 14.3518C74.459 5.16249 61.9956 9.81141e-07 49 0C36.0044 -9.81141e-07 23.5411 5.16248 14.3518 14.3518C5.16249 23.541 1.96228e-06 36.0044 0 49H7.84C7.84 38.0837 12.1765 27.6145 19.8955 19.8955C27.6145 12.1765 38.0837 7.84 49 7.84C59.9163 7.84 70.3855 12.1765 78.1045 19.8955C85.8235 27.6145 90.16 38.0837 90.16 49H98Z"
                      fill="#E1E4EA"
                    />
                  </svg>
                  
                  {/* Progress overlay */}
                  <svg
                    width="98"
                    height="49"
                    viewBox="0 0 98 49"
                    className="absolute top-0 left-0"
                  >
                    <SemicircleProgress value={confidenceScore} />
                  </svg>
                </div>
              </div>

              <div className="absolute w-14 top-7 left-[21px] font-['Inter',Helvetica] font-normal text-[#0d111b] text-[28px] text-center tracking-[-0.17px] leading-5">
                <span className="font-bold tracking-[-0.05px]">{Math.round(confidenceScore)}</span>
                <span className="font-bold text-xs tracking-[-0.01px]">%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-1 flex-1">
            <div className="font-['Inter',Helvetica] font-semibold text-[#374151] text-xs tracking-[0] leading-4 whitespace-nowrap">
              {confidence.title}
            </div>
            <div className="font-paragraph-x-small font-[number:var(--paragraph-x-small-font-weight)] text-[#525866] text-[length:var(--paragraph-x-small-font-size)] tracking-[var(--paragraph-x-small-letter-spacing)] leading-[var(--paragraph-x-small-line-height)] [font-style:var(--paragraph-x-small-font-style)]">
              {confidence.description}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}