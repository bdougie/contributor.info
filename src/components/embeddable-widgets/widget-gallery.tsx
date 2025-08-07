import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Code, Eye } from "lucide-react";
import { toast } from "sonner";

import { StatCard } from "./stat-card";
import { BadgeGenerator, generateBadgeMarkdown } from "./badge-generator";
import { CitationGenerator } from "./citation-generator";
import type { StatCardConfig, BadgeConfig, WidgetData } from "./widget-types";

interface WidgetGalleryProps {
  owner?: string;
  repo?: string;
  data?: WidgetData;
}

// Mock data for preview when no data is provided
const MOCK_DATA: WidgetData = {
  repository: {
    owner: "facebook",
    repo: "react", 
    description: "The library for web and native user interfaces",
    stars: 233000,
    language: "JavaScript",
  },
  stats: {
    totalContributors: 1247,
    totalPRs: 8934,
    mergedPRs: 7456,
    mergeRate: 83.5,
    lotteryFactor: 3.2,
    lotteryRating: "Good",
  },
  activity: {
    weeklyPRVolume: 67,
    activeContributors: 342,
    recentActivity: true,
  },
  topContributors: [
    { login: "gaearon", avatar_url: "https://avatars.githubusercontent.com/u/810438?v=4", contributions: 1234 },
    { login: "sebmarkbage", avatar_url: "https://avatars.githubusercontent.com/u/63648?v=4", contributions: 567 },
    { login: "acdlite", avatar_url: "https://avatars.githubusercontent.com/u/3624098?v=4", contributions: 456 },
  ],
};

export function WidgetGallery({ owner = "facebook", repo = "react", data = MOCK_DATA }: WidgetGalleryProps) {
  const [selectedWidget, setSelectedWidget] = useState<'stat-card' | 'badge' | 'citation'>('stat-card');
  const [customOwner, setCustomOwner] = useState(owner);
  const [customRepo, setCustomRepo] = useState(repo);
  
  // Widget configurations
  const [statCardConfig, setStatCardConfig] = useState<StatCardConfig>({
    type: 'stat-card',
    owner: customOwner,
    repo: customRepo,
    theme: 'light',
    size: 'medium',
    format: 'html',
    metrics: ['contributors', 'pull-requests', 'lottery-factor'],
    showLogo: true,
  });

  const [badgeConfig, setBadgeConfig] = useState<BadgeConfig>({
    type: 'badge',
    owner: customOwner, 
    repo: customRepo,
    style: 'flat',
    format: 'svg',
  });

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${type} copied to clipboard`);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Generate embedding code
  const generateEmbedCode = () => {
    const baseURL = typeof window !== 'undefined' ? window.location.origin : 'https://contributor.info';
    
    switch (selectedWidget) {
      case 'stat-card':
        const params = new URLSearchParams({
          owner: customOwner,
          repo: customRepo,
          theme: statCardConfig.theme || 'light',
          size: statCardConfig.size || 'medium',
          metrics: statCardConfig.metrics?.join(',') || 'contributors,pull-requests',
        });
        
        return {
          html: `<iframe src="${baseURL}/api/widgets/stat-card?${params}" width="400" height="200" frameborder="0"></iframe>`,
          markdown: `[![${customOwner}/${customRepo} Stats](${baseURL}/api/widgets/stat-card?${params})](https://contributor.info/${customOwner}/${customRepo})`,
          url: `${baseURL}/api/widgets/stat-card?${params}`,
        };
        
      case 'badge':
        const badgeMarkdown = generateBadgeMarkdown(badgeConfig, data);
        const badgeParams = new URLSearchParams({
          owner: customOwner,
          repo: customRepo,
          type: 'contributors',
          style: badgeConfig.style || 'flat',
        });
        
        return {
          html: `<img src="${baseURL}/api/widgets/badge?${badgeParams}" alt="${customOwner}/${customRepo} contributors" />`,
          markdown: badgeMarkdown,
          url: `${baseURL}/api/widgets/badge?${badgeParams}`,
        };
        
      default:
        return {
          html: `<iframe src="${baseURL}/${customOwner}/${customRepo}" width="100%" height="600" frameborder="0"></iframe>`,
          markdown: `[${customOwner}/${customRepo} Analytics](${baseURL}/${customOwner}/${customRepo})`,
          url: `${baseURL}/${customOwner}/${customRepo}`,
        };
    }
  };

  const embedCode = generateEmbedCode();

  return (
    <div className="space-y-6">
      {/* Repository Input */}
      <Card>
        <CardHeader>
          <CardTitle>Widget Generator</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create embeddable widgets for your GitHub repository
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="owner">Repository Owner</Label>
              <Input
                id="owner"
                value={customOwner}
                onChange={(e) => {
                  setCustomOwner(e.target.value);
                  setStatCardConfig(prev => ({ ...prev, owner: e.target.value }));
                  setBadgeConfig(prev => ({ ...prev, owner: e.target.value }));
                }}
                placeholder="facebook"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repo">Repository Name</Label>
              <Input
                id="repo"
                value={customRepo}
                onChange={(e) => {
                  setCustomRepo(e.target.value);
                  setStatCardConfig(prev => ({ ...prev, repo: e.target.value }));
                  setBadgeConfig(prev => ({ ...prev, repo: e.target.value }));
                }}
                placeholder="react"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Widget Type Selector */}
      <div className="flex flex-wrap gap-2">
        {(['stat-card', 'badge', 'citation'] as const).map((type) => (
          <Badge
            key={type}
            variant={selectedWidget === type ? "default" : "outline"}
            className="cursor-pointer capitalize"
            onClick={() => setSelectedWidget(type)}
          >
            {type.replace('-', ' ')}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Widget Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedWidget === 'stat-card' && (
              <StatCard config={statCardConfig} data={data} />
            )}
            {selectedWidget === 'badge' && (
              <div className="space-y-4">
                <BadgeGenerator config={badgeConfig} data={data} />
                <div className="flex flex-wrap gap-2">
                  <BadgeGenerator config={{ ...badgeConfig, metrics: ['contributors'] }} data={data} />
                  <BadgeGenerator config={{ ...badgeConfig, metrics: ['pull-requests'] }} data={data} />
                  <BadgeGenerator config={{ ...badgeConfig, metrics: ['merge-rate'] }} data={data} />
                </div>
              </div>
            )}
            {selectedWidget === 'citation' && (
              <CitationGenerator data={data} />
            )}
          </CardContent>
        </Card>

        {/* Configuration & Embed Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Embed Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="html" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="markdown">Markdown</TabsTrigger>
                <TabsTrigger value="url">URL</TabsTrigger>
              </TabsList>
              
              <TabsContent value="html" className="space-y-2">
                <Textarea
                  value={embedCode.html}
                  readOnly
                  className="text-xs font-mono resize-none"
                  rows={3}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(embedCode.html, 'HTML code')}
                  className="flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copy HTML
                </Button>
              </TabsContent>
              
              <TabsContent value="markdown" className="space-y-2">
                <Textarea
                  value={embedCode.markdown}
                  readOnly
                  className="text-xs font-mono resize-none"
                  rows={3}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(embedCode.markdown, 'Markdown code')}
                  className="flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copy Markdown
                </Button>
              </TabsContent>
              
              <TabsContent value="url" className="space-y-2">
                <Textarea
                  value={embedCode.url}
                  readOnly
                  className="text-xs font-mono resize-none"
                  rows={2}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(embedCode.url, 'Widget URL')}
                  className="flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copy URL
                </Button>
              </TabsContent>
            </Tabs>

            {/* Widget Configuration */}
            {selectedWidget === 'stat-card' && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <Label className="text-sm font-medium">Configuration</Label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <Label>Theme</Label>
                    <div className="flex gap-1 mt-1">
                      {(['light', 'dark'] as const).map((theme) => (
                        <Badge
                          key={theme}
                          variant={statCardConfig.theme === theme ? "default" : "outline"}
                          className="cursor-pointer text-xs px-2 py-0"
                          onClick={() => setStatCardConfig(prev => ({ ...prev, theme }))}
                        >
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Size</Label>
                    <div className="flex gap-1 mt-1">
                      {(['small', 'medium', 'large'] as const).map((size) => (
                        <Badge
                          key={size}
                          variant={statCardConfig.size === size ? "default" : "outline"}
                          className="cursor-pointer text-xs px-2 py-0"
                          onClick={() => setStatCardConfig(prev => ({ ...prev, size }))}
                        >
                          {size}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedWidget === 'badge' && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <Label className="text-sm font-medium">Badge Style</Label>
                <div className="flex flex-wrap gap-1">
                  {(['flat', 'flat-square', 'plastic', 'social'] as const).map((style) => (
                    <Badge
                      key={style}
                      variant={badgeConfig.style === style ? "default" : "outline"}
                      className="cursor-pointer text-xs px-2 py-0"
                      onClick={() => setBadgeConfig(prev => ({ ...prev, style }))}
                    >
                      {style}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">GitHub README</h4>
              <p className="text-muted-foreground">
                Add widgets to your repository's README.md file to showcase contributor activity and project health.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Documentation Sites</h4>
              <p className="text-muted-foreground">
                Embed live statistics in your project documentation or website using HTML iframes.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Academic Citations</h4>
              <p className="text-muted-foreground">
                Generate proper citations for academic papers and research that references your project's contributor data.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Social Media</h4>
              <p className="text-muted-foreground">
                Share visual representations of your project's health and activity on social platforms.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}