import { useParams } from "react-router-dom";
import { WidgetGallery } from "@/components/embeddable-widgets/widget-gallery";
import { SocialMetaTags } from "@/components/common/layout";
import { useCachedRepoData } from "@/hooks/use-cached-repo-data";
import { useTimeRangeStore } from "@/lib/time-range-store";
import type { WidgetData } from "@/components/embeddable-widgets/widget-types";

export default function WidgetsPage() {
  const { owner, repo } = useParams();
  const { timeRange } = useTimeRangeStore();
  
  // Get real data if owner/repo is provided
  const { stats, lotteryFactor } = useCachedRepoData(
    owner,
    repo,
    timeRange,
    false // includeBots
  );

  // Transform data to widget format
  const widgetData: WidgetData | undefined = stats.data && !stats.loading ? {
    repository: {
      owner: owner || 'example',
      repo: repo || 'repository',
      description: `${repo} repository analytics`,
      language: 'TypeScript',
    },
    stats: {
      totalContributors: stats.data.totalContributors || 0,
      totalPRs: stats.data.totalPRs || 0,
      mergedPRs: stats.data.mergedPRs || 0,
      mergeRate: stats.data.totalPRs > 0 ? (stats.data.mergedPRs / stats.data.totalPRs) * 100 : 0,
      lotteryFactor: lotteryFactor.data?.score,
      lotteryRating: lotteryFactor.data?.rating,
    },
    activity: {
      weeklyPRVolume: Math.floor((stats.data.totalPRs || 0) / 4),
      activeContributors: Math.floor((stats.data.totalContributors || 0) * 0.3),
      recentActivity: (stats.data.totalPRs || 0) > 0,
    },
    topContributors: stats.data.topContributors?.slice(0, 5) || [],
  } : undefined;

  return (
    <div className="container mx-auto px-4 py-8">
      <SocialMetaTags
        title={owner && repo ? `${owner}/${repo} - Embeddable Widgets` : "Embeddable Widgets - contributor.info"}
        description={owner && repo 
          ? `Generate embeddable widgets and citations for ${owner}/${repo} repository analytics`
          : "Create embeddable widgets, badges, and citations for GitHub repository analytics"
        }
        image={owner && repo 
          ? `/api/widgets/stat-card?owner=${owner}&repo=${repo}&theme=light&size=large`
          : undefined
        }
      />
      
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            {owner && repo ? `${owner}/${repo}` : 'Embeddable Widgets'}
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            {owner && repo 
              ? 'Generate embeddable widgets and citations for this repository'
              : 'Create embeddable widgets, badges, and citations for GitHub repositories'
            }
          </p>
          <p className="text-muted-foreground">
            Perfect for README files, documentation, academic citations, and social media
          </p>
        </div>

        {/* Widget Gallery */}
        <WidgetGallery 
          owner={owner}
          repo={repo}
          data={widgetData}
        />

        {/* Documentation */}
        <div className="mt-12 space-y-8">
          <div className="border-t pt-8">
            <h2 className="text-2xl font-semibold mb-4">API Endpoints</h2>
            <div className="grid gap-4 text-sm">
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Badge API</h3>
                <code className="text-xs">GET /api/widgets/badge?owner=facebook&repo=react&type=contributors&style=flat</code>
                <p className="text-muted-foreground mt-2">
                  Generate SVG badges for repository metrics. Supports multiple badge styles and metric types.
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Stat Card API</h3>
                <code className="text-xs">GET /api/widgets/stat-card?owner=facebook&repo=react&theme=light&size=medium</code>
                <p className="text-muted-foreground mt-2">
                  Generate comprehensive stat cards with multiple metrics, themes, and sizes.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-8">
            <h2 className="text-2xl font-semibold mb-4">Usage Guidelines</h2>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h3 className="font-semibold mb-2">✅ Encouraged Use</h3>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• GitHub README files</li>
                  <li>• Project documentation sites</li>
                  <li>• Academic papers and research</li>
                  <li>• Social media sharing</li>
                  <li>• Open source project promotion</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">⚠️ Please Note</h3>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Data is cached for performance</li>
                  <li>• Attribution is appreciated</li>
                  <li>• Widgets update automatically</li>
                  <li>• Rate limits may apply</li>
                  <li>• Links should point to contributor.info</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}