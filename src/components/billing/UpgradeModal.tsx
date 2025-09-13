import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from '@/components/ui/icon';
import { SUBSCRIPTION_TIERS } from '@/services/polar/subscription.service';
import { useCurrentUser } from '@/hooks/use-current-user';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
  currentTier?: string;
}

export function UpgradeModal({
  isOpen,
  onClose,
  feature,
  currentTier = 'free',
}: UpgradeModalProps) {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'pro' | 'team'>('pro');

  const handleUpgrade = async () => {
    if (!user?.id || !user?.email) return;

    try {
      setLoading(true);

      // Get the product ID for the selected tier
      const productId =
        selectedTier === 'pro'
          ? import.meta.env.POLAR_PRODUCT_ID_PRO
          : import.meta.env.POLAR_PRODUCT_ID_TEAM;

      if (!productId) {
        throw new Error('Product ID not configured');
      }

      // Create checkout session via API
      const response = await fetch('/.netlify/functions/polar-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productPriceId: productId,
          customerEmail: user.email,
          metadata: {
            user_id: user.id,
          },
        }),
      });

      const session = await response.json();

      // Redirect to Polar checkout
      if (session.url) {
        window.location.href = session.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUpgradeMessage = () => {
    if (feature) {
      return `Upgrade your plan to unlock ${feature}`;
    }
    return 'Upgrade to access premium features';
  };

  const tierOptions = Object.values(SUBSCRIPTION_TIERS).filter(
    (tier) => tier.id !== 'free' && tier.id !== currentTier
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Upgrade Your Plan</DialogTitle>
          <DialogDescription>{getUpgradeMessage()}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {tierOptions.map((tier) => (
            <div
              key={tier.id}
              className={`border rounded-lg p-6 cursor-pointer transition-all ${
                selectedTier === tier.id
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
              }`}
              onClick={() => setSelectedTier(tier.id as 'pro' | 'team')}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{tier.name}</h3>
                  <p className="text-3xl font-bold mt-2">
                    ${tier.price}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{tier.interval}
                    </span>
                  </p>
                </div>
                {selectedTier === tier.id && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>

              <ul className="space-y-2">
                <FeatureItem
                  label={`${tier.features.maxWorkspaces} workspace${tier.features.maxWorkspaces !== 1 ? 's' : ''} included`}
                />
                {tier.addons?.additionalWorkspace && (
                  <FeatureItem
                    label={`+$${tier.addons.additionalWorkspace}/mo per additional workspace`}
                  />
                )}
                <FeatureItem label={`${tier.features.maxReposPerWorkspace} repos per workspace`} />
                {tier.id === 'pro' ? (
                  <FeatureItem label="Solo plan (no team members)" />
                ) : (
                  <>
                    <FeatureItem
                      label={`${tier.features.maxMembersPerWorkspace} team members included`}
                    />
                    {tier.addons?.additionalMember && (
                      <FeatureItem
                        label={`+$${tier.addons.additionalMember}/mo per additional member`}
                      />
                    )}
                  </>
                )}
                <FeatureItem label={`${tier.features.dataRetentionDays} days data retention`} />
                {tier.features.privateWorkspaces && <FeatureItem label="Private workspaces" />}
                {tier.features.exportsEnabled && <FeatureItem label="Data exports" />}
                {tier.features.ssoEnabled && <FeatureItem label="SSO authentication" />}
                {tier.features.auditLogs && <FeatureItem label="Audit logs" />}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleUpgrade} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Upgrade to ${SUBSCRIPTION_TIERS[selectedTier].name}`
            )}
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground mt-4">
          <p>
            Secure checkout powered by{' '}
            <a
              href="https://polar.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Polar
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeatureItem({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2">
      <Check className="h-4 w-4 text-green-600" />
      <span className="text-sm">{label}</span>
    </li>
  );
}
