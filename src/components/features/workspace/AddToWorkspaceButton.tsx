import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AddToWorkspaceModal } from './AddToWorkspaceModal';
import { ModalErrorBoundary } from '@/components/ui/modal-error-boundary';

interface AddToWorkspaceButtonProps {
  owner: string;
  repo: string;
  className?: string;
}

export function AddToWorkspaceButton({ owner, repo, className = '' }: AddToWorkspaceButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setModalOpen(true)}
              className={`h-8 w-8 ${className}`}
              aria-label="Add to workspace"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Add to Workspace</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ModalErrorBoundary onReset={() => setModalOpen(false)}>
        <AddToWorkspaceModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          owner={owner}
          repo={repo}
        />
      </ModalErrorBoundary>
    </>
  );
}
