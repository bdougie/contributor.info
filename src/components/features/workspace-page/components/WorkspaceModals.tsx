import { ReviewerSuggestionsModal } from '@/components/features/workspace/reviewer-suggestions/ReviewerSuggestionsModal';
import { GitHubAppInstallModal } from '@/components/features/github-app/github-app-install-modal';
import { ResponsePreviewModal } from '@/components/features/workspace';
import type { CurrentItem } from '@/components/features/workspace/ResponsePreviewModal';
import type { SimilarItem } from '@/services/similarity-search';
import { AIFeatureErrorBoundary } from '@/components/error-boundaries/ai-feature-error-boundary';
import { toast } from 'sonner';
import type { Repository } from '@/components/features/workspace';

interface WorkspaceModalsProps {
  // Reviewer Modal
  reviewerModalOpen: boolean;
  onReviewerModalChange: (open: boolean) => void;
  repositories: Repository[];

  // GitHub App Modal
  githubAppModalOpen: boolean;
  onGithubAppModalChange: (open: boolean) => void;
  selectedRepository: Repository | null;
  isGithubAppInstalled: boolean;

  // Response Modal
  responseModalOpen: boolean;
  onResponseModalChange: (open: boolean) => void;
  loadingSimilarItems: boolean;
  similarItems: SimilarItem[];
  responseMessage: string;
  currentRespondItem: CurrentItem | null;
  workspaceId: string;
  onItemMarkedAsResponded: () => void;
}

export function WorkspaceModals({
  reviewerModalOpen,
  onReviewerModalChange,
  repositories,
  githubAppModalOpen,
  onGithubAppModalChange,
  selectedRepository,
  isGithubAppInstalled,
  responseModalOpen,
  onResponseModalChange,
  loadingSimilarItems,
  similarItems,
  responseMessage,
  currentRespondItem,
  workspaceId,
  onItemMarkedAsResponded,
}: WorkspaceModalsProps) {
  return (
    <>
      {/* Reviewer Suggestions Modal */}
      {repositories.length > 0 && (
        <ReviewerSuggestionsModal
          open={reviewerModalOpen}
          onOpenChange={onReviewerModalChange}
          repositories={repositories.map((r) => ({
            id: r.id,
            name: r.name,
            owner: r.owner,
            full_name: r.full_name,
          }))}
        />
      )}

      {/* GitHub App Install Modal */}
      {selectedRepository && (
        <GitHubAppInstallModal
          open={githubAppModalOpen}
          onOpenChange={onGithubAppModalChange}
          repository={{
            id: selectedRepository.id,
            full_name: selectedRepository.full_name,
            owner: selectedRepository.owner,
            name: selectedRepository.name,
          }}
          isInstalled={isGithubAppInstalled}
        />
      )}

      {/* Response Preview Modal - Wrapped in AI Error Boundary */}
      <AIFeatureErrorBoundary
        featureName="Response Suggestions"
        fallback={
          <div className="p-4 text-center text-muted-foreground">
            <p>AI-powered response suggestions are temporarily unavailable.</p>
            <p className="text-sm mt-2">You can still manually respond to items.</p>
          </div>
        }
      >
        <ResponsePreviewModal
          open={responseModalOpen}
          onOpenChange={onResponseModalChange}
          loading={loadingSimilarItems}
          similarItems={similarItems}
          responseMessage={responseMessage}
          currentItem={currentRespondItem || undefined}
          workspaceId={workspaceId}
          onCopyToClipboard={() => {
            toast.success('Response copied to clipboard!');
          }}
          onItemMarkedAsResponded={onItemMarkedAsResponded}
        />
      </AIFeatureErrorBoundary>
    </>
  );
}
