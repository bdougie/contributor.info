import { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, Brain, Search, ExternalLink } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CitationMetrics {
  totalCitations: number;
  uniqueRepositories: number;
  platformBreakdown: Record<string, number>;
  repositoryBreakdown: Record<string, number>;
  dailyTrend: Record<string, number>;
  averageConfidence: number;
}

interface PlatformData {
  name: string;
  count: number;
  icon: string;
  color: string;
}

const AI_PLATFORMS: Record<string, PlatformData> = {
  claude: { name: 'Claude', count: 0, icon: '🤖', color: 'bg-blue-500' },
  chatgpt: { name: 'ChatGPT', count: 0, icon: '🧠', color: 'bg-green-500' },
  perplexity: { name: 'Perplexity', count: 0, icon: '🔍', color: 'bg-purple-500' },
  gemini: { name: 'Gemini', count: 0, icon: '✨', color: 'bg-orange-500' },
  copilot: { name: 'Copilot', count: 0, icon: '💼', color: 'bg-blue-600' },
  other_ai: { name: 'Other AI', count: 0, icon: '🤖', color: 'bg-gray-500' },
};

export function LLMCitationDashboard() {
  const [metrics, setMetrics] = useState<CitationMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date(),
  });

  useEffect(() => {
    loadCitationMetrics();
  }, [dateRange]);

  const loadCitationMetrics = async () => {
    try {
      setIsLoading(true);
      // Import dynamically to avoid initialization errors
      const { initializeLLMCitationTracking } = await import('@/lib/llm-citation-tracking');
      const tracker = initializeLLMCitationTracking();
      const _data = await tracker.getCitationMetrics(dateRange);
      setMetrics(_data);
    } catch (_error) {
      console.error('Failed to load citation metrics:', _error);
      setMetrics(null);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getTopRepositories = () => {
    if (!metrics?.repositoryBreakdown) return [];
    return Object.entries(metrics.repositoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
  };

  const getDailyTrendData = () => {
    if (!metrics?.dailyTrend) return [];
    return Object.entries(metrics.dailyTrend)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14); // Last 14 days
  };

  const getPlatformData = () => {
    if (!metrics?.platformBreakdown) return [];
    return Object.entries(metrics.platformBreakdown)
      .map(([platform, count]) => ({
        ...(AI_PLATFORMS[platform] || AI_PLATFORMS.other_ai),
        count,
      }))
      .filter((platform) => platform.count > 0)
      .sort((a, b) => b.count - a.count);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Failed to load citation metrics</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">LLM Citation Tracking</h1>
          <p className="text-muted-foreground">Monitor how AI platforms cite contributor.info</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <Brain className="h-4 w-4" />
          AI Citations
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Citations</p>
                <p className="text-2xl font-bold">{metrics.totalCitations}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unique Repos</p>
                <p className="text-2xl font-bold">{metrics.uniqueRepositories}</p>
              </div>
              <Search className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
                <p className="text-2xl font-bold">
                  {(metrics.averageConfidence * 100).toFixed(1)}%
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI Platforms</p>
                <p className="text-2xl font-bold">
                  {Object.keys(metrics.platformBreakdown).length}
                </p>
              </div>
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="platforms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="platforms">AI Platforms</TabsTrigger>
          <TabsTrigger value="repositories">Top Repositories</TabsTrigger>
          <TabsTrigger value="trends">Daily Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms">
          <Card>
            <CardHeader>
              <CardTitle>Citations by AI Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getPlatformData().map((platform) => (
                  <div key={platform.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${platform.color}`} />
                      <span className="flex items-center gap-2">
                        <span>{platform.icon}</span>
                        {platform.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={
                          metrics.totalCitations > 0
                            ? (platform.count / metrics.totalCitations) * 100
                            : 0
                        }
                        className="w-24"
                      />
                      <span className="text-sm font-medium w-8">{platform.count}</span>
                      <span className="text-xs text-muted-foreground w-12">
                        {metrics.totalCitations > 0
                          ? ((platform.count / metrics.totalCitations) * 100).toFixed(1) + '%'
                          : '0.0%'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repositories">
          <Card>
            <CardHeader>
              <CardTitle>Most Cited Repositories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getTopRepositories().map(([repo, count], index) => (
                  <div
                    key={repo}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className="w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs"
                      >
                        {index + 1}
                      </Badge>
                      <span className="font-medium">{repo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{count} citations</span>
                      <a
                        href={`/${repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Daily Citation Trends (Last 14 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getDailyTrendData().map(([date, count]) => (
                  <div key={date} className="flex items-center justify-between">
                    <span className="text-sm">{formatDate(date)}</span>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={
                          metrics.totalCitations > 0 && Object.values(metrics.dailyTrend).length > 0
                            ? (count / Math.max(...Object.values(metrics.dailyTrend))) * 100
                            : 0
                        }
                        className="w-32"
                      />
                      <span className="text-sm font-medium w-8">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confidence Score Info */}
      {metrics.averageConfidence > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Citation Confidence Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              The confidence score indicates how likely it is that traffic came from AI platform
              citations. Higher scores suggest more direct citations from AI responses.
            </p>
            <div className="flex items-center gap-3">
              <Progress value={metrics.averageConfidence * 100} className="flex-1" />
              <span className="text-sm font-medium">
                {(metrics.averageConfidence * 100).toFixed(1)}% confidence
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
