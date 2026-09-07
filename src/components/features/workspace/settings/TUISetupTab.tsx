import { Button } from '@/components/ui/button';
import { Terminal, ExternalLink } from '@/components/ui/icon';
import { PermissionUpgradeCTA } from '@/components/ui/permission-upgrade-cta';
import { UPGRADE_MESSAGES } from '@/lib/copy/upgrade-messages';
import { useSubscriptionLimits } from '@/hooks/use-subscription-limits';
import { Skeleton } from '@/components/ui/skeleton';

export function TUISetupTab() {
  const { canUseRepositoryInsightsTUI, loading } = useSubscriptionLimits();

  if (loading) return <TUISetupTabSkeleton />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Browse, analyze, and export repository insights from your terminal. Data stays on your
        machine.
      </p>
      {canUseRepositoryInsightsTUI ? (
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <a href="/local" target="_blank" rel="noopener noreferrer">
            View setup guide
            <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </a>
        </Button>
      ) : (
        <PermissionUpgradeCTA
          message={UPGRADE_MESSAGES.REPOSITORY_INSIGHTS_TUI}
          variant="alert"
          icon={Terminal}
        />
      )}
    </div>
  );
}

export function TUISetupTabSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading terminal setup" role="status">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-10 w-40" />
    </div>
  );
}
