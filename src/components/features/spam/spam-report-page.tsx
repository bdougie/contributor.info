/**
 * Spam report submission page (requires authentication)
 * Issue #1622: Known Spammer Community Database
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, AlertTriangle, CheckCircle, ExternalLink, LogIn } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { safeGetSession } from '@/lib/auth/safe-auth';
import { submitSpamReport, checkRateLimit } from '@/lib/spam/SpamReportService';
import {
  SPAM_CATEGORIES,
  GITHUB_PR_URL_PATTERN,
  type SpamCategory,
  type RateLimitResult,
} from '@/lib/spam/types/spam-report.types';

export function SpamReportPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [prUrl, setPrUrl] = useState('');
  const [category, setCategory] = useState<SpamCategory | ''>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ isDuplicate: boolean } | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitResult | null>(null);

  const isValidUrl = GITHUB_PR_URL_PATTERN.test(prUrl);
  const canSubmit = isValidUrl && category !== '' && !isSubmitting;

  // Load user info and check rate limit on mount
  useEffect(() => {
    async function init() {
      const { user } = await safeGetSession();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || null);
      }
      const limit = await checkRateLimit(user?.id);
      setRateLimit(limit);
    }
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const result = await submitSpamReport(
      {
        pr_url: prUrl,
        spam_category: category as SpamCategory,
        description: description || undefined,
      },
      userId
    );

    setIsSubmitting(false);

    if (result.success) {
      setSuccess({ isDuplicate: result.is_duplicate || false });
      // Reset form on success
      setPrUrl('');
      setCategory('');
      setDescription('');
      // Refresh rate limit
      checkRateLimit(userId).then(setRateLimit);
    } else {
      setError(result.error || 'Failed to submit report');
    }
  };

  const isRateLimited = rateLimit !== null && !rateLimit.allowed;

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Report Spam PR
          </CardTitle>
          <CardDescription>
            Help the community identify spam contributions. Reports are reviewed by moderators
            before being added to the known spammer database.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Login required message for unauthenticated users */}
          {!isLoggedIn ? (
            <div className="text-center py-8">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <LogIn className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Sign in Required</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                To report spam, please sign in with your GitHub account. This helps us maintain
                report quality and track reporter reputation.
              </p>
              <Button onClick={() => navigate('/login')} className="gap-2">
                <LogIn className="h-4 w-4" />
                Sign in with GitHub
              </Button>
              <div className="mt-8 pt-6 border-t text-left">
                <h4 className="font-medium mb-3">Why require sign-in?</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>
                    <strong>Quality:</strong> Authenticated reports are more reliable
                  </li>
                  <li>
                    <strong>Reputation:</strong> Build trust as a verified reporter
                  </li>
                  <li>
                    <strong>Tracking:</strong> View your report history and status
                  </li>
                  <li>
                    <strong>Protection:</strong> Prevents abuse and false reports
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              {/* Rate limit warning */}
              {isRateLimited && (
                <Alert variant="destructive" className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Rate Limit Reached</AlertTitle>
                  <AlertDescription>{rateLimit?.message}</AlertDescription>
                </Alert>
              )}

              {/* Success message */}
              {success && (
                <Alert className="mb-6 border-green-500 bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertTitle className="text-green-500">Report Submitted</AlertTitle>
                  <AlertDescription>
                    {success.isDuplicate
                      ? 'This PR has already been reported. Your report has been counted as an additional confirmation.'
                      : 'Thank you for your report. It will be reviewed by moderators.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Error message */}
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* PR URL Input */}
                <div className="space-y-2">
                  <Label htmlFor="pr-url">
                    GitHub PR URL <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="pr-url"
                    type="url"
                    placeholder="https://github.com/owner/repo/pull/123"
                    value={prUrl}
                    onChange={(e) => setPrUrl(e.target.value)}
                    className={prUrl && !isValidUrl ? 'border-destructive' : ''}
                  />
                  {prUrl && !isValidUrl && (
                    <p className="text-sm text-destructive">
                      Please enter a valid GitHub PR URL (e.g.,
                      https://github.com/owner/repo/pull/123)
                    </p>
                  )}
                </div>

                {/* Spam Category Select */}
                <div className="space-y-2">
                  <Label htmlFor="category">
                    Spam Category <span className="text-destructive">*</span>
                  </Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as SpamCategory)}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SPAM_CATEGORIES).map(
                        ([key, { label, description: desc }]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex flex-col">
                              <span>{label}</span>
                              <span className="text-xs text-muted-foreground">{desc}</span>
                            </div>
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Description Textarea */}
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Additional Details <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Provide any additional context about why this is spam..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Reporter Info */}
                <div className="text-sm text-muted-foreground">
                  Reporting as{' '}
                  <span className="font-medium">{userEmail || 'authenticated user'}</span>
                </div>

                {/* Rate limit info */}
                {rateLimit?.allowed &&
                  rateLimit.remaining_hourly !== undefined &&
                  rateLimit.remaining_daily !== undefined && (
                    <div className="text-xs text-muted-foreground">
                      Reports remaining: {rateLimit.remaining_hourly}/hour,{' '}
                      {rateLimit.remaining_daily}
                      /day
                    </div>
                  )}

                {/* Submit Button */}
                <Button type="submit" className="w-full" disabled={!canSubmit || isRateLimited}>
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </Button>
              </form>

              {/* Guidelines */}
              <div className="mt-8 pt-6 border-t">
                <h3 className="font-medium mb-3">Reporting Guidelines</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>
                    <strong>Be accurate:</strong> Only report PRs you genuinely believe are spam
                  </li>
                  <li>
                    <strong>Provide context:</strong> Descriptions help moderators verify reports
                    faster
                  </li>
                  <li>
                    <strong>No abuse:</strong> False reports will affect your reporter reputation
                  </li>
                  <li>
                    <strong>Privacy:</strong> All reports are reviewed before public listing
                  </li>
                </ul>
                <p className="text-sm text-muted-foreground mt-4">
                  Learn more about our{' '}
                  <a href="/terms" className="underline inline-flex items-center gap-1">
                    Terms of Service
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
