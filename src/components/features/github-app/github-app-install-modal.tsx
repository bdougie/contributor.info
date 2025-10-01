import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  Database,
  Brain,
  RefreshCw,
  Shield,
  Sparkles,
  ExternalLink,
} from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Repository {
  id: string;
  full_name: string;
  owner: string;
  name: string;
}

interface GitHubAppInstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repository: Repository;
  isInstalled: boolean;
}

/**
 * Modal to explain and prompt GitHub App installation for webhook-driven features
 */
export function GitHubAppInstallModal({
  open,
  onOpenChange,
  repository,
  isInstalled,
}: GitHubAppInstallModalProps) {
  // Generate GitHub App installation URL
  const getInstallUrl = () => {
    const appSlug = 'contributor-info';
    return `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(
      JSON.stringify({
        repository: repository.full_name,
        source: 'install_modal',
      })
    )}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Real-time Similarity Search
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-120px)] pr-4">
          {isInstalled ? (
            // Success state - app is installed
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                    GitHub App Connected
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Real-time similarity search is active with webhook updates for{' '}
                    <span className="font-mono font-medium">{repository.full_name}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Active Features
                </h4>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">Instant Similarity Detection</div>
                      <p className="text-sm text-muted-foreground">
                        Search results appear in &lt;500ms with sparkle indicators
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <RefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">Real-time Updates</div>
                      <p className="text-sm text-muted-foreground">
                        Similarity data updates automatically when issues are created
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Database className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">Complete Coverage</div>
                      <p className="text-sm text-muted-foreground">
                        All issues and PRs are automatically indexed via webhooks
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            // Installation prompt
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Install our GitHub App to unlock instant similarity matching with complete issue
                  coverage for <span className="font-mono font-medium">{repository.full_name}</span>
                  .
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Benefits
                </h4>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">10x Faster Searches</div>
                      <p className="text-sm text-muted-foreground">
                        Lightning-fast similarity results in under 500ms
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Database className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">100% Coverage</div>
                      <p className="text-sm text-muted-foreground">
                        Every issue and PR is automatically indexed
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Brain className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">AI-Powered Understanding</div>
                      <p className="text-sm text-muted-foreground">
                        Semantic analysis finds similar issues even with different wording
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <RefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">Real-time Updates</div>
                      <p className="text-sm text-muted-foreground">
                        Similarity data updates automatically as issues are created
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">No Rate Limits</div>
                      <p className="text-sm text-muted-foreground">
                        Uses webhooks instead of API calls - unlimited usage
                      </p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t">
                <Button asChild className="w-full" size="lg">
                  <a
                    href={getInstallUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    Install GitHub App
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
