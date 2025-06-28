import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Loader2 } from "lucide-react";

export default function SocialCardPreview() {
  const [repoInput, setRepoInput] = useState("facebook/react");
  const [currentRepo, setCurrentRepo] = useState({ owner: "facebook", repo: "react" });
  const [loading, setLoading] = useState({ home: true, repo: true });

  const handlePreview = () => {
    const [owner, repo] = repoInput.split("/");
    if (owner && repo) {
      setLoading(prev => ({ ...prev, repo: true }));
      setCurrentRepo({ owner, repo });
    }
  };

  const baseUrl = window.location.origin;

  return (
    <div className="container mx-auto py-2 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Social Card Preview</h1>
      
      <div className="mb-4 text-sm text-muted-foreground">
        <p>Preview cards are displayed at 50% scale. Click "Open Full Size" to view at actual dimensions (1200x630px).</p>
      </div>

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
              Home Card
              <Button variant="outline" size="sm" asChild>
                <a href="/social-cards/home" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Full Size
                </a>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative border rounded-lg overflow-hidden bg-muted/20" style={{ height: "315px" }}>
              {loading.home && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary-white-overlay z-10">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              )}
              <iframe
                src="/social-cards/home"
                width="1200"
                height="630"
                onLoad={() => setLoading(prev => ({ ...prev, home: false }))}
                style={{ 
                  transform: "scale(0.5)", 
                  transformOrigin: "top left", 
                  width: "1200px",
                  height: "630px"
                }}
              />
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>URL: {baseUrl}/social-cards/home</p>
              <p>Dimensions: 1200x630px</p>
            </div>
          </CardContent>
        </Card>

        {/* Repository Card Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Repository Card: {currentRepo.owner}/{currentRepo.repo}
              <Button variant="outline" size="sm" asChild>
                <a 
                  href={`/social-cards/${currentRepo.owner}/${currentRepo.repo}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Full Size
                </a>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative border rounded-lg overflow-hidden bg-muted/20" style={{ height: "315px" }}>
              {loading.repo && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary-white-overlay z-10">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              )}
              <iframe
                key={`${currentRepo.owner}/${currentRepo.repo}`}
                src={`/social-cards/${currentRepo.owner}/${currentRepo.repo}`}
                width="1200"
                height="630"
                onLoad={() => setLoading(prev => ({ ...prev, repo: false }))}
                style={{ 
                  transform: "scale(0.5)", 
                  transformOrigin: "top left", 
                  width: "1200px",
                  height: "630px"
                }}
              />
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>URL: {baseUrl}/social-cards/{currentRepo.owner}/{currentRepo.repo}</p>
              <p>Dimensions: 1200x630px</p>
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
<meta property="og:image" content="${baseUrl}/storage/v1/object/public/social-cards/home-card.png" />
<meta name="twitter:image" content="${baseUrl}/storage/v1/object/public/social-cards/home-card.png" />

<!-- Repository page -->
<meta property="og:image" content="${baseUrl}/storage/v1/object/public/social-cards/repo-${currentRepo.owner}-${currentRepo.repo}.png" />
<meta name="twitter:image" content="${baseUrl}/storage/v1/object/public/social-cards/repo-${currentRepo.owner}-${currentRepo.repo}.png" />`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}