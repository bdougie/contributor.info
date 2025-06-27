import { UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { cn } from "@/lib/utils";

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
  } else if (score <= 70) {
    return {
      level: 'medium', 
      title: 'Your project is approachable!',
      description: 'Some stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-yellow-600'
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
                <CircularProgress 
                  value={confidenceScore}
                  size={98}
                  strokeWidth={4}
                >
                  <div className="w-14 font-['Inter',Helvetica] font-normal text-[#0d111b] text-center">
                    <span className="font-bold text-[28px] tracking-[-0.17px] leading-5">
                      {Math.round(confidenceScore)}
                    </span>
                    <span className="font-bold text-xs tracking-[-0.01px]">%</span>
                  </div>
                </CircularProgress>
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