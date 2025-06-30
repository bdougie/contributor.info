import { TrendingUp, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RepoSocialCardProps {
  owner: string;
  repo: string;
  timeRange?: string;
  stats?: {
    totalContributors: number;
    totalPRs: number;
    mergedPRs: number;
    weeklyPRVolume?: number;
    activeContributors?: number;
    topContributors?: Array<{
      login: string;
      avatar_url: string;
      contributions: number;
    }>;
  };
}

export default function RepoSocialCard({ owner, repo, timeRange, stats }: RepoSocialCardProps) {
  return (
    <div className="w-[1200px] h-[630px] bg-black flex flex-col relative overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-start p-12 relative z-10">
        {/* Logo/Brand with favicon */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8">
              <text y=".9em" fontSize="90" textAnchor="middle" x="50">🌱</text>
            </svg>
          </div>
          <span className="text-white text-xl font-semibold">contributor.info</span>
        </div>

      </div>

      {/* Main content */}
      <div className="flex-1 px-12 pb-20 flex flex-col justify-center relative z-10">
        {/* Main title */}
        <h1 className="text-6xl font-bold text-white mb-8">
          {owner}/{repo}
        </h1>

        {/* Time period */}
        <p className="text-2xl text-gray-300 mb-16">
          {timeRange || 'Past 6 months'}
        </p>

        {/* Bottom section with trends and avatars */}
        <div className="flex items-end justify-between">
          {/* Left side - Trends */}
          <div className="flex items-center gap-16">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-white" />
              <div>
                <span className="text-4xl font-bold text-white">{stats?.weeklyPRVolume || Math.floor((stats?.totalPRs || 0) / 4)}</span>
                <span className="text-xl text-gray-300 ml-2">Weekly PR Volume</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-white" />
              <div>
                <span className="text-4xl font-bold text-white">{stats?.activeContributors || Math.floor((stats?.totalContributors || 0) * 0.3)}</span>
                <span className="text-xl text-gray-300 ml-2">Active Contributors</span>
              </div>
            </div>
          </div>

          {/* Right side - Contributor avatars */}
          <div className="flex items-center gap-4">
            {stats?.topContributors && stats.topContributors.length > 0 && (
              <div className="flex items-center">
                <div className="-space-x-2 flex hover:space-x-0 transition-all duration-300">
                  {stats.topContributors.slice(0, 5).map((contributor) => (
                    <div
                      key={`contributor-avatar-${contributor.login}`}
                      className="w-10 h-10 overflow-hidden rounded-full transition-all duration-300 border-2 border-white"
                    >
                      <Avatar className="w-full h-full">
                        <AvatarImage src={contributor.avatar_url} alt={contributor.login} loading="lazy" />
                        <AvatarFallback className="text-xs bg-gray-700 text-white">
                          {contributor.login[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  ))}
                </div>
                {stats.totalContributors > 5 && (
                  <span className="text-white text-sm ml-3">
                    +{stats.totalContributors - 5}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}