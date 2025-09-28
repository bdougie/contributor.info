import React, { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InvitationActionsProps {
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
  isProcessing?: boolean;
}

export const InvitationActions: React.FC<InvitationActionsProps> = ({
  onAccept,
  onDecline,
  isProcessing = false,
}) => {
  const [action, setAction] = useState<'accept' | 'decline' | null>(null);

  const handleAccept = async () => {
    setAction('accept');
    await onAccept();
  };

  const handleDecline = async () => {
    setAction('decline');
    await onDecline();
  };

  return (
    <div className="flex justify-center gap-4">
      <Button variant="outline" size="lg" onClick={handleDecline} disabled={isProcessing}>
        {isProcessing && action === 'decline' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <X className="h-4 w-4 mr-2" />
        )}
        Decline Invitation
      </Button>
      <Button size="lg" onClick={handleAccept} disabled={isProcessing}>
        {isProcessing && action === 'accept' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Check className="h-4 w-4 mr-2" />
        )}
        Accept & Join Workspace
      </Button>
    </div>
  );
};
