import { Card } from "@/components/ui/card";
import { useGlobalStats } from "@/hooks/use-global-stats";

export default function HomeSocialCardWithData() {
  const { totalRepositories, totalContributors, totalPullRequests, isLoading } =
    useGlobalStats();

  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <div className="w-[1200px] h-[630px] bg-black flex items-center justify-center p-16">
      <Card className="w-full h-full bg-black border-0 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Logo */}
        <div className="w-32 h-32 bg-primary rounded-full flex items-center justify-center mb-8 relative z-10">
          <span className="text-6xl">🌱</span>
        </div>

        {/* Title */}
        <h1 className="text-6xl font-bold text-center mb-4 relative z-10">
          contributor.info
        </h1>

        {/* Tagline */}
        <p className="text-2xl text-muted-foreground text-center mb-12 relative z-10">
          Visualizing Open Source Contributions
        </p>

        {/* Stats */}
        <div className="flex gap-12 relative z-10">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">
              {isLoading ? "..." : formatNumber(totalRepositories)}
            </div>
            <div className="text-lg text-muted-foreground">Repositories</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">
              {isLoading ? "..." : formatNumber(totalContributors)}
            </div>
            <div className="text-lg text-muted-foreground">Contributors</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">
              {isLoading ? "..." : formatNumber(totalPullRequests)}
            </div>
            <div className="text-lg text-muted-foreground">Pull Requests</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
