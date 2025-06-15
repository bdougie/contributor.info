import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GitPullRequest, GitMerge, Users } from "lucide-react";

interface RepoSocialCardProps {
  owner: string;
  repo: string;
  stats?: {
    totalContributors: number;
    totalPRs: number;
    mergedPRs: number;
    topContributors?: Array<{
      login: string;
      avatar_url: string;
      contributions: number;
    }>;
  };
}

export default function RepoSocialCard({ owner, repo, stats }: RepoSocialCardProps) {
  return (
    <div className="w-[1200px] h-[630px] bg-gradient-to-br from-background to-muted flex items-center justify-center p-12">
      <Card className="w-full h-full flex relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Left side - Repository info */}
        <div className="flex-1 p-16 flex flex-col justify-between relative z-10">
          {/* Header */}
          <div>
            <h1 className="text-5xl font-bold mb-2">
              {owner}/{repo}
            </h1>
            <p className="text-xl text-muted-foreground">
              Open Source Contribution Analysis
            </p>
          </div>

          {/* Stats */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <div className="text-3xl font-bold">{stats?.totalContributors || 0}</div>
                <div className="text-muted-foreground">Contributors</div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <GitPullRequest className="w-8 h-8 text-primary" />
              <div>
                <div className="text-3xl font-bold">{stats?.totalPRs || 0}</div>
                <div className="text-muted-foreground">Pull Requests</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <GitMerge className="w-8 h-8 text-primary" />
              <div>
                <div className="text-3xl font-bold">{stats?.mergedPRs || 0}</div>
                <div className="text-muted-foreground">Merged</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-lg text-muted-foreground">
            contributor.info/{owner}/{repo}
          </div>
        </div>

        {/* Right side - Top contributors */}
        <div className="w-[400px] bg-muted/30 p-12 flex flex-col justify-center relative z-10">
          <h2 className="text-2xl font-semibold mb-8">Top Contributors</h2>
          <div className="space-y-4">
            {stats?.topContributors?.slice(0, 5).map((contributor, index) => (
              <div key={contributor.login} className="flex items-center gap-4">
                <span className="text-2xl font-bold text-muted-foreground w-8">
                  {index + 1}
                </span>
                <Avatar className="w-12 h-12">
                  <AvatarImage src={contributor.avatar_url} alt={contributor.login} />
                  <AvatarFallback>{contributor.login[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{contributor.login}</div>
                  <div className="text-sm text-muted-foreground">
                    {contributor.contributions} contributions
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}