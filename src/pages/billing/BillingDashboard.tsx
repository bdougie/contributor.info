import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/use-current-user';
import { usePrimaryWorkspace } from '@/hooks/use-user-workspaces';
import { SubscriptionService, SUBSCRIPTION_TIERS } from '@/services/polar/subscription.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, ExternalLink } from '@/components/ui/icon';
import { formatDistanceToNow } from 'date-fns';

interface UsageStats {
  tier: string;
  subscription: {
    id: string;
    status: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
    polar_subscription_id?: string;
  } | null;
  limits: {
    maxWorkspaces: number | 'unlimited';
    maxReposPerWorkspace: number;
    maxMembersPerWorkspace: number | 'unlimited';
    dataRetentionDays: number | 'unlimited';
    analyticsLevel: string;
    privateWorkspaces: boolean;
    exportsEnabled: boolean;
  };
  usage: {
    workspaces: number;
    features: Array<{ metric_type: string; value: number }>;
  };
}

export function BillingDashboard() {
  const { user } = useCurrentUser();
  const { workspace: primaryWorkspace } = usePrimaryWorkspace();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [creatingCheckout, setCreatingCheckout] = useState(false);

  // Handle success redirect
  useEffect(() => {
    const success = searchParams.get('success');
    if (success === 'true' && primaryWorkspace) {
      // Redirect to workspace after successful payment
      const redirectTimer = setTimeout(() => {
        navigate(`/workspaces/${primaryWorkspace.id}`);
      }, 2000); // Give user time to see success state
      return () => clearTimeout(redirectTimer);
    }
  }, [searchParams, primaryWorkspace, navigate]);

  useEffect(() => {
    const loadUsageStats = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        const stats = await SubscriptionService.getUsageStats(user.id);
        setUsageStats(stats);
      } catch (error) {
        console.error('Error loading usage stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      loadUsageStats();
    }
  }, [user]);

  const handleUpgrade = async (tierId: 'pro' | 'team') => {
    if (!user?.id || !user?.email) return;

    try {
      setCreatingCheckout(true);

      // Get the product ID for the selected tier
      const productId =
        tierId === 'pro'
          ? import.meta.env.VITE_POLAR_PRODUCT_ID_PRO
          : import.meta.env.VITE_POLAR_PRODUCT_ID_TEAM;

      if (!productId) {
        throw new Error('Product ID not configured');
      }

      // Create checkout session via API
      const functionsUrl = '/.netlify/functions/polar-checkout';
      const response = await fetch(functionsUrl, {
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

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Checkout error details:', errorData);
        throw new Error(errorData.error || 'Failed to create checkout');
      }

      const session = await response.json();

      // Redirect to Polar checkout
      if (session.url) {
        window.location.href = session.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setCreatingCheckout(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!usageStats?.subscription?.polar_subscription_id || !user?.id) return;

    try {
      await SubscriptionService.cancelSubscription(usageStats.subscription.polar_subscription_id);
      // Reload usage stats
      const stats = await SubscriptionService.getUsageStats(user.id);
      setUsageStats(stats);
    } catch (error) {
      console.error('Error canceling subscription:', error);
    }
  };

  // Show success message if redirecting
  const success = searchParams.get('success');
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (success === 'true' && primaryWorkspace) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-green-100 rounded-full p-3">
                <Check className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-green-900 mb-2">
              Payment Successful!
            </h2>
            <p className="text-green-700 mb-4">
              Your subscription has been activated. Redirecting you to your workspace...
            </p>
            <div className="flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-green-600" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentTier = usageStats?.tier || 'free';
  const subscription = usageStats?.subscription;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and view usage statistics</p>
      </div>

      {/* Current Plan */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your subscription details and billing information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold">{SUBSCRIPTION_TIERS[currentTier].name}</span>
                <Badge variant={currentTier === 'free' ? 'secondary' : 'default'}>
                  {subscription?.status || 'Active'}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                ${SUBSCRIPTION_TIERS[currentTier].price}/{SUBSCRIPTION_TIERS[currentTier].interval}
              </p>
            </div>
            {subscription?.current_period_end && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Next billing date</p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(subscription.current_period_end), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            )}
          </div>

          {currentTier !== 'free' && subscription?.cancel_at_period_end && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Your subscription will be canceled at the end of the current billing period.
              </p>
            </div>
          )}

          {currentTier !== 'free' && !subscription?.cancel_at_period_end && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleCancelSubscription}
                className="text-red-600 hover:text-red-700"
              >
                Cancel Subscription
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Usage Overview</CardTitle>
          <CardDescription>Your current usage against plan limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <UsageMetric
              label="Workspaces"
              current={usageStats?.usage.workspaces || 0}
              limit={usageStats?.limits.maxWorkspaces ?? null}
            />
            <UsageMetric
              label="Data Retention"
              current={`${usageStats?.limits.dataRetentionDays} days`}
              limit={null}
              isText
            />
            <UsageMetric
              label="Analytics Level"
              current={usageStats?.limits.analyticsLevel || 'basic'}
              limit={null}
              isText
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing Plans */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.values(SUBSCRIPTION_TIERS)
            .filter((tier) => tier.id !== 'enterprise')
            .map((tier) => (
              <Card key={tier.id} className={tier.id === currentTier ? 'border-primary' : ''}>
                <CardHeader>
                  <CardTitle>{tier.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold">${tier.price}</span>
                    <span className="text-muted-foreground">/{tier.interval}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                <ul className="space-y-2 mb-6">
                  {tier.id === 'free' ? (
                    <>
                      <FeatureItem label="No workspaces included" included={false} />
                      <FeatureItem label="7 days data retention" included />
                      <FeatureItem label="Basic analytics" included />
                    </>
                  ) : (
                    <>
                      <FeatureItem
                        label={`${tier.features.maxWorkspaces} workspace${tier.features.maxWorkspaces !== 1 ? 's' : ''} included`}
                        included
                      />
                      {tier.addons?.additionalWorkspace && (
                        <FeatureItem
                          label={`+$${tier.addons.additionalWorkspace}/mo per additional workspace`}
                          included
                        />
                      )}
                      <FeatureItem
                        label={`${tier.features.maxReposPerWorkspace} repos per workspace`}
                        included
                      />
                      {tier.id === 'pro' ? (
                        <>
                          <FeatureItem label="Solo plan (no team members)" included />
                          <FeatureItem label="No SSO authentication" included={false} />
                          <FeatureItem label="No data exports" included={false} />
                          <FeatureItem label="No audit logs" included={false} />
                        </>
                      ) : (
                        <>
                          <FeatureItem
                            label={`${tier.features.maxMembersPerWorkspace} team members included`}
                            included
                          />
                          {tier.addons?.additionalMember && (
                            <FeatureItem
                              label={`+$${tier.addons.additionalMember}/mo per additional member`}
                              included
                            />
                          )}
                        </>
                      )}
                      <FeatureItem
                        label={`${tier.features.dataRetentionDays} days data retention`}
                        included
                      />
                      <FeatureItem
                        label="Private workspaces"
                        included={tier.features.privateWorkspaces}
                      />
                      <FeatureItem 
                        label="Data exports" 
                        included={tier.id === 'pro' ? false : tier.features.exportsEnabled} 
                      />
                      {tier.features.ssoEnabled && (
                        <FeatureItem label="SSO authentication" included />
                      )}
                      {tier.features.auditLogs && <FeatureItem label="Audit logs" included />}
                    </>
                  )}
                </ul>

                {tier.id !== currentTier && tier.id !== 'free' && (
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade(tier.id as 'pro' | 'team')}
                    disabled={creatingCheckout}
                  >
                    {creatingCheckout ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Upgrade to ${tier.name}`
                    )}
                  </Button>
                )}
                {tier.id === currentTier && (
                  <Button className="w-full" disabled variant="outline">
                    Current Plan
                  </Button>
                )}
              </CardContent>
            </Card>
            ))
          }
        </div>
        
        {/* Enterprise Contact Card */}
        <div className="mt-8 text-center">
          <div className="bg-muted/50 border border-muted rounded-lg p-6 inline-block">
            <h3 className="text-lg font-medium mb-2">Need more?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Custom solutions with SSO, data exports, audit logs, and dedicated support
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:brian@dinnerpeople.app" className="inline-flex items-center gap-2">
                Contact Us
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Powered by Polar */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Billing powered by{' '}
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
    </div>
  );
}

function UsageMetric({
  label,
  current,
  limit,
  isText = false,
}: {
  label: string;
  current: number | string;
  limit: number | string | null;
  isText?: boolean;
}) {
  const percentage =
    !isText && limit && limit !== 'unlimited' ? (Number(current) / Number(limit)) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {isText ? (
            current
          ) : (
            <>
              {current} {limit && limit !== 'unlimited' && `of ${limit}`}
              {limit === 'unlimited' && 'of unlimited'}
            </>
          )}
        </span>
      </div>
      {!isText && limit && limit !== 'unlimited' && (
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function FeatureItem({ label, included }: { label: string; included: boolean }) {
  return (
    <li className="flex items-center gap-2">
      {included ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={included ? '' : 'text-muted-foreground'}>{label}</span>
    </li>
  );
}
