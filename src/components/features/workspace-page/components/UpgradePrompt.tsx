import { Button } from '@/components/ui/button';
import { TrendingUp } from '@/components/ui/icon';

interface UpgradePromptProps {
  tier: string;
  onUpgradeClick: () => void;
}

export function UpgradePrompt({ tier, onUpgradeClick }: UpgradePromptProps) {
  if (tier !== 'free') {
    return null;
  }

  return (
    <div className="container max-w-7xl mx-auto px-6 pb-6 mt-6">
      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Unlock Advanced Analytics</h3>
            <div className="rounded-full bg-primary/10 p-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Upgrade to Pro to access historical data beyond 30 days, advanced metrics, and priority
            support. Pro users can track up to 10 repositories per workspace.
          </p>
          <Button onClick={onUpgradeClick} variant="default" size="sm" className="mt-3">
            Upgrade to Pro
          </Button>
        </div>
      </div>
    </div>
  );
}
