import { cn } from "@/lib/utils";
import { MonthlyContributor } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ContributorCardProps {
  contributor: MonthlyContributor;
  showRank?: boolean;
  isWinner?: boolean;
  className?: string;
}

export function ContributorCard({
  contributor,
  showRank = true,
  isWinner = false,
  className,
}: ContributorCardProps) {
  const { login, avatar_url, activity, rank } = contributor;

  return (
    <Card
      className={cn(
        // Base card styling with responsive behavior
        "relative transition-all duration-300 ease-in-out",
        "hover:shadow-lg hover:-translate-y-1",
        "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        "transform-gpu", // Hardware acceleration for smooth animations

        // Winner specific styling with gradient and glow effect
        isWinner && [
          "ring-2 ring-yellow-400 shadow-lg",
          "bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-50",
          "dark:from-yellow-950/30 dark:via-orange-950/30 dark:to-yellow-950/30",
          "dark:ring-yellow-500/60",
          "animate-pulse-subtle", // Custom subtle pulse for winners
        ],

        // Responsive adjustments
        "w-full max-w-sm mx-auto sm:max-w-none",

        className
      )}
      role={isWinner ? "article" : "listitem"}
      aria-label={`${login}${isWinner ? " - Winner" : ""}, ${
        activity.totalScore
      } points`}
      tabIndex={0}
    >
      {/* Winner Badge with floating animation */}
      {isWinner && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 animate-bounce-gentle">
          <Badge
            className={cn(
              "bg-gradient-to-r from-yellow-400 to-orange-400",
              "text-yellow-900 dark:text-yellow-100",
              "px-4 py-1.5 font-bold text-sm",
              "shadow-lg border-2 border-white dark:border-gray-900",
              "hover:from-yellow-300 hover:to-orange-300 transition-all duration-200"
            )}
          >
            <span role="img" aria-label="Trophy" className="mr-1">
              🏆
            </span>
            Winner
          </Badge>
        </div>
      )}

      <CardHeader className="pb-3 pt-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Avatar className="h-12 w-12 ring-2 ring-gray-100 dark:ring-gray-800 transition-all duration-200 hover:ring-blue-200 dark:hover:ring-blue-700">
              <AvatarImage
                src={avatar_url}
                alt={`${login}'s profile picture`}
              />
              <AvatarFallback
                className={cn(
                  "bg-gradient-to-br from-gray-100 to-gray-200",
                  "dark:from-gray-700 dark:to-gray-800",
                  "text-gray-700 dark:text-gray-200 font-semibold",
                  "transition-all duration-200"
                )}
              >
                {login.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Rank Badge */}
            {showRank && !isWinner && (
              <Badge
                className={cn(
                  "absolute -top-2 -right-2 h-7 w-7 rounded-full p-0",
                  "flex items-center justify-center text-xs font-bold",
                  "bg-gradient-to-br from-blue-600 to-blue-700",
                  "text-white border-2 border-white dark:border-gray-900",
                  "shadow-md hover:shadow-lg transition-all duration-200",
                  "hover:scale-110 transform"
                )}
                aria-label={`Rank ${rank}`}
              >
                {rank}
              </Badge>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                "font-semibold text-base sm:text-sm text-gray-900 dark:text-gray-100",
                "truncate transition-colors duration-200",
                "group-hover:text-blue-600 dark:group-hover:text-blue-400"
              )}
            >
              {login}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              Score:{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {activity.totalScore}
              </span>
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-4">
        {/* Activity Stats Grid */}
        <div
          className="grid grid-cols-3 gap-2 sm:gap-3"
          role="group"
          aria-label="Contribution breakdown"
        >
          {/* Pull Requests */}
          <div
            className={cn(
              "bg-gradient-to-br from-blue-50 to-blue-100",
              "dark:from-blue-950/40 dark:to-blue-900/40",
              "rounded-lg p-2 sm:p-3",
              "border border-blue-200/50 dark:border-blue-800/50",
              "hover:shadow-sm hover:scale-[1.02] transition-all duration-200",
              "group cursor-default"
            )}
          >
            <div
              className={cn(
                "text-lg sm:text-xl font-bold mb-1",
                "text-blue-700 dark:text-blue-300",
                "group-hover:text-blue-800 dark:group-hover:text-blue-200 transition-colors"
              )}
            >
              {activity.pullRequests}
            </div>
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Pull Requests
            </div>
          </div>

          {/* Reviews */}
          <div
            className={cn(
              "bg-gradient-to-br from-green-50 to-green-100",
              "dark:from-green-950/40 dark:to-green-900/40",
              "rounded-lg p-2 sm:p-3",
              "border border-green-200/50 dark:border-green-800/50",
              "hover:shadow-sm hover:scale-[1.02] transition-all duration-200",
              "group cursor-default"
            )}
          >
            <div
              className={cn(
                "text-lg sm:text-xl font-bold mb-1",
                "text-green-700 dark:text-green-300",
                "group-hover:text-green-800 dark:group-hover:text-green-200 transition-colors"
              )}
            >
              {activity.reviews}
            </div>
            <div className="text-xs font-medium text-green-600 dark:text-green-400">
              Reviews
            </div>
          </div>

          {/* Comments */}
          <div
            className={cn(
              "bg-gradient-to-br from-purple-50 to-purple-100",
              "dark:from-purple-950/40 dark:to-purple-900/40",
              "rounded-lg p-2 sm:p-3",
              "border border-purple-200/50 dark:border-purple-800/50",
              "hover:shadow-sm hover:scale-[1.02] transition-all duration-200",
              "group cursor-default"
            )}
          >
            <div
              className={cn(
                "text-lg sm:text-xl font-bold mb-1",
                "text-purple-700 dark:text-purple-300",
                "group-hover:text-purple-800 dark:group-hover:text-purple-200 transition-colors"
              )}
            >
              {activity.comments}
            </div>
            <div className="text-xs font-medium text-purple-600 dark:text-purple-400">
              Comments
            </div>
          </div>
        </div>

        {/* Winner First Contribution Date */}
        {isWinner && (
          <div
            className={cn(
              "mt-4 pt-3",
              "border-t border-yellow-200 dark:border-yellow-800/50",
              "bg-gradient-to-r from-yellow-50/50 to-orange-50/50",
              "dark:from-yellow-950/20 dark:to-orange-950/20",
              "rounded-lg p-2 -mx-1"
            )}
          >
            <p className="text-xs text-center text-gray-600 dark:text-gray-400">
              <span className="sr-only">First contribution date: </span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                First contribution:
              </span>{" "}
              <time
                dateTime={activity.firstContributionDate}
                className="font-semibold text-yellow-700 dark:text-yellow-300"
              >
                {new Date(activity.firstContributionDate).toLocaleDateString()}
              </time>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
