import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  Database,
  Brain,
  RefreshCw,
  Shield,
  ChevronRight,
} from '@/components/ui/icon';
import { useGitHubAppStatus } from '@/hooks/use-github-app-status';

interface Repository {
  id: string;
  full_name: string;
  owner: string;
  name: string;
}

interface GitHubAppInstallCTAProps {
  repository: Repository;
  className?: string;
}

/**
 * Component to prompt users to install the GitHub App for webhook-driven features
 * Shows installation status and benefits of connecting the app
 */
export function GitHubAppInstallCTA({ repository, className = '' }: GitHubAppInstallCTAProps) {
  const appStatus = useGitHubAppStatus(repository.id);
  const [showBenefits, setShowBenefits] = useState(false);

  // Generate GitHub App installation URL
  const getInstallUrl = () => {
    const appSlug = 'contributor-info'; // Your GitHub App slug
    return `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(
      JSON.stringify({
        repository: repository.full_name,
        source: 'install_cta',
      })
    )}`;
  };

  if (appStatus.loading) {
    return null; // Don't show anything while checking status
  }

  // If already installed, show success state
  if (appStatus.isInstalled) {
    return (
      <Card
        className={`bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 ${className}`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-green-800 dark:text-green-300 font-medium">
              GitHub App Connected
            </span>
          </div>
          <p className="text-sm text-green-700 dark:text-green-400 mt-1 ml-7">
            Real-time similarity search is active with webhook updates
          </p>
        </CardContent>
      </Card>
    );
  }

  // Installation prompt
  return (
    <Card
      className={`bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800 ${className}`}
    >
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Enable Real-time Similarity Search
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Install our GitHub App to unlock instant similarity matching with complete issue
              coverage.
            </p>

            {showBenefits && (
              <ul className="space-y-2 mb-4">
                <li className="flex items-start gap-2 text-sm">
                  <span>
                    <strong>10x faster</strong> similarity searches (&lt; 500ms)
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Database className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>100% coverage</strong> of all issues and PRs
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Brain className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>AI-powered</strong> semantic understanding
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <RefreshCw className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Real-time updates</strong> as issues are created
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Shield className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>No rate limits</strong> - uses webhooks, not API calls
                  </span>
                </li>
              </ul>
            )}

            <div className="flex items-center gap-4 mt-4">
              <Button asChild>
                <a href={getInstallUrl()} target="_blank" rel="noopener noreferrer">
                  Install GitHub App
                </a>
              </Button>
              {!showBenefits && (
                <button
                  onClick={() => setShowBenefits(true)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium inline-flex items-center gap-1"
                >
                  See all benefits
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
