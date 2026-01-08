import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Terminal, ExternalLink, Sparkles } from '@/components/ui/icon';
import { PermissionUpgradeCTA } from '@/components/ui/permission-upgrade-cta';
import { UPGRADE_MESSAGES } from '@/lib/copy/upgrade-messages';
import { useCurrentUser } from '@/hooks/use-current-user';
import { SubscriptionService } from '@/services/polar/subscription.service';
import { Skeleton } from '@/components/ui/skeleton';

interface TUISetupTabProps {
  workspaceId: string;
}

export function TUISetupTab({ workspaceId }: TUISetupTabProps) {
  const { user, loading: userLoading } = useCurrentUser();
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    const checkFeatureAccess = async () => {
      if (!user?.id) {
        setCheckingAccess(false);
        setHasAccess(false);
        return;
      }

      try {
        const access = await SubscriptionService.checkFeatureAccess(
          user.id,
          'repositoryInsightsTUI'
        );
        setHasAccess(access);
      } catch (error) {
        console.error('Error checking TUI feature access:', error);
        setHasAccess(false);
      } finally {
        setCheckingAccess(false);
      }
    };

    checkFeatureAccess();
  }, [user, workspaceId]);

  if (userLoading || checkingAccess) {
    return <TUISetupTabSkeleton />;
  }

  // Show upgrade prompt for users without access
  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <PermissionUpgradeCTA
          message={UPGRADE_MESSAGES.REPOSITORY_INSIGHTS_TUI}
          variant="card"
          size="md"
          icon={Terminal}
        />

        {/* Feature Preview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">What's Included</CardTitle>
                <CardDescription>
                  Powerful terminal interface for repository insights
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Local-first analytics</strong> - All data
                  processing happens on your machine
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Offline repository exploration</strong> - Work
                  without internet connection
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Data privacy and control</strong> - Perfect
                  for enterprise environments
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Enterprise deployment options</strong> -
                  Deploy on your infrastructure
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show setup card for users with access
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <Terminal className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle>Repository Insights TUI</CardTitle>
            <CardDescription>
              Explore repositories with a local-first terminal interface
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Run a powerful terminal UI to browse, analyze, and export repository insights. All data
          stays on your machine - perfect for enterprise environments that require data privacy and
          control.
        </p>

        <div className="flex flex-col gap-3 pt-2">
          <Button asChild variant="default" className="w-full sm:w-auto">
            <a
              href="/local"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              View Setup Guide
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Opens complete documentation with setup instructions, CLI commands, and deployment
            guides
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TUISetupTabSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-40" />
      </CardContent>
    </Card>
  );
}
