import React, { useState } from 'react';
import { Users, Mail, Github, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkspaceRole } from '@/types/workspace';
import { useSubscriptionLimits } from '@/hooks/use-subscription-limits';
import { WorkspaceService } from '@/services/workspace.service';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  currentMemberCount: number;
  onInviteSent: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  currentMemberCount,
  onInviteSent,
}) => {
  const [inviteMethod, setInviteMethod] = useState<'email' | 'github'>('email');
  const [inviteValue, setInviteValue] = useState('');
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole>('contributor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const limits = useSubscriptionLimits();

  if (!isOpen) return null;

  // For now, use a default max members limit
  let maxMembers = 50;
  if (limits.tier === 'free') {
    maxMembers = 1;
  } else if (limits.tier === 'pro') {
    maxMembers = 5;
  }
  const canInviteMore = maxMembers > currentMemberCount;
  const remainingInvites = Math.max(0, maxMembers - currentMemberCount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canInviteMore) {
      setShowUpgradeModal(true);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to invite members');
        return;
      }

      // For GitHub invites, we need to resolve the email first
      let emailToInvite = inviteValue;
      if (inviteMethod === 'github') {
        // In a real implementation, you would call GitHub API to get user email
        // For now, we'll construct a placeholder email
        emailToInvite = `${inviteValue}@users.noreply.github.com`;
      }

      console.log('Inviting member with:', {
        workspaceId,
        invitedBy: user.id,
        email: emailToInvite,
        role: selectedRole,
      });

      const result = await WorkspaceService.inviteMember(
        workspaceId,
        user.id,
        emailToInvite,
        selectedRole
      );

      if (result.success) {
        onInviteSent();
        setInviteValue('');
        onClose();
      } else {
        setError(result.error || 'Failed to send invitation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Invite a new member to collaborate in this workspace
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Subscription limit alert */}
            {!limits.loading && (
              <Alert
                className={cn(
                  'border',
                  canInviteMore
                    ? 'border-blue-200 bg-blue-50/50'
                    : 'border-amber-200 bg-amber-50/50'
                )}
              >
                <Users className="h-4 w-4" />
                <AlertDescription>
                  {canInviteMore ? (
                    <>
                      You can invite <strong>{remainingInvites}</strong> more member
                      {remainingInvites !== 1 ? 's' : ''}
                    </>
                  ) : (
                    <>
                      You've reached your team size limit of <strong>{maxMembers}</strong> members.{' '}
                      <button
                        type="button"
                        onClick={() => setShowUpgradeModal(true)}
                        className="underline font-medium"
                      >
                        Upgrade to invite more
                      </button>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Invite method tabs */}
            <Tabs
              value={inviteMethod}
              onValueChange={(v) => setInviteMethod(v as 'email' | 'github')}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="github" className="flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  GitHub
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Input field */}
            <div className="space-y-2">
              <Label htmlFor="invite-value">
                {inviteMethod === 'email' ? 'Email Address' : 'GitHub Username'}
              </Label>
              <Input
                id="invite-value"
                type={inviteMethod === 'email' ? 'email' : 'text'}
                value={inviteValue}
                onChange={(e) => setInviteValue(e.target.value)}
                placeholder={inviteMethod === 'email' ? 'colleague@example.com' : 'username'}
                required
                disabled={!canInviteMore}
              />
            </div>

            {/* Role selection */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => setSelectedRole(v as WorkspaceRole)}
                disabled={!canInviteMore}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contributor">
                    <div>
                      <div className="font-medium">Contributor</div>
                      <div className="text-xs text-muted-foreground">View-only access</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="maintainer">
                    <div>
                      <div className="font-medium">Maintainer</div>
                      <div className="text-xs text-muted-foreground">Can edit workspace</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedRole === 'contributor'
                  ? 'Can view workspace data, repositories, and analytics'
                  : 'Can add/remove repositories and edit settings'}
              </p>
            </div>

            {/* Error message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              {canInviteMore ? (
                <Button type="submit" disabled={isSubmitting || !inviteValue}>
                  {isSubmitting ? 'Sending...' : 'Send Invitation'}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setShowUpgradeModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Upgrade to Invite
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="team-invites"
      />
    </>
  );
};
