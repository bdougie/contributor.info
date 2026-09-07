import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCachedAuth } from '@/hooks/use-cached-auth';
import { getSupabase } from '@/lib/supabase-lazy';
import { env } from '@/lib/env';
import type { Session } from '@supabase/supabase-js';

/** Imported only by the explicit development QA mode. No production auth bypass. */
export default function ReviewLabelQAControls() {
  const { user } = useCachedAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = user?.user_metadata?.user_name as string | undefined;
  const account =
    ({ bdougie: 'owner', yeazelm: 'matt', jpmcb: 'john' } as Record<string, string>)[
      current || ''
    ] || '';
  const switchAccount = async (next: string) => {
    setBusy(true);
    setError('');
    try {
      const target = new URL(env.SUPABASE_URL);
      if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.port !== '54421')
        throw new Error('QA accounts require the isolated local database.');
      const supabase = await getSupabase();
      localStorage.removeItem('redirectAfterLogin');
      await supabase.auth.signOut({ scope: 'local' });
      if (next) {
        const response = await fetch('/.netlify/functions/review-labels-qa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: next }),
        });
        const data = (await response.json()) as { session: Session; error?: string };
        if (!response.ok) throw new Error(data.error || 'Local QA sign-in failed');
        const result = await supabase.auth.setSession(data.session);
        if (result.error) throw result.error;
      }
      window.location.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Local QA sign-in failed');
      setBusy(false);
    }
  };
  return (
    <Alert className="space-y-3">
      <AlertTitle>Local QA · sample PRs</AlertTitle>
      <AlertDescription>
        Use Owner to create an invite, then Matt or John to accept it and label reviews. Auth,
        invite tracking, and labels use the local database. Exports are marked as test data.
      </AlertDescription>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={account}
          onValueChange={(value) => void switchAccount(value)}
          disabled={busy}
        >
          <SelectTrigger
            id="review-label-qa-account"
            className="w-full sm:w-64"
            aria-label="Local QA account"
          >
            <SelectValue placeholder="Choose a test account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="owner">Owner · bdougie</SelectItem>
            <SelectItem value="matt">Matt · yeazelm</SelectItem>
            <SelectItem value="john">John · jpmcb</SelectItem>
          </SelectContent>
        </Select>
        {user && (
          <Button variant="outline" disabled={busy} onClick={() => void switchAccount('')}>
            Sign out locally
          </Button>
        )}
        {busy && (
          <span role="status" className="text-sm">
            Switching account…
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </Alert>
  );
}
