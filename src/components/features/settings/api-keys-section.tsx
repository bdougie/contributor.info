import { useState, useEffect, useCallback, useRef } from 'react';
import { Key, Plus, Copy, Trash2, Loader2, Check, AlertCircle } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabase-lazy';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ApiKey {
  id: string;
  keyId: string;
  name: string;
  prefix: string;
  lastFour: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

interface NewKeyResponse {
  keyId: string;
  key: string;
  name: string;
  prefix: string;
  lastFour: string;
  expiresAt: string | null;
}

export function ApiKeysSection() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<NewKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Keep toast ref up to date
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const fetchKeys = useCallback(async () => {
    try {
      const supabase = await getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const response = await fetch('/.netlify/functions/api-key-list', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      setKeys(data.keys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toastRef.current({
        title: 'Error',
        description: 'Failed to load API keys. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for your API key.',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const supabase = await getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/.netlify/functions/api-key-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create API key');
      }

      const newKey = await response.json();
      setNewlyCreatedKey(newKey);
      setNewKeyName('');
      setShowCreateForm(false);
      await fetchKeys();

      toast({
        title: 'API key created',
        description: "Copy your key now. You won't be able to see it again.",
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create API key.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied',
        description: 'API key copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleRevokeKey = async () => {
    if (!keyToRevoke) return;

    setRevoking(true);
    try {
      const supabase = await getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/.netlify/functions/api-key-revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ keyId: keyToRevoke.keyId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to revoke API key');
      }

      await fetchKeys();
      toast({
        title: 'API key revoked',
        description: 'The API key has been permanently revoked.',
      });
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke API key.',
        variant: 'destructive',
      });
    } finally {
      setRevoking(false);
      setKeyToRevoke(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">API Keys</h3>
          <p className="text-sm text-muted-foreground">Manage API keys for the contributor CLI</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} disabled={showCreateForm} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Create Key
        </Button>
      </div>

      {/* New key created alert */}
      {newlyCreatedKey && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/20 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Copy your API key now
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                This is the only time you'll see this key. Store it securely.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm break-all">
              {newlyCreatedKey.key}
            </code>
            <Button variant="outline" size="sm" onClick={() => handleCopyKey(newlyCreatedKey.key)}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNewlyCreatedKey(null)}
            className="w-full"
          >
            I've copied my key
          </Button>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key-name">Key Name</Label>
            <Input
              id="key-name"
              placeholder="e.g., My Laptop, CI Server"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating && newKeyName.trim()) {
                  handleCreateKey();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              A descriptive name to help you identify this key later.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateKey} disabled={creating || !newKeyName.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Key
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateForm(false);
                setNewKeyName('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Key className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 font-medium">No API keys yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create an API key to use with the contributor CLI.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-muted p-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {key.prefix}_...{key.lastFour}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                  <p className="text-muted-foreground">Created {formatDate(key.createdAt)}</p>
                  {key.expiresAt && (
                    <p className="text-yellow-600 dark:text-yellow-400 text-xs">
                      Expires {formatDate(key.expiresAt)}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setKeyToRevoke(key)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revoke confirmation dialog */}
      <AlertDialog open={!!keyToRevoke} onOpenChange={() => setKeyToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the key "{keyToRevoke?.name}"? This action cannot be
              undone and any applications using this key will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeKey}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
