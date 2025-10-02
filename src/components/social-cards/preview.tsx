import { useState } from 'react';
import { ExternalLink, Loader2 } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import HomeSocialCard from './home-card';
import RepoSocialCard from './repo-card';

export default function SocialCardPreview() {
  const [repoInput, setRepoInput] = useState('facebook/react');
  const [currentRepo, setCurrentRepo] = useState({ owner: 'facebook', repo: 'react' });
  const [loading, setLoading] = useState({ home: true, repo: true });
  const [viewMode, setViewMode] = useState<'live' | 'components'>('components');

  const handlePreview = () => {
    const [owner, repo] = repoInput.split('/');
    if (owner && repo) {
      setLoading((prev) => ({ ...prev, repo: true }));
      setCurrentRepo({ owner, repo });
    }
  };

  const flyServiceUrl = 'https://contributor-info-social-cards.fly.dev';

  return (
    <div className="container mx-auto py-2 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Social Card Preview</h1>

      <div className="mb-4 text-sm text-muted-foreground">
        <p>
          Preview both React components (local) and live cards from our Fly.io service. Click "Open
          Full Size" to view live cards at actual dimensions (1200x630px).
        </p>
        <p className="mt-2">
          Service Status:{' '}
          <a
            href={`${flyServiceUrl}/health`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Check Health
          </a>
        </p>
      </div>

      {/* View Mode Toggle */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>View Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'components' ? 'default' : 'outline'}
              onClick={() => setViewMode('components')}
            >
              React Components
            </Button>
            <Button
              variant={viewMode === 'live' ? 'default' : 'outline'}
              onClick={() => setViewMode('live')}
            >
              Live Cards (Fly.io)
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Preview Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo">Repository (owner/repo)</Label>
              <div className="flex gap-2">
                <Input
                  id="repo"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="e.g., facebook/react"
                />
                <Button onClick={handlePreview}>Preview</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Home Card Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Home Card {viewMode === 'components' ? '(React Component)' : '(Live from Fly.io)'}
              {viewMode === 'live' && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`${flyServiceUrl}/social-cards/home`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Full Size
                  </a>
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {viewMode === 'components' ? (
              <div className="border rounded-lg overflow-hidden">
                <div
                  style={{
                    transform: 'scale(0.5)',
                    transformOrigin: 'top left',
                    width: '1200px',
                    height: '630px',
                  }}
                >
                  <HomeSocialCard />
                </div>
              </div>
            ) : (
              <div
                className="relative border rounded-lg overflow-hidden bg-muted/20"
                style={{ height: '315px' }}
              >
                {loading.home && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary-white-overlay z-10">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                )}
                <img
                  src={`${flyServiceUrl}/social-cards/home`}
                  alt="Home social card preview"
                  onLoad={() => setLoading((prev) => ({ ...prev, home: false }))}
                  style={{
                    width: '600px',
                    height: '315px',
                    objectFit: 'contain',
                  }}
                />
              </div>
            )}
            <div className="mt-4 text-sm text-muted-foreground">
              {viewMode === 'components' ? (
                <>
                  <p>Source: React component (src/components/social-cards/home-card.tsx)</p>
                  <p>Dimensions: 1200x630px (scaled to 50% for display)</p>
                  <p>Theme: Matches app's dark theme with CSS variables</p>
                </>
              ) : (
                <>
                  <p>URL: {flyServiceUrl}/social-cards/home</p>
                  <p>Dimensions: 1200x630px</p>
                  <p>Format: SVG (optimized for fast loading)</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Repository Card Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Repository Card: {currentRepo.owner}/{currentRepo.repo}{' '}
              {viewMode === 'components' ? '(React Component)' : '(Live from Fly.io)'}
              {viewMode === 'live' && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`${flyServiceUrl}/social-cards/repo?owner=${encodeURIComponent(currentRepo.owner)}&repo=${encodeURIComponent(currentRepo.repo)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Full Size
                  </a>
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {viewMode === 'components' ? (
              <div className="border rounded-lg overflow-hidden">
                <div
                  style={{
                    transform: 'scale(0.5)',
                    transformOrigin: 'top left',
                    width: '1200px',
                    height: '630px',
                  }}
                >
                  <RepoSocialCard
                    owner={currentRepo.owner}
                    repo={currentRepo.repo}
                    timeRange="Past 6 months"
                    stats={{
                      totalContributors: 1200,
                      totalPRs: 450,
                      mergedPRs: 380,
                      weeklyPRVolume: 12,
                      activeContributors: 85,
                      topContributors: [
                        {
                          login: 'contributor1',
                          avatar_url: 'https://github.com/contributor1.png',
                          contributions: 45,
                        },
                        {
                          login: 'contributor2',
                          avatar_url: 'https://github.com/contributor2.png',
                          contributions: 32,
                        },
                        {
                          login: 'contributor3',
                          avatar_url: 'https://github.com/contributor3.png',
                          contributions: 28,
                        },
                        {
                          login: 'contributor4',
                          avatar_url: 'https://github.com/contributor4.png',
                          contributions: 21,
                        },
                        {
                          login: 'contributor5',
                          avatar_url: 'https://github.com/contributor5.png',
                          contributions: 18,
                        },
                      ],
                    }}
                  />
                </div>
              </div>
            ) : (
              <div
                className="relative border rounded-lg overflow-hidden bg-muted/20"
                style={{ height: '315px' }}
              >
                {loading.repo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary-white-overlay z-10">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                )}
                <img
                  key={`${currentRepo.owner}/${currentRepo.repo}`}
                  src={`${flyServiceUrl}/social-cards/repo?owner=${encodeURIComponent(currentRepo.owner)}&repo=${encodeURIComponent(currentRepo.repo)}`}
                  alt={`${currentRepo.owner}/${currentRepo.repo} social card preview`}
                  onLoad={() => setLoading((prev) => ({ ...prev, repo: false }))}
                  style={{
                    width: '600px',
                    height: '315px',
                    objectFit: 'contain',
                  }}
                />
              </div>
            )}
            <div className="mt-4 text-sm text-muted-foreground">
              {viewMode === 'components' ? (
                <>
                  <p>Source: React component (src/components/social-cards/repo-card.tsx)</p>
                  <p>Dimensions: 1200x630px (scaled to 50% for display)</p>
                  <p>Theme: Matches app's dark theme with CSS variables</p>
                  <p>Data: Sample data for preview purposes</p>
                </>
              ) : (
                <>
                  <p>
                    URL: {flyServiceUrl}/social-cards/repo?owner=
                    {encodeURIComponent(currentRepo.owner)}
                    &repo={encodeURIComponent(currentRepo.repo)}
                  </p>
                  <p>Dimensions: 1200x630px</p>
                  <p>Format: SVG with real-time data from Supabase</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Design Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Dark Theme Design Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Color Palette</h4>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#0A0A0A] border rounded"></div>
                      <span>Background: #0A0A0A</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#FF5402] rounded"></div>
                      <span>Primary: #FF5402</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#FAFAFA] border rounded"></div>
                      <span>Text: #FAFAFA</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#A3A3A3] border rounded"></div>
                      <span>Muted: #A3A3A3</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Technical Details</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Dimensions: 1200x630px (social media optimal)</li>
                    <li>• Format: SVG (lightweight, scalable)</li>
                    <li>• Theme: Matches app's CSS variables</li>
                    <li>• Real-time data from Supabase</li>
                    <li>• CDN distributed via Fly.io</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meta Tags Example */}
        <Card>
          <CardHeader>
            <CardTitle>Meta Tag Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              {`<!-- Home page -->
<meta property="og:image" content="${flyServiceUrl}/social-cards/home" />
<meta name="twitter:image" content="${flyServiceUrl}/social-cards/home" />

<!-- Repository page -->
<meta property="og:image" content="${flyServiceUrl}/social-cards/repo?owner=${encodeURIComponent(currentRepo.owner)}&repo=${encodeURIComponent(currentRepo.repo)}" />
<meta name="twitter:image" content="${flyServiceUrl}/social-cards/repo?owner=${encodeURIComponent(currentRepo.owner)}&repo=${encodeURIComponent(currentRepo.repo)}" />`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
